"use client";
import { PlayerState, StoreGameState } from "@/lib/store";

import { useEffect, useState, useRef } from "react";
import * as Colyseus from "colyseus.js";
import { useGameStore } from "@/lib/store";
import QuestionOverlay from "./QuestionOverlay";
import MatchEndOverlay, { MatchPlayer } from "./MatchEndOverlay";
import BackgroundShader from "./BackgroundShader";
import { GameState } from "@/game/GameState";


import React from "react";

const PauseOverlay = React.memo(() => {
  const players = useGameStore(s => s.players);
  const room = useGameStore(s => s.room);
  
  if (!room || !players[room.sessionId] || players[room.sessionId].state !== "PAUSED") return null;
  
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

const Leaderboard = React.memo(() => {
  const players = useGameStore(s => s.players);
  const currentRoom = useGameStore(s => s.room);
  
  return (
    <Leaderboard />
  );
});

const LobbyPlayerGrid = React.memo(() => {
  const players = useGameStore(s => s.players);
  const hostId = useGameStore(s => s.hostId);
  const currentRoom = useGameStore(s => s.room);
  
  return (
    <LobbyPlayerGrid />
  );
});

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
  const playerCount = useGameStore(s => Object.keys(s.players).length);
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

      const handlePlayerAdd = (player: any, sessionId: string) => {
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
