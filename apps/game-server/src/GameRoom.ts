import { Room, Client } from "colyseus";
import { GameState, Player, Food, SnakeSegment } from "./schema/GameState";
import { GridManager } from "@snake-vnr/game-logic";
import { nanoid } from "nanoid";
import { getRandomQuestion, QUESTION_BANK } from "./QuestionBank";
import { MatchLogger } from "./services/MatchLogger";

export class GameRoom extends Room<GameState> {
  maxClients = 20;
  private gameDuration = 10 * 60 * 1000; // 10 minutes
  private elapsedTime = 0;
  private gridManager!: GridManager;
  private usedQuestionIds = new Set<string>();
  private matchLogger!: MatchLogger;

  onCreate (options: any) {
    this.setState(new GameState());
    this.matchLogger = new MatchLogger(this.roomId);
    
    // Create grid of 100x100 for a massive map
    this.gridManager = new GridManager(100, 100);

    this.onMessage("startGame", (client) => {
      if (this.state.phase === 0 && client.sessionId === this.state.hostId) {
        this.state.phase = 3;
        this.state.countdown = 3;
        
        const countdownInterval = setInterval(() => {
          this.state.countdown -= 1;
          if (this.state.countdown <= 0) {
            clearInterval(countdownInterval);
            this.state.phase = 1;
            // @ts-ignore
            this.startedAt = Date.now();
            for (let i = 0; i < 30; i++) {
              this.spawnFood();
            }
          }
        }, 1000);
      }
    });

    this.onMessage("move", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.state === "MOVING") {
        if (
          (player.direction === "up" && message.direction === "down") ||
          (player.direction === "down" && message.direction === "up") ||
          (player.direction === "left" && message.direction === "right") ||
          (player.direction === "right" && message.direction === "left")
        ) return;

        player.direction = message.direction;
      }
    });

    this.onMessage("togglePause", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      
      if (player.state === "MOVING") {
        player.state = "PAUSED";
      } else if (player.state === "PAUSED") {
        player.state = "MOVING";
      }
    });

    this.onMessage("answer", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.state === "ANSWERING") {
        if (message.questionId !== player.pendingQuestionId) return; // Chặn trả lời sai phiên
        if (Date.now() > (player.questionDeadline || 0)) return; // Trễ giờ

        const q = QUESTION_BANK.find(q => q.id === message.questionId);
        if (q) {
          const isCorrect = q.correct_answer === message.choice;
          if (isCorrect) {
            player.score += (q.difficulty * 10); 
          }
          this.matchLogger.logQuestionAnswer(player.id, q.id, message.choice, isCorrect);
        }
        
        player.state = "MOVING";
        player.questionDeadline = undefined;
        player.pendingFoodId = undefined;
        player.pendingQuestionId = undefined;
        
        client.send("answerResult", { correct: q ? q.correct_answer === message.choice : false });
      }
    });

    this.setSimulationInterval((deltaTime) => {
      if (this.state.phase === 1) {
        this.update(deltaTime);
      }
    }, 50);
  }

  spawnFood() {
    const coords = this.gridManager.getRandomFreeCell();
    if (!coords) return; 

    const food = new Food();
    food.id = nanoid();
    food.x = coords.x;
    food.y = coords.y;
    
    const rand = Math.random();
    if (rand < 0.50) food.type = 1; // 50% Normal
    else if (rand < 0.65) food.type = 2; // 15% Gold
    else if (rand < 0.75) food.type = 3; // 10% Diamond
    else if (rand < 0.80) food.type = 6; // 5% Mystery Box
    else if (rand < 0.90) food.type = 5; // 10% Shield
    else food.type = 7; // 10% Attack Item

    this.state.foods.set(food.id, food);
    this.gridManager.occupy(coords.x, coords.y);
  }

  maintainFoodCount() {
    const activePlayers = Array.from(this.state.players.values()).filter(p => p.state !== "DISCONNECTED").length;
    // Tăng số lượng vật phẩm trên bản đồ để có nhiều mồi, khiên, hộp quà hơn
    // Cơ bản luôn có 20 vật phẩm, cộng thêm 3 vật phẩm cho mỗi người chơi
    let targetFoodCount = 20 + (activePlayers * 3);
    if (targetFoodCount > 60) targetFoodCount = 60; // Giới hạn tối đa 60 vật phẩm

    while (this.state.foods.size < targetFoodCount) {
      this.spawnFood();
    }
  }

  onJoin (client: Client, options: any) {
    console.log(`[GameRoom] Client ${client.sessionId} joined!`);
    const player = new Player();
    player.id = client.sessionId;
    player.name = options.name || `Player_${client.sessionId.substr(0, 4)}`;
    
    const coords = this.gridManager.getRandomFreeCell();
    if (coords) {
      player.x = coords.x;
      player.y = coords.y;
      this.gridManager.occupy(coords.x, coords.y);
    }
    
    this.state.players.set(client.sessionId, player);
    
    if (this.state.players.size === 1) {
      this.state.hostId = client.sessionId;
    }
    
    this.maintainFoodCount();
  }

  async onLeave (client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    
    console.log(`[GameRoom] Client ${client.sessionId} left! Removing player...`);
    this.freePlayerCells(player);
    this.state.players.delete(client.sessionId);

    if (this.state.hostId === client.sessionId) {
      const remainingPlayers = Array.from(this.state.players.keys());
      if (remainingPlayers.length > 0) {
        this.state.hostId = remainingPlayers[0];
      } else {
        this.state.hostId = "";
      }
    }
    
    this.maintainFoodCount();
  }

  freePlayerCells(player: Player) {
    this.gridManager.free(player.x, player.y);
    player.segments.forEach((seg: SnakeSegment) => {
      this.gridManager.free(seg.x, seg.y);
    });
  }

  update (deltaTime: number) {
    if (this.state.phase !== 1) return;

    this.elapsedTime += deltaTime;
    this.state.timeRemaining = Math.max(0, Math.floor((this.gameDuration - this.elapsedTime) / 1000));
    if (this.elapsedTime >= this.gameDuration) {
      this.endGame();
      return;
    }

    this.state.players.forEach((player) => {
      if (player.state !== "MOVING") return;
      
      player.moveAccumulator += player.speed;
      
      while (player.moveAccumulator >= 1.0) {
        const oldX = player.x;
        const oldY = player.y;

        let nextX = oldX;
        let nextY = oldY;

        switch (player.direction) {
          case 'up': nextY -= 1; break;
          case 'down': nextY += 1; break;
          case 'left': nextX -= 1; break;
          case 'right': nextX += 1; break;
        }
        
        // 1. Va chạm tường
        if (nextX < 0 || nextX >= this.gridManager.width || nextY < 0 || nextY >= this.gridManager.height) {
          if (player.hasShield) {
            player.hasShield = false;
            player.moveAccumulator = 0;
            break;
          }
          
          this.freePlayerCells(player);
          player.segments.clear();
          
          const spawnCoords = this.gridManager.getRandomFreeCell();
          if (spawnCoords) {
            player.x = spawnCoords.x;
            player.y = spawnCoords.y;
            this.gridManager.occupy(spawnCoords.x, spawnCoords.y);
          }
          player.moveAccumulator = 0;
          break; 
        }

        // 2. Tạo đốt thân ở vị trí cũ của đầu
        const newSeg = new SnakeSegment();
        newSeg.x = oldX;
        newSeg.y = oldY;
        player.segments.unshift(newSeg); // Thêm vào đầu mảng thân

        // 3. Tính toán độ dài chuẩn (Dựa vào điểm)
        // Cứ 10 điểm = 1 đốt. Mới vào có 0 đốt.
        const targetLength = Math.floor(player.score / 10);
        
        // 4. Va chạm Mồi & Rắn
        let isFood = false;
        let eatenFoodId: string | null = null;
        this.state.foods.forEach((food) => {
          if (food.x === nextX && food.y === nextY) {
            isFood = true;
            eatenFoodId = food.id;
          }
        });

        if (!isFood && this.gridManager.isOccupied(nextX, nextY)) {
          let hitStunnableSnake = false;
          this.state.players.forEach(p => {
            if (p.id === player.id) return; // isSelf -> ignore
            if (p.state === "ANSWERING" || p.state === "PAUSED") return; // ghost -> ignore
            
            if (p.x === nextX && p.y === nextY) hitStunnableSnake = true;
            p.segments.forEach((seg: SnakeSegment) => {
              if (seg.x === nextX && seg.y === nextY) hitStunnableSnake = true;
            });
          });

          if (hitStunnableSnake) {
            // It's another active snake!
            if (player.hasShield) {
              player.hasShield = false;
              player.moveAccumulator = 0;
              break;
            }
            
            // Revert the head we just added
            const headToRemove = player.segments.shift(); 
            if (headToRemove) {
              player.x = oldX;
              player.y = oldY;
            }
            
            player.state = "STUNNED";
            player.stunnedUntil = Date.now() + 2000;
            player.moveAccumulator = 0;
            break; // Stop moving
          }
        }

        // 5. Cập nhật mảng thân (Xóa đuôi nếu cần) - CHỈ LÀM KHI KHÔNG BỊ STUN
        if (player.segments.length > targetLength) {
          const tail = player.segments.pop();
          if (tail) {
            this.gridManager.free(tail.x, tail.y);
          }
        }

        // Cập nhật tọa độ mới cho đầu rắn nếu không va chạm rắn (hoặc tự cắn mình)
        player.x = nextX;
        player.y = nextY;
        this.gridManager.occupy(nextX, nextY);

        if (eatenFoodId) {
          const food = this.state.foods.get(eatenFoodId);
          if (food) {
            this.state.foods.delete(eatenFoodId);
            this.gridManager.free(food.x, food.y);
            this.maintainFoodCount();
            
            // Types 1, 2, 3 are normal foods (require questions)
            if (food.type <= 3) {
              this.matchLogger.logFoodCollected(player.id);
              const question = getRandomQuestion(food.type, this.usedQuestionIds);
              
              if (question) {
                this.usedQuestionIds.add(question.id);
                
                player.state = "ANSWERING";
                
                player.pendingFoodId = food.id;
                player.pendingQuestionId = question.id;
                player.questionDeadline = Date.now() + 10000;
                player.moveAccumulator = 0;
                
                const clientObj = this.clients.find(c => c.sessionId === player.id);
                if (clientObj) {
                  clientObj.send("questionStarted", {
                    questionId: question.id,
                    question: question.question,
                    options: question.options,
                    type: food.type, 
                    deadline: player.questionDeadline 
                  });
                }
                break; 
              }
            } 
            // Types 4, 5, 6 are instant items
            else {
              let appliedEffect = food.type;
              
              // Mystery Box (type 6) randomizes the effect
              if (appliedEffect === 6) {
                const r = Math.random();
                if (r < 0.33) { player.score += 10; appliedEffect = 0; } // 10 pts
                else if (r < 0.66) { player.score += 20; appliedEffect = 0; } // 20 pts
                else appliedEffect = 5; // Shield
              }
              
              // Shield (type 5)
              if (appliedEffect === 5) {
                player.hasShield = true;
                player.shieldUntil = Date.now() + 30000;
              }
              
              // Attack (type 7)
              if (appliedEffect === 7) {
                const otherPlayers = Array.from(this.state.players.values()).filter(p => p.id !== player.id && p.state !== "DISCONNECTED");
                if (otherPlayers.length > 0) {
                  const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
                  let damage = 20;
                  let blocked = false;
                  
                  if (target.hasShield) {
                    target.hasShield = false;
                    target.shieldUntil = undefined;
                    blocked = true;
                    damage = 0;
                  } else {
                    target.score = Math.max(0, target.score - damage);
                  }
                  
                  this.broadcast("playerAttacked", { attackerId: player.id, targetId: target.id, blocked, damage });
                }
              }
              
              const clientObj = this.clients.find(c => c.sessionId === player.id);
              if (clientObj) {
                clientObj.send("itemCollected", { effectType: appliedEffect });
              }
            }
          }
        }
        
        player.moveAccumulator -= 1.0;
      }
    });

    const now = Date.now();
    this.state.players.forEach((player) => {
      // Xử lý hết giờ câu hỏi
      if (player.state === "ANSWERING" && player.questionDeadline && now > player.questionDeadline) {
        player.state = "MOVING";
        player.questionDeadline = undefined;
        player.pendingFoodId = undefined;
        player.pendingQuestionId = undefined;
        const clientObj = this.clients.find(c => c.sessionId === player.id);
        if (clientObj) {
          clientObj.send("timeUp");
        }
      }

      // Xử lý hết thời gian STUN
      if (player.state === "STUNNED" && player.stunnedUntil && now > player.stunnedUntil) {
        player.state = "MOVING";
        player.stunnedUntil = undefined;
      }

      // Xử lý hết thời gian Speed Boost
      if (player.speedBoostUntil && now > player.speedBoostUntil) {
        player.speed = 0.25;
        player.speedBoostUntil = undefined;
      }
      
      // Xử lý hết thời gian Khiên
      if (player.hasShield && player.shieldUntil && now > player.shieldUntil) {
        player.hasShield = false;
        player.shieldUntil = undefined;
      }
    });
  }

  async endGame() {
    this.state.phase = 2;
    console.log("[GameRoom] Match ended! Processing final stats...");
    
    const finalPlayers = Array.from(this.state.players.values()).map(p => ({
      id: p.id,
      score: p.score
    }));
    
    // Save to DB and get final stats
    const stats = await this.matchLogger.finalizeAndSave(finalPlayers);

    this.broadcast("matchEnded", { stats: stats.matchPlayers });
    this.disconnect();
  }
}
