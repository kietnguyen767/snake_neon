export interface MatchPlayer {
  userId: string;
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  foodsCollected: number;
  rank: number;
}

interface MatchEndOverlayProps {
  stats: MatchPlayer[];
  onClose: () => void;
}

export default function MatchEndOverlay({ stats, onClose }: MatchEndOverlayProps) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      background: "rgba(10, 10, 12, 0.9)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      display: "flex", justifyContent: "center", alignItems: "center",
      zIndex: 1000
    }}>
      <div className="glass-panel" style={{
        padding: "var(--spacing-lg)",
        width: "700px", maxWidth: "90vw",
        display: "flex", flexDirection: "column", gap: "var(--spacing-md)"
      }}>
        
        <div style={{ textAlign: "center", marginBottom: "var(--spacing-sm)" }}>
          <h2 className="display-lg-mobile" style={{ margin: 0, color: "var(--secondary-container)", textTransform: "uppercase", textShadow: "var(--glow-secondary)" }}>
            Match Ended
          </h2>
          <p className="body-md" style={{ margin: "8px 0 0 0", color: "var(--on-surface-variant)" }}>
            Data has been saved to the database.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="label-caps" style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: "16px", padding: "0 16px", color: "var(--on-surface-variant)" }}>
            <span>Rank</span>
            <span>Player ID</span>
            <span style={{ textAlign: "right" }}>Score</span>
            <span style={{ textAlign: "right" }}>Right / Wrong</span>
          </div>
          
          {stats.map((p) => {
            const isFirst = p.rank === 1;
            return (
              <div key={p.userId} className="glass-card" style={{
                display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: "16px", alignItems: "center",
                background: isFirst ? "rgba(57, 255, 20, 0.1)" : "rgba(255, 255, 255, 0.03)",
                border: isFirst ? "1px solid var(--primary-container)" : "1px solid rgba(255, 255, 255, 0.05)",
                padding: "16px",
                boxShadow: isFirst ? "var(--glow-primary)" : "none"
              }}>
                <span className="headline-md" style={{ color: isFirst ? "var(--primary-container)" : "var(--on-surface)" }}>
                  #{p.rank}
                </span>
                <span className="score-display" style={{ fontSize: "14px", color: isFirst ? "#fff" : "var(--on-surface-variant)", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.userId}
                </span>
                <span className="score-display" style={{ color: isFirst ? "var(--primary-container)" : "var(--secondary-container)", textAlign: "right" }}>
                  {p.score}
                </span>
                <span className="score-display" style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", textAlign: "right" }}>
                  <span style={{ color: "var(--primary-container)" }}>{p.correctAnswers}</span> / <span style={{ color: "var(--error)" }}>{p.wrongAnswers}</span>
                </span>
              </div>
            );
          })}
        </div>
        
        <button 
          onClick={onClose}
          className="btn-primary"
          style={{ marginTop: "var(--spacing-sm)", width: "100%" }}
        >
          Return to Lobby
        </button>

      </div>
    </div>
  );
}
