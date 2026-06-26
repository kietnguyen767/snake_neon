import Phaser from 'phaser';
import type { Room } from 'colyseus.js';
import type { PlayerState, FoodState } from '../lib/store';

export interface ColyseusPlayer extends Omit<PlayerState, "segments"> {
  segments: {
    onAdd: (cb: (seg: any, idx: number) => void) => void;
    onRemove: (cb: (seg: any, idx: number) => void) => void;
    forEach: (cb: (seg: any) => void) => void;
    length: number;
    [index: number]: any;
  };
  onChange: (cb: () => void) => void;
}

export interface ColyseusFood extends FoodState {
  onChange: (cb: () => void) => void;
}

export class GameScene extends Phaser.Scene {
  private playersHead: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private playersName: Map<string, Phaser.GameObjects.Text> = new Map();
  private playersBody: Map<string, Phaser.GameObjects.Rectangle[]> = new Map();
  private segmentRects: Map<any, Phaser.GameObjects.Rectangle> = new Map();
  private foods: Map<string, Phaser.GameObjects.GameObject> = new Map();
  private room: Room | null = null;
  private listenersAttached = false;
  
  private tileSize = 20;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { room: Room }) {
    this.room = data.room;
  }

  create() {
    const mapWidth = 100 * this.tileSize; // 2000
    const mapHeight = 100 * this.tileSize; // 2000

    this.add.grid(0, 0, mapWidth, mapHeight, this.tileSize, this.tileSize, 0x0A0A0C, 1, 0x2a2a2c, 0.5)
      .setOrigin(0, 0);
      
    // Add glowing border to show the map edges
    const border = this.add.rectangle(mapWidth/2, mapHeight/2, mapWidth, mapHeight);
    border.setStrokeStyle(4, 0x3cd7ff, 0.8);
    border.setDepth(5);
    
    // Set camera bounds to match the map size
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

        
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        if (this.room) this.room.send("togglePause");
        return;
      }

      let dir = null;
      if (event.key === 'ArrowUp' || event.key === 'w') dir = 'up';
      if (event.key === 'ArrowDown' || event.key === 's') dir = 'down';
      if (event.key === 'ArrowLeft' || event.key === 'a') dir = 'left';
      if (event.key === 'ArrowRight' || event.key === 'd') dir = 'right';
      
      if (dir && this.room) {
        this.room.send("move", { direction: dir });
      }
    });
  }

  update(_time: number, _delta: number) {
    if (!this.listenersAttached && this.room && this.room.state) {
      if (this.room.state.players) {
        console.log("[GameScene] Attaching listeners...");
        this.attachListeners();
        this.listenersAttached = true;
      }
    }
    
    if (this.listenersAttached && this.room) {
      this.playersHead.forEach((headRect, sessionId) => {
        const player = this.room!.state.players.get(sessionId);
        if (!player || player.state === "DISCONNECTED") return;
        
        const htx = player.x * this.tileSize + this.tileSize/2;
        const hty = player.y * this.tileSize + this.tileSize/2;
        if (Phaser.Math.Distance.Between(headRect.x, headRect.y, htx, hty) > this.tileSize * 1.5) {
          headRect.x = htx; headRect.y = hty;
        } else {
          headRect.x = Phaser.Math.Linear(headRect.x, htx, 0.35);
          headRect.y = Phaser.Math.Linear(headRect.y, hty, 0.35);
        }
        
        const nameText = this.playersName.get(sessionId);
        if (nameText) {
          nameText.x = headRect.x;
          nameText.y = headRect.y - 15;
        }
      });
    }
  }

  private addPlayer(player: ColyseusPlayer, sessionId: string) {
    if (this.playersHead.has(sessionId)) return;
    if (!this.sys || !this.sys.isActive() || !this.add) return;

    console.log(`[GameScene] Player Added: ${sessionId} at ${player.x}, ${player.y}`);
    const isMe = sessionId === this.room?.sessionId;
    const headColor = isMe ? 0x39ff14 : 0x00d2fd;
        
    const headRect = this.add.rectangle(
      player.x * this.tileSize + this.tileSize/2, 
      player.y * this.tileSize + this.tileSize/2, 
      this.tileSize, this.tileSize, headColor
    );
    
    headRect.setStrokeStyle(2, 0xffffff, 0.5);
    headRect.setDepth(10);
    this.playersHead.set(sessionId, headRect);
    
    const rawName = player.name || "Player";
    const displayName = rawName.length > 8 ? rawName.substring(0, 8) + "..." : rawName;
    
    const nameText = this.add.text(
      player.x * this.tileSize + this.tileSize/2, 
      player.y * this.tileSize - 10, 
      displayName,
      { fontSize: '12px', color: '#ffffff', fontFamily: 'Outfit, sans-serif', stroke: '#000000', strokeThickness: 2 }
    ).setOrigin(0.5).setDepth(20);
    this.playersName.set(sessionId, nameText);

    this.playersBody.set(sessionId, []); 
    
    if (isMe) {
      this.cameras.main.startFollow(headRect, true, 0.1, 0.1);
    }

    player.onChange(() => {
      let alpha = 1.0;
      if (player.state === "ANSWERING") alpha = 0.3;
      if (player.state === "PAUSED") alpha = 0.2;
      
      headRect.setAlpha(alpha);
      nameText.setAlpha(alpha);
      
      const currentHeadColor = player.state === "STUNNED" ? 0x888888 : headColor;
      headRect.fillColor = currentHeadColor;
      
      if (player.hasShield) {
        headRect.setStrokeStyle(4, 0x33ff33, 1); 
        if (!headRect.getData('shieldTween')) {
          const tw = this.tweens.add({
            targets: headRect,
            scale: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1
          });
          headRect.setData('shieldTween', tw);
        }
      } else {
        headRect.setStrokeStyle(2, 0xffffff, 0.5);
        if (headRect.getData('shieldTween')) {
          headRect.getData('shieldTween').stop();
          headRect.setData('shieldTween', null);
          headRect.setScale(1);
        }
      }
      
      const isVisible = player.state !== "DISCONNECTED";
      headRect.setVisible(isVisible);
      nameText.setVisible(isVisible);
      
      const bodyArr = this.playersBody.get(sessionId);
      if (bodyArr) {
        bodyArr.forEach(r => {
          r.fillColor = currentHeadColor;
          r.setAlpha(alpha * 0.8);
          r.setVisible(isVisible);
        });
      }
    });

    const bodyArr: Phaser.GameObjects.Rectangle[] = [];
    this.playersBody.set(sessionId, bodyArr);

    const renderSegment = (seg: any) => {
      if (this.segmentRects.has(seg)) return;
      const tx = seg.x * this.tileSize + this.tileSize/2;
      const ty = seg.y * this.tileSize + this.tileSize/2;
      const bodyColor = isMe ? 0x2ae500 : 0x00a8cc;
      
      const bodyRect = this.add.rectangle(tx, ty, this.tileSize * 0.9, this.tileSize * 0.9, bodyColor);
      bodyRect.setAlpha(0.8);
      bodyRect.setDepth(5);
      
      bodyArr.push(bodyRect);
      this.segmentRects.set(seg, bodyRect);
      
      seg.onChange(() => {
        bodyRect.x = seg.x * this.tileSize + this.tileSize/2;
        bodyRect.y = seg.y * this.tileSize + this.tileSize/2;
      });
    };

    if (player.segments && player.segments.forEach) {
      player.segments.forEach((seg: any) => renderSegment(seg));
    }

    player.segments.onAdd((seg: any) => renderSegment(seg));

    player.segments.onRemove((seg: any) => {
      const rect = this.segmentRects.get(seg);
      if (rect) {
        rect.destroy();
        this.segmentRects.delete(seg);
        const idx = bodyArr.indexOf(rect);
        if (idx !== -1) bodyArr.splice(idx, 1);
      }
    });
  }

  attachListeners() {
    const room = this.room;
    if (!room) return;

    // Process existing players
    if (room.state.players) {
      room.state.players.forEach((player: ColyseusPlayer, sessionId: string) => {
        this.addPlayer(player, sessionId);
      });
      // Listen for new players
      room.state.players.onAdd((player: ColyseusPlayer, sessionId: string) => {
        this.addPlayer(player, sessionId);
      });
    }

    room.state.players.onRemove((player: ColyseusPlayer, sessionId: string) => {
      const headRect = this.playersHead.get(sessionId);
      if (headRect) headRect.destroy();
      this.playersHead.delete(sessionId);
      
      const nameText = this.playersName.get(sessionId);
      if (nameText) nameText.destroy();
      this.playersName.delete(sessionId);

      
      const bodyArr = this.playersBody.get(sessionId);
      if (bodyArr) {
        bodyArr.forEach(rect => rect.destroy());
      }
      this.playersBody.delete(sessionId);
    });

    if (room.state.foods) {
      const addFood = (food: ColyseusFood, foodId: string) => {
        if (this.foods.has(foodId)) return;
        if (!this.sys || !this.sys.isActive() || !this.add) return;
        
        console.log(`[GameScene] Food Added: ${foodId} at ${food.x}, ${food.y} (Type: ${food.type})`);
        
        // Handle Emoji rendering for special items
        if (food.type === 5) { // Shield
          const emoji = this.add.text(
            food.x * this.tileSize + this.tileSize/2, 
            food.y * this.tileSize + this.tileSize/2, 
            "🛡️", { fontSize: `${this.tileSize * 0.9}px` }
          ).setOrigin(0.5);
          this.foods.set(foodId, emoji);
          return;
        } else if (food.type === 6) { // Mystery Box
          const emoji = this.add.text(
            food.x * this.tileSize + this.tileSize/2, 
            food.y * this.tileSize + this.tileSize/2, 
            "🎁", { fontSize: `${this.tileSize * 0.9}px` }
          ).setOrigin(0.5);
          this.foods.set(foodId, emoji);
          return;
        } else if (food.type === 7) { // Attack
          const emoji = this.add.text(
            food.x * this.tileSize + this.tileSize/2, 
            food.y * this.tileSize + this.tileSize/2, 
            "⚔️", { fontSize: `${this.tileSize * 0.9}px` }
          ).setOrigin(0.5);
          this.foods.set(foodId, emoji);
          return;
        }
        
        let color = 0xffffff;
        if (food.type === 1) color = 0x3cd7ff; // Normal
        else if (food.type === 2) color = 0xffdb40; // Gold
        else if (food.type === 3) color = 0xd84eff; // Diamond
        
        const circle = this.add.circle(
          food.x * this.tileSize + this.tileSize/2, 
          food.y * this.tileSize + this.tileSize/2, 
          this.tileSize/2.5, color
        );
        circle.setStrokeStyle(1, 0xffffff, 0.8);
        this.foods.set(foodId, circle);
      };

      room.state.foods.forEach(addFood);
      room.state.foods.onAdd(addFood);

      room.state.foods.onRemove((food: ColyseusFood, foodId: string) => {
        const circle = this.foods.get(foodId);
        if (circle) circle.destroy();
        this.foods.delete(foodId);
      });
    }

    room.onMessage("playerAttacked", (data: { targetId: string, blocked: boolean, damage: number, attackerId: string }) => {
      const targetHead = this.playersHead.get(data.targetId);
      if (targetHead) {
        if (data.blocked) {
          const text = this.add.text(targetHead.x, targetHead.y - 20, "BLOCKED!", {
            fontSize: '16px', color: '#33ff33', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3
          }).setOrigin(0.5).setDepth(30);
          
          this.tweens.add({
            targets: text,
            y: targetHead.y - 40,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => text.destroy()
          });

          this.tweens.add({
            targets: targetHead,
            scale: 1.5,
            duration: 150,
            yoyo: true,
            onComplete: () => targetHead.setScale(1)
          });
        } else {
          const text = this.add.text(targetHead.x, targetHead.y - 20, `-${data.damage} PTS`, {
            fontSize: '20px', color: '#ff0000', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3
          }).setOrigin(0.5).setDepth(30);
          
          this.tweens.add({
            targets: text,
            y: targetHead.y - 50,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => text.destroy()
          });

          const oldColor = targetHead.fillColor;
          targetHead.fillColor = 0xff0000;
          this.time.delayedCall(200, () => {
            if (targetHead.active) targetHead.fillColor = oldColor;
          });
        }
      }
    });
  }
}
