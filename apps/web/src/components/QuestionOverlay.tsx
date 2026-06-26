import { useState, useEffect } from "react";

interface QuestionOverlayProps {
  questionId: string;
  question: string;
  options: { a: string; b: string; c: string; d: string };
  foodType: number;
  deadline: number;
  onAnswer: (questionId: string, choice: string) => void;
}

export default function QuestionOverlay({ questionId, question, options, foodType, deadline, onAnswer }: QuestionOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(10);
  const [answered, setAnswered] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, answered]);

  // Design mapping
  const themeColor = foodType === 1 ? "#3cd7ff" : foodType === 2 ? "#ffdb40" : "#d84eff";
  const glowShadow = `0 0 15px ${themeColor}40`;
  const difficulty = foodType === 1 ? "Normal" : foodType === 2 ? "Hard" : "Extreme";
  const points = foodType === 1 ? 10 : foodType === 2 ? 20 : 30;

  const handleChoice = (choice: string) => {
    if (answered) return;
    setAnswered(choice);
    onAnswer(questionId, choice);
  };

  return (
    <div className="glass-panel" style={{
      position: "absolute",
      bottom: "var(--spacing-md)",
      left: "50%",
      transform: "translateX(-50%)",
      width: "600px",
      maxWidth: "92vw",
      padding: "var(--spacing-md)",
      zIndex: 100,
    }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-sm)" }}>
        <span className="label-caps" style={{ color: themeColor, textShadow: glowShadow }}>
          +{points} XP [{difficulty}]
        </span>
        <span className="score-display" style={{ color: timeLeft <= 3 ? "var(--error)" : "var(--on-surface)" }}>
          00:{timeLeft.toString().padStart(2, '0')}
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden", marginBottom: "var(--spacing-md)" }}>
        <div style={{
          height: "100%",
          width: `${(timeLeft / 10) * 100}%`,
          background: timeLeft <= 3 ? "var(--error)" : `linear-gradient(45deg, var(--secondary-container), var(--primary-container))`,
          boxShadow: `0 0 10px ${timeLeft <= 3 ? "var(--error)" : "var(--primary-container)"}`,
          transition: "width 0.1s linear, background 0.3s ease"
        }} />
      </div>

      {/* Question */}
      <h3 className="headline-md" style={{ marginBottom: "var(--spacing-md)" }}>
        {question}
      </h3>

      {/* Answers Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {(['a', 'b', 'c', 'd'] as const).map((choice) => {
          const isSelected = answered === choice;
          return (
            <button
              key={choice}
              onClick={() => handleChoice(choice)}
              className="glass-card body-md"
              style={{
                padding: "var(--spacing-sm)",
                background: isSelected ? "rgba(57, 255, 20, 0.1)" : "rgba(42, 42, 44, 0.4)",
                border: isSelected ? "1px solid var(--primary-container)" : "1px solid rgba(255, 255, 255, 0.12)",
                color: isSelected ? "var(--primary-container)" : "var(--on-surface)",
                cursor: answered ? "default" : "pointer",
                textAlign: "left",
                boxShadow: isSelected ? "var(--glow-primary), inset 0 0 10px rgba(57,255,20,0.1)" : "none"
              }}
            >
              <strong style={{ marginRight: "12px", color: isSelected ? "var(--primary-container)" : "var(--secondary-container)", textTransform: "uppercase" }}>{choice}.</strong>
              {options[choice]}
            </button>
          )
        })}
      </div>
    </div>
  );
}
