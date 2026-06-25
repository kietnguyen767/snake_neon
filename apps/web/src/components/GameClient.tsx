"use client";
import { PlayerState } from "@/lib/store";

import { useEffect, useState, useRef } from "react";
import * as Colyseus from "colyseus.js";
import { useGameStore } from "@/lib/store";
import QuestionOverlay from "./QuestionOverlay";
import MatchEndOverlay from "./MatchEndOverlay";
import BackgroundShader from "./BackgroundShader";
import { GameState } from "@/game/GameState";

export default function GameClient({ roomId }: { roomId: string }) {
  const [status, setStatus] = useState("Connecting...");
  const { setRoom, updateState, clearStore, players, room: currentRoom, phase, hostId, countdown, timeRemaining } = useGameStore();
  const gameRef = useRef<Phaser.Game | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<{
    questionId: string;
    question: string;
    options: { a: string; b: string; c: string; d: string };
    type: number;
    deadline: number
  } | null>(null);
  const [matchStats, setMatchStats] = useState<{ id: string; name: string; score: number; rank: number; isMe: boolean }[] | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || "ws://localhost:2567";
    const client = new Colyseus.Client(serverUrl);
    let room: Colyseus.Room<GameState>;
    let isMounted = true;

    const playerName = typeof window !== "undefined" ? (localStorage.getItem('snakevnr_display_name') || "Player") : "Player";
    client.joinOrCreate<GameState>("game_room", { customRoomId: roomId, name: playerName }, GameState).then(async (r) => {
      if (!isMounted) {
        r.leave();
        return;
      }
      room = r;
      setRoom(room);
      setStatus("Connected!");

      r.onStateChange.once(async (state) => {
        updateState(state.toJSON());

        const Phaser = (await import("phaser")).default;
        const { gameConfig } = await import("@/game/config");

        if (!gameRef.current) {
          gameRef.current = new Phaser.Game(gameConfig);
          gameRef.current.scene.start("GameScene", { room: r });
        }
      });

      let lastUpdateTime = 0;
      r.onStateChange((state) => {
        // Immediate UI updates for critical HUD/Phase states to prevent desync
        useGameStore.setState({
          phase: state.phase,
          countdown: state.countdown,
          timeRemaining: state.timeRemaining,
          hostId: state.hostId
        });

        const now = Date.now();
        if (now - lastUpdateTime > 500) {
          // Throttle heavy dictionary operations (Scoreboard/Lobby Players) to 500ms
          updateState(state.toJSON());
          lastUpdateTime = now;
        }
      });

      let answerTimeout: NodeJS.Timeout | null = null;
      r.onMessage("questionStarted", (payload) => {
        if (answerTimeout) clearTimeout(answerTimeout);
        setActiveQuestion(payload);
      });

      r.onMessage("answerResult", () => {
        if (answerTimeout) clearTimeout(answerTimeout);
        answerTimeout = setTimeout(() => setActiveQuestion(null), 500);
      });

      r.onMessage("itemCollected", (payload) => {
        let text = "";
        if (payload.effectType === 0) text = "🎁 BẠN NHẬN ĐƯỢC: ĐIỂM THƯỞNG!";
        else if (payload.effectType === 5) text = "🛡️ BẠN NHẬN ĐƯỢC: KHIÊN BẢO VỆ!";

        if (text) {
          setToast({ message: text, visible: true });
          setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500);
        }
      });

      r.onMessage("timeUp", () => {
        setActiveQuestion(null);
      });

      r.onMessage("matchEnded", (payload) => {
        if (payload.stats) {
          setMatchStats(payload.stats);
        }
      });

      r.onMessage("playerAttacked", (data: { targetId: string, blocked: boolean, damage: number, attackerId: string }) => {
        if (data.targetId === r.sessionId && !data.blocked) {
          const attackerName = r.state.players.get(data.attackerId)?.name || "Một người chơi";
          setToast({ message: `⚠️ BẠN VỪA BỊ ${attackerName.toUpperCase()} TẤN CÔNG!`, visible: true });
          setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500);
        }
      });

    }).catch(e => {
      console.error("JOIN ERROR", e);
      setStatus("Failed to connect");
    });

    return () => {
      isMounted = false;
      if (room) room.leave();
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      clearStore();
    };
  }, [roomId, setRoom, updateState, clearStore]);

  const handleAnswerSubmit = (questionId: string, choice: string) => {
    if (currentRoom) {
      currentRoom.send("answer", { questionId, choice });
    }
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <div className="hud-container">

        {/* Top Left Info */}
        <div style={{ position: "absolute", top: "var(--spacing-md)", left: "var(--spacing-md)" }}>
          <h2 className="display-lg-mobile" style={{ margin: 0, color: "var(--secondary-container)", textShadow: "var(--glow-secondary)" }}>ARENA: {roomId}</h2>
          <p className="label-caps" style={{ margin: "4px 0", color: "var(--on-surface-variant)" }}>Status: {status}</p>
          <p className="score-display" style={{ margin: "4px 0", color: "var(--primary)" }}>Players: {Object.keys(players).length}</p>
        </div>


      </div>

      {phase === 0 && (
        <>
          <div style={{ position: "absolute", inset: 0, zIndex: 40 }}>
            <BackgroundShader />
          </div>
          <div style={{ position: "absolute", inset: 0, zIndex: 45, background: "rgba(19, 19, 21, 0.6)", backdropFilter: "blur(2px)" }}></div>

          <main style={{
            position: "absolute", inset: 0, zIndex: 50, width: "100%", height: "100%",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
            padding: "var(--spacing-md)", maxWidth: "1200px", margin: "0 auto"
          }}>
            {/* Header Section */}
            <header className="glass-panel glow-border" style={{
              width: "100%", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
              gap: "var(--spacing-md)", padding: "var(--spacing-md)", borderRadius: "var(--radius-xl)"
            }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
                  <h1 className="display-lg text-glow" style={{ color: "var(--primary)", letterSpacing: "-0.02em", margin: 0 }}>
                    PHÒNG: {roomId}
                  </h1>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(roomId);
                      setToast({ message: "ĐÃ COPY MÃ PHÒNG!", visible: true });
                      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2000);
                    }}
                    style={{
                      padding: "var(--spacing-xs)", background: "transparent", border: "none",
                      color: "var(--secondary)", cursor: "pointer", display: "flex", alignItems: "center"
                    }}
                    title="Copy Room ID"
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>content_copy</span>
                  </button>
                </div>
                <p className="body-md" style={{ color: "var(--on-surface-variant)", display: "flex", alignItems: "center", gap: "var(--spacing-xs)", margin: "4px 0 0 0" }}>
                  <span className="material-symbols-outlined" style={{ color: "var(--tertiary-container)", fontSize: "18px" }}>hourglass_empty</span>
                  Đang đợi Chủ phòng bắt đầu...
                </p>
              </div>
              <div className="glass-panel" style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "var(--spacing-xs) var(--spacing-lg)", borderRadius: "var(--radius-lg)",
                border: "1px solid rgba(57, 255, 20, 0.3)"
              }}>
                <span className="label-caps" style={{ color: "var(--on-surface-variant)" }}>Người chơi</span>
                <span className="score-display" style={{ color: "var(--primary)", fontSize: "24px" }}>
                  {Object.keys(players).length} / 20
                </span>
              </div>
            </header>

            {/* Rules Section */}
            <div className="glass-panel" style={{
              width: "100%", padding: "var(--spacing-sm) var(--spacing-md)", borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(0, 210, 253, 0.2)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--spacing-md)"
            }}>
              <h3 className="label-caps" style={{ color: "var(--secondary-container)", margin: 0 }}>Luật chơi:</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "14px", color: "var(--on-surface)" }}>
                <span><span style={{ color: "#3cd7ff", fontWeight: "bold" }}>● Xanh:</span> Thường</span>
                <span><span style={{ color: "#ffdb40", fontWeight: "bold" }}>● Vàng:</span> Khá</span>
                <span><span style={{ color: "#d84eff", fontWeight: "bold" }}>● Tím:</span> Khó</span>
                <span><span style={{ color: "#33ff33", fontWeight: "bold" }}>🛡️ Khiên:</span> Chặn đòn (30s)</span>
                <span><span style={{ color: "#ff3333", fontWeight: "bold" }}>⚔️ Kiếm:</span> Công kích</span>
                <span><span style={{ color: "#ffffff", fontWeight: "bold" }}>🎁 Hộp:</span> Ngẫu nhiên</span>
              </div>
            </div>

            {/* Player Grid Section */}
            <section className="glass-panel custom-scrollbar" style={{
              width: "100%", flex: 1, margin: "var(--spacing-md) 0", overflowY: "auto",
              borderRadius: "var(--radius-xl)", padding: "var(--spacing-md)", borderTop: "1px solid rgba(255, 255, 255, 0.1)"
            }}>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--spacing-md)"
              }}>
                {Object.values(players).map((p: PlayerState) => {
                  const isHost = p.id === hostId;
                  const isLocal = currentRoom && p.id === currentRoom.sessionId;
                  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=${isHost ? 'ffdb40' : '2ae500'}&color=${isHost ? '3a3000' : '053900'}&bold=true`;

                  return (
                    <div key={p.id} className={isHost ? "glow-border" : "glass-panel"} style={{
                      position: "relative", display: "flex", flexDirection: "column", alignItems: "center",
                      gap: "var(--spacing-sm)", padding: "var(--spacing-sm)", borderRadius: "var(--radius-lg)",
                      background: isHost ? "rgba(42, 42, 44, 0.6)" : "rgba(32, 31, 33, 0.4)",
                      border: isHost ? "1px solid rgba(57, 255, 20, 0.4)" : "1px solid transparent",
                      transition: "all 0.3s",
                      minWidth: 0
                    }}>
                      {isHost && (
                        <div style={{ position: "absolute", top: "-12px", color: "var(--tertiary-container)", filter: "drop-shadow(0 0 8px rgba(255,219,64,0.8))" }}>
                          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>crown</span>
                        </div>
                      )}
                      <div style={{
                        width: "64px", height: "64px", borderRadius: "50%", overflow: "hidden",
                        border: isHost ? "2px solid var(--primary)" : "2px solid var(--surface-variant)",
                        opacity: isHost ? 1 : 0.8,
                        flexShrink: 0
                      }}>
                        <img src={avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Avatar" />
                      </div>
                      <div style={{ textAlign: "center", width: "100%", minWidth: 0 }}>
                        <p className="body-md" title={`${p.name} ${isLocal ? "(Bạn)" : ""}`} style={{
                          color: isHost ? "var(--primary)" : "var(--on-surface)",
                          fontWeight: isHost ? "bold" : "normal",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0
                        }}>
                          {p.name} {isLocal ? "(Bạn)" : ""}
                        </p>
                        <p className="label-caps" style={{
                          color: isHost ? "var(--tertiary-container)" : "var(--on-surface-variant)", margin: 0
                        }}>
                          {isHost ? "Chủ Phòng" : "Sẵn sàng"}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Empty Slots Padding */}
                {Array.from({ length: Math.max(0, 10 - Object.keys(players).length) }).map((_, idx) => (
                  <div key={`empty-${idx}`} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: "var(--spacing-sm)", padding: "var(--spacing-sm)", borderRadius: "var(--radius-lg)",
                    border: "1px dashed rgba(60, 75, 53, 0.5)", background: "rgba(14, 14, 16, 0.2)", opacity: 0.5
                  }}>
                    <div style={{
                      width: "64px", height: "64px", borderRadius: "50%", border: "2px dashed var(--outline-variant)",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <span className="material-symbols-outlined" style={{ color: "var(--outline-variant)" }}>person_add</span>
                    </div>
                    <p className="label-caps" style={{ color: "var(--outline-variant)", margin: 0 }}>Trống</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Bottom Action Bar */}
            <footer style={{ width: "100%", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--spacing-md)" }}>
              <button onClick={() => window.location.href = "/"} className="glass-panel" style={{
                padding: "var(--spacing-sm) var(--spacing-lg)", borderRadius: "var(--radius-lg)",
                color: "var(--on-surface)", border: "1px solid rgba(255, 180, 171, 0.5)",
                background: "transparent", display: "flex", alignItems: "center", gap: "var(--spacing-sm)",
                fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: "18px", cursor: "pointer"
              }}>
                <span className="material-symbols-outlined" style={{ color: "var(--error)" }}>logout</span>
                Rời Phòng
              </button>

              {currentRoom && currentRoom.sessionId === hostId ? (
                <button className="btn-primary-glow" onClick={() => currentRoom.send("startGame")} style={{
                  flex: 1, minWidth: "250px", padding: "var(--spacing-sm) var(--spacing-xl)",
                  borderRadius: "var(--radius-lg)", background: "var(--primary-container)",
                  color: "var(--on-primary-container)", fontFamily: "var(--font-outfit)",
                  fontWeight: 700, fontSize: "24px", letterSpacing: "-0.02em",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--spacing-sm)",
                  cursor: "pointer", border: "none", textTransform: "uppercase"
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "32px", fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                  BẮT ĐẦU TRẬN ĐẤU
                </button>
              ) : (
                <div style={{ flex: 1, textAlign: "right" }}>
                  <p className="body-md" style={{ color: "var(--primary)" }}>Chỉ chủ phòng mới có thể bắt đầu!</p>
                </div>
              )}
            </footer>
          </main>
        </>
      )}

      {phase === 1 && (
        <>
          {/* HUD: Timer */}
          <div style={{
            position: "absolute", top: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 40,
            background: "rgba(10, 10, 12, 0.7)", backdropFilter: "blur(12px)",
            padding: "12px 32px", borderRadius: "9999px", border: "1px solid var(--primary-container)",
            display: "flex", alignItems: "center", gap: "12px",
            boxShadow: "var(--glow-primary)"
          }}>
            <span className="material-symbols-outlined" style={{ color: "var(--primary-container)", fontSize: "28px" }}>timer</span>
            <span style={{
              color: "var(--primary-container)", fontFamily: "var(--font-jetbrains-mono)",
              fontSize: "32px", fontWeight: "bold", letterSpacing: "2px"
            }}>
              {Math.floor(timeRemaining / 60).toString().padStart(2, '0')}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>

          {/* HUD: Leaderboard */}
          <div style={{
            position: "absolute", top: "24px", right: "24px", zIndex: 40,
            background: "rgba(10, 10, 12, 0.7)", backdropFilter: "blur(12px)",
            padding: "16px", borderRadius: "16px", border: "1px solid var(--primary-container)",
            width: "250px", display: "flex", flexDirection: "column", gap: "12px",
            boxShadow: "var(--glow-primary)"
          }}>
            <h3 className="label-caps" style={{ color: "var(--secondary-container)", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px", margin: 0 }}>
              Bảng Xếp Hạng
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
              {Object.values(players)
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map((p, idx) => {
                  const isLocal = currentRoom && p.id === currentRoom.sessionId;
                  let rankColor = "var(--on-surface)";
                  if (idx === 0) rankColor = "#ffdb40"; // Vàng
                  else if (idx === 1) rankColor = "#e5e1e4"; // Bạc
                  else if (idx === 2) rankColor = "#cd7f32"; // Đồng

                  return (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: isLocal ? "rgba(57, 255, 20, 0.2)" : "transparent", borderRadius: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                        <span style={{ color: rankColor, fontWeight: "bold", width: "20px" }}>#{idx + 1}</span>
                        <span style={{ color: isLocal ? "var(--primary)" : "var(--on-surface)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "90px" }} title={p.name}>
                          {p.name}
                        </span>
                        {p.hasShield && (
                          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#33ff33", textShadow: "0 0 5px #33ff33" }} title="Đang có khiên">
                            shield
                          </span>
                        )}
                      </div>
                      <span style={{ color: "var(--primary)", fontWeight: "bold", fontFamily: "var(--font-jetbrains-mono)" }}>
                        {p.score}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* HUD: Paused state overlay */}
          {currentRoom && players[currentRoom.sessionId] && players[currentRoom.sessionId].state === "PAUSED" && (
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 50,
              background: "rgba(0,0,0,0.8)", padding: "24px 48px", borderRadius: "24px",
              border: "2px solid var(--primary-container)", boxShadow: "var(--glow-primary)",
              textAlign: "center"
            }}>
              <h2 style={{ color: "var(--primary-container)", margin: "0 0 8px 0", fontSize: "42px", letterSpacing: "2px", textShadow: "var(--glow-primary)" }}>
                ĐÃ TẠM DỪNG
              </h2>
              <p style={{ color: "var(--on-surface)", margin: 0, fontSize: "18px" }}>
                Nhấn phím <b style={{ color: "#fff" }}>SPACE</b> để tiếp tục chơi
              </p>
            </div>
          )}
        </>
      )}

      {phase === 3 && (
        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          display: "flex", justifyContent: "center", alignItems: "center",
          background: "rgba(0, 0, 0, 0.7)", zIndex: 100
        }}>
          <h1 style={{ fontSize: "120px", color: "var(--primary-container)", textShadow: "var(--glow-primary)" }}>
            {countdown > 0 ? countdown : "GO!"}
          </h1>
        </div>
      )}

      <div id="phaser-container" style={{ width: "100%", height: "100%" }} />

      {activeQuestion && (
        <QuestionOverlay
          questionId={activeQuestion.questionId}
          question={activeQuestion.question}
          options={activeQuestion.options}
          foodType={activeQuestion.type}
          deadline={activeQuestion.deadline}
          onAnswer={handleAnswerSubmit}
        />
      )}

      {matchStats && (
        <MatchEndOverlay
          stats={matchStats}
          onClose={() => window.location.href = "/"}
        />
      )}

      {toast.visible && (
        <div style={{
          position: "absolute", top: "20%", left: "50%", transform: "translate(-50%, -50%)",
          background: "rgba(57, 255, 20, 0.2)", padding: "12px 24px", borderRadius: "24px",
          border: "1px solid var(--primary-container)", color: "var(--primary-container)",
          fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
          boxShadow: "var(--glow-primary)", zIndex: 100, pointerEvents: "none",
          animation: "fadeInOut 2.5s ease-in-out forwards"
        }}>
          {toast.message}
        </div>
      )}

      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translate(-50%, -100%); }
          15% { opacity: 1; transform: translate(-50%, -50%); }
          85% { opacity: 1; transform: translate(-50%, -50%); }
          100% { opacity: 0; transform: translate(-50%, 0%); }
        }
      `}</style>
    </div>
  );
}
