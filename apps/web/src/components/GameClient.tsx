"use client";
import { PlayerState, StoreGameState } from "@/lib/store";

import { useEffect, useState, useRef } from "react";
import * as Colyseus from "colyseus.js";
import { useGameStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import QuestionOverlay from "./QuestionOverlay";
import MatchEndOverlay, { MatchPlayer } from "./MatchEndOverlay";
import BackgroundShader from "./BackgroundShader";
import { GameState } from "@/game/GameState";


import React from "react";

type RoomPlayerSnapshot = Pick<PlayerState, "id" | "name" | "score" | "state" | "hasShield"> & {
  onChange: (cb: () => void) => void;
};

const PauseOverlay = React.memo(() => {
  const isPaused = useGameStore(s => {
    if (!s.room) return false;
    const player = s.players[s.room.sessionId];
    return player ? player.state === "PAUSED" : false;
  });
  
  if (!isPaused) return null;
  
  return (
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
  );
});

const LeaderboardRow = React.memo(({ id, idx }: { id: string, idx: number }) => {
  const p = useGameStore(s => s.players[id]);
  const currentRoom = useGameStore(s => s.room);

  if (!p) return null;

  const isLocal = currentRoom && p.id === currentRoom.sessionId;
  let rankColor = "var(--on-surface)";
  if (idx === 0) rankColor = "#ffdb40"; // Vàng
  else if (idx === 1) rankColor = "#e5e1e4"; // Bạc
  else if (idx === 2) rankColor = "#cd7f32"; // Đồng

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 6px", background: isLocal ? "rgba(57, 255, 20, 0.16)" : "transparent", borderRadius: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
        <span style={{ color: rankColor, fontWeight: "bold", width: "18px", fontSize: "12px" }}>#{idx + 1}</span>
        <span style={{ color: isLocal ? "var(--primary)" : "var(--on-surface)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "72px", fontSize: "12px" }} title={p.name}>
          {p.name}
        </span>
        {p.hasShield && (
          <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#33ff33", textShadow: "0 0 5px #33ff33" }} title="Đang có khiên">
            shield
          </span>
        )}
      </div>
      <span style={{ color: "var(--primary)", fontWeight: "bold", fontFamily: "var(--font-jetbrains-mono)", fontSize: "12px" }}>
        {p.score}
      </span>
    </div>
  );
});

LeaderboardRow.displayName = "LeaderboardRow";

const Leaderboard = React.memo(() => {
  // Use a string hash selector to prevent rerenders unless ranking or scores actually change
  const leaderboardIds = useGameStore(s => {
    return Object.values(s.players)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(p => p.id)
      .join(",");
  });
  
  return (
    <div className="glass-panel" style={{
      position: "absolute", top: "var(--spacing-md)", right: "var(--spacing-md)",
      width: "180px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px",
      background: "rgba(19, 19, 21, 0.52)", backdropFilter: "blur(8px)", borderRadius: "var(--radius-lg)",
      border: "1px solid rgba(255,255,255,0.05)"
    }}>
      <h3 className="label-caps" style={{ margin: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "6px", color: "var(--on-surface-variant)" }}>Top 5</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {leaderboardIds ? leaderboardIds.split(",").map((id, idx) => (
          <LeaderboardRow key={id} id={id} idx={idx} />
        )) : null}
      </div>
    </div>
  );
});

Leaderboard.displayName = "Leaderboard";
PauseOverlay.displayName = "PauseOverlay";

const PlayerCard = React.memo(({ id }: { id: string }) => {
  const p = useGameStore(s => s.players[id]);
  const hostId = useGameStore(s => s.hostId);
  const currentRoom = useGameStore(s => s.room);

  if (!p) return null;

  const isHost = p.id === hostId;
  const isLocal = currentRoom && p.id === currentRoom.sessionId;

  return (
    <div className={isHost ? "glow-border" : "glass-panel"} style={{
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
        <div className="player-avatar" style={{width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", backgroundColor: isHost ? "var(--tertiary-container)" : "var(--primary-container)", color: isHost ? "var(--on-tertiary-container)" : "var(--on-primary-container)"}}>{p.name.charAt(0).toUpperCase()}</div>
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
});

PlayerCard.displayName = "PlayerCard";

const LobbyPlayerGrid = React.memo(() => {
  const playerCount = useGameStore(s => s.playerCount);
  const playerIds = useGameStore(useShallow((s) => Object.keys(s.players)));
  
  return (
    <section className="glass-panel custom-scrollbar" style={{
      width: "100%", flex: 1, margin: "var(--spacing-md) 0", overflowY: "auto",
      borderRadius: "var(--radius-xl)", padding: "var(--spacing-md)", borderTop: "1px solid rgba(255, 255, 255, 0.1)"
    }}>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--spacing-md)"
      }}>
        {playerIds.map(id => <PlayerCard key={id} id={id} />)}

        {Array.from({ length: Math.max(0, 10 - playerCount) }).map((_, idx) => (
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
  );
});

LobbyPlayerGrid.displayName = "LobbyPlayerGrid";

export default function GameClient({ roomId }: { roomId: string }) {
  const [status, setStatus] = useState("Connecting...");
  const setRoom = useGameStore(s => s.setRoom);
  const updateState = useGameStore(s => s.updateState);
  const clearStore = useGameStore(s => s.clearStore);
  const phase = useGameStore(s => s.phase);
  const hostId = useGameStore(s => s.hostId);
  const countdown = useGameStore(s => s.countdown);
  const timeRemaining = useGameStore(s => s.timeRemaining);
  const currentRoom = useGameStore(s => s.room);
  const playerCount = useGameStore(s => s.playerCount);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<{
    questionId: string;
    question: string;
    options: { a: string; b: string; c: string; d: string };
    type: number;
    deadline: number
  } | null>(null);
  const [matchStats, setMatchStats] = useState<MatchPlayer[] | null>(null);
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
        

        const Phaser = (await import("phaser")).default;
        const { gameConfig } = await import("@/game/config");

        if (!gameRef.current) {
          gameRef.current = new Phaser.Game(gameConfig);
          gameRef.current.scene.start("GameScene", { room: r });
        }
      });

            const initializedPlayers = new Set<string>();

      const handlePlayerAdd = (player: RoomPlayerSnapshot, sessionId: string) => {
        if (initializedPlayers.has(sessionId)) return;
        initializedPlayers.add(sessionId);

        useGameStore.getState().updatePlayer(sessionId, {
          id: player.id,
          name: player.name,
          score: player.score,
          state: player.state,
          hasShield: player.hasShield
        });
        
        player.onChange(() => {
          useGameStore.getState().updatePlayer(sessionId, {
            score: player.score,
            state: player.state,
            hasShield: player.hasShield
          });
        });
      };

      if (r.state.players && r.state.players.forEach) {
        r.state.players.forEach(handlePlayerAdd);
      }
      r.state.players.onAdd(handlePlayerAdd);
      
      r.state.players.onRemove((player, sessionId) => {
        useGameStore.getState().removePlayer(sessionId);
      });

      r.onStateChange((state) => {
        useGameStore.setState({
          phase: state.phase,
          countdown: state.countdown,
          timeRemaining: state.timeRemaining,
          hostId: state.hostId,
        });
      });



      r.onMessage("questionStarted", (payload) => {
        setActiveQuestion(payload);
      });

      r.onMessage("answerResult", () => {
        // Just let the overlay show the result, server will send closeQuestion later.
      });

      r.onMessage("closeQuestion", () => {
        setActiveQuestion(null);
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
        // Just let the overlay show the timeUp, server will send closeQuestion later.
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
        <div className="hud-top-left">
          <h2 className="display-lg-mobile" style={{ margin: 0, color: "var(--secondary-container)", textShadow: "var(--glow-secondary)" }}>ARENA: {roomId}</h2>
          <p className="label-caps" style={{ margin: "4px 0", color: "var(--on-surface-variant)" }}>Status: {status}</p>
          <p className="score-display" style={{ margin: "4px 0", color: "var(--primary)" }}>Players: {playerCount}</p>
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
                  {playerCount} / 20
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
            <LobbyPlayerGrid />

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
          <Leaderboard />

          {/* HUD: Paused state overlay */}
          <PauseOverlay />
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
          key={activeQuestion.questionId}
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
