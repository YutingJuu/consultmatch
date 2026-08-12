import React from "react";

export default function ScoreBadge({ score, small }) {
  const color =
    score >= 70 ? "#16a34a" :
    score >= 45 ? "#d97706" :
    "#dc2626";

  const label =
    score >= 70 ? "HIGH" :
    score >= 45 ? "MED" :
    "LOW";

  if (small) {
    return (
      <span className="score-badge-small" style={{ background: color }}>
        {score}
      </span>
    );
  }

  return (
    <div className="score-badge" style={{ borderColor: color, color }}>
      <span className="score-num">{score}</span>
      <span className="score-label" style={{ color }}>{label} MATCH</span>
    </div>
  );
}
