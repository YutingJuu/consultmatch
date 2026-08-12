import React, { useState } from "react";
import ScoreBadge from "./ScoreBadge";

export default function MatchResults({ results, onReset, currentProjectId }) {
  const [filter, setFilter] = useState("all");

  if (!results) {
    return (
      <div className="empty-msg" style={{ padding: "40px" }}>
        No results yet. Submit your preferences and run the matching algorithm.
      </div>
    );
  }

  const { matches, summary } = results;
  const matched = matches.filter(m => m.status === "matched");
  const unmatched = matches.filter(m => m.status === "unmatched");

  const displayed = filter === "unmatched" ? unmatched : matched;

  return (
    <div className="results-panel">
      {/* Summary banner */}
      <div className="results-summary">
        <div className="summary-stat">
          <span className="stat-num">{summary.matched_count}</span>
          <span className="stat-label">Matched</span>
        </div>
        <div className="summary-stat">
          <span className="stat-num">{summary.unmatched_count}</span>
          <span className="stat-label">Unmatched</span>
        </div>
        <div className="summary-stat">
          <span className="stat-num">{summary.average_compatibility_score}</span>
          <span className="stat-label">Avg Score</span>
        </div>
        <div className="summary-stat">
          <span className="stat-num">{summary.total_projects}</span>
          <span className="stat-label">Projects</span>
        </div>
      </div>

      <div className="results-note">
        Matches produced by the Gale-Shapley deferred acceptance algorithm
        (consultant-proposing). Stability guaranteed — no blocking pairs.
      </div>

      {/* Filter */}
      <div className="results-filter">
        <button className={filter === "all" ? "tab active" : "tab"} onClick={() => setFilter("all")}>
          All Matches ({matched.length})
        </button>
        <button className={filter === "unmatched" ? "tab active" : "tab"} onClick={() => setFilter("unmatched")}>
          Unmatched ({unmatched.length})
        </button>
      </div>

      {/* Match table */}
      <div className="match-table-wrapper">
        <table className="match-table">
          <thead>
            <tr>
              <th>Consultant</th>
              <th>Project</th>
              <th>Client</th>
              <th>Industry</th>
              <th>Score</th>
              <th>Skills</th>
              <th>Prefs</th>
              <th>Seniority</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(m => (
              <tr
                key={m.consultant_id}
                className={m.project_id === currentProjectId ? "highlight-row" : ""}
              >
                <td><strong>{m.consultant_name}</strong></td>
                <td>{m.project_name || <span className="unmatched-label">Unmatched</span>}</td>
                <td>{m.client || "—"}</td>
                <td>{m.industry || "—"}</td>
                <td>
                  {m.score ? <ScoreBadge score={m.score.total} small /> : "—"}
                </td>
                <td>{m.score ? `${m.score.breakdown.skills}/40` : "—"}</td>
                <td>{m.score ? `${m.score.breakdown.preference}/40` : "—"}</td>
                <td>{m.score ? `${m.score.breakdown.seniority}/20` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Score distribution */}
      {matched.length > 0 && (
        <div className="score-dist">
          <h4>Score Distribution</h4>
          <div className="dist-bars">
            {matched
              .sort((a, b) => b.score.total - a.score.total)
              .map(m => (
                <div key={m.consultant_id} className="dist-bar-row">
                  <span className="dist-name">{m.consultant_name.split(" ")[0]}</span>
                  <div className="dist-bar-bg">
                    <div
                      className="dist-bar-fill"
                      style={{ width: `${m.score.total}%` }}
                    />
                  </div>
                  <span className="dist-score">{m.score.total}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <button className="reset-btn" onClick={onReset}>
        ↺ Reset and Run Again
      </button>
    </div>
  );
}
