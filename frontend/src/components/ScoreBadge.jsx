import React from "react";

export default function ScoreBadge({ score, small }) {
  const color =
    score >= 70 ? "#16a34a" :
    score >= 45 ? "#d97706" :
    "#dc2626";

  if (small) {
    return (
      <div style={{
        width: "44px", height: "44px", borderRadius: "50%",
        background: color, color: "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "14px", fontWeight: "700", flexShrink: 0,
      }}>
        {Math.round(score)}
      </div>
    );
  }

  // Consultant view — larger with label
  const label = score >= 70 ? "HIGH" : score >= 45 ? "MED" : "LOW";
  return (
    <div className="score-badge" style={{ borderColor: color, color }}>
      <span className="score-num">{Math.round(score)}</span>
      <span className="score-label" style={{ color }}>{label} MATCH</span>
    </div>
  );
}
