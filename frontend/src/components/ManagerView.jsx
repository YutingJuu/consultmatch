import React, { useState, useEffect } from "react";
import axios from "axios";
import ScoreBadge from "./ScoreBadge";
import MatchResults from "./MatchResults";

const API = "http://localhost:8000";

export default function ManagerView({ projectId }) {
  const [project, setProject] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [ranked, setRanked] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [tab, setTab] = useState("browse");
  const [matchResults, setMatchResults] = useState(null);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    axios.get(`${API}/projects/${projectId}`).then(r => setProject(r.data));
    axios.get(`${API}/projects/${projectId}/recommendations`).then(r => {
      setRecommendations(r.data);
    });
    axios.get(`${API}/projects/${projectId}/rankings`).then(r => {
      if (r.data.ranked_ids?.length) {
        setRanked(r.data.ranked_ids);
        setSubmitted(true);
      }
    });
    // Check if results already exist
    axios.get(`${API}/match/results`).catch(() => {});
  }, [projectId]);

  const toggleRank = (cid) => {
    if (submitted) return;
    setRanked(prev =>
      prev.includes(cid) ? prev.filter(id => id !== cid) : [...prev, cid]
    );
  };

  const moveUp = (cid) => {
    const idx = ranked.indexOf(cid);
    if (idx <= 0) return;
    const next = [...ranked];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setRanked(next);
  };

  const moveDown = (cid) => {
    const idx = ranked.indexOf(cid);
    if (idx < 0 || idx >= ranked.length - 1) return;
    const next = [...ranked];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setRanked(next);
  };

  const submitRanking = async () => {
    await axios.post(`${API}/projects/rankings`, {
      id: projectId,
      ranked_ids: ranked,
    });
    setSubmitted(true);
  };

  const runMatching = async () => {
    setMatching(true);
    try {
      const r = await axios.post(`${API}/match`);
      setMatchResults(r.data);
      setTab("results");
    } finally {
      setMatching(false);
    }
  };

  const resetAll = async () => {
    await axios.post(`${API}/match/reset`);
    setMatchResults(null);
    setSubmitted(false);
    setRanked([]);
    setTab("browse");
  };

  if (!project) return <div className="loading">Loading...</div>;

  return (
    <div className="view-container">
      {/* Project card */}
      <div className="profile-card">
        <div className="profile-header">
          <div>
            <h2>{project.name}</h2>
            <span className="tag">{project.client}</span>
            <span className="tag tag-secondary">{project.industry}</span>
          </div>
          <div className="profile-meta">
            <span>📅 {project.duration}</span>
            <span>🏠 {project.wfh_policy}</span>
            <span>👥 Team of {project.team_size}</span>
            <span>📍 {project.location}</span>
          </div>
        </div>
        <div className="skills-row">
          {project.required_skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
        </div>
        <p className="card-desc">{project.description}</p>
        <div className="pref-row">
          <span>Preferred style: {project.preferred_work_style}</span>
          <span>Seniority: L{project.seniority_required}+</span>
          <span>Manager: {project.manager_name}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={tab === "browse" ? "tab active" : "tab"} onClick={() => setTab("browse")}>
          🔍 Browse Consultants ({recommendations.length})
        </button>
        <button className={tab === "rank" ? "tab active" : "tab"} onClick={() => setTab("rank")}>
          📝 My Preferences {ranked.length > 0 ? `(${ranked.length})` : ""}
        </button>
        <button className={tab === "results" ? "tab active" : "tab"} onClick={() => setTab("results")}>
          🎯 Match Results {matchResults ? `(${matchResults.summary.matched_count} matched)` : ""}
        </button>
      </div>

      {tab === "browse" && (
        <div className="card-list">
          {recommendations.map((c, i) => (
            <div key={c.id} className={`project-card ${ranked.includes(c.id) ? "selected" : ""}`}>
              <div className="card-top">
                <div>
                  <span className="rank-num">#{i + 1}</span>
                  <strong>{c.name}</strong>
                  <span className="card-client">{c.level} · L{c.seniority}</span>
                </div>
                <ScoreBadge score={c.score.total} />
              </div>

              <div className="card-meta">
                <span>🎯 {c.career_goal.replace("_", " ")}</span>
                <span>🏠 {c.wfh_preference}</span>
                <span>⚙️ {c.work_style}</span>
                <span>⏱ {c.preferred_duration}</span>
              </div>

              <div className="score-breakdown">
                <span>Skills {c.score.breakdown.skills}/40</span>
                <span>Preferences {c.score.breakdown.preference}/40</span>
                <span>Seniority {c.score.breakdown.seniority}/20</span>
              </div>

              {c.score.matched_skills.length > 0 && (
                <div className="matched-skills">
                  ✅ Matched: {c.score.matched_skills.join(", ")}
                </div>
              )}

              <div className="card-flags">
                {c.score.industry_match && <span className="flag green">✓ Industry fit</span>}
                {c.score.wfh_match && <span className="flag green">✓ WFH match</span>}
                {c.score.style_match && <span className="flag green">✓ Work style match</span>}
                {c.score.duration_match && <span className="flag green">✓ Duration match</span>}
                {!c.score.wfh_match && <span className="flag grey">✗ WFH mismatch</span>}
              </div>

              <div className="skills-row" style={{marginTop: "8px"}}>
                {c.skills.map(s => (
                  <span key={s} className={`skill-chip ${project.required_skills.includes(s) ? "matched" : ""}`}>
                    {s}
                  </span>
                ))}
              </div>

              {!submitted && (
                <button
                  className={`select-btn ${ranked.includes(c.id) ? "selected" : ""}`}
                  onClick={() => toggleRank(c.id)}
                >
                  {ranked.includes(c.id) ? "✓ Added to preferences" : "+ Add to preferences"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "rank" && (
        <div className="rank-panel">
          <h3>Your Consultant Preference Ranking</h3>
          <p className="rank-hint">
            {submitted
              ? "✅ Preferences submitted."
              : "Order your preferred consultants. #1 is your top choice."}
          </p>

          {ranked.length === 0 && (
            <p className="empty-msg">No consultants added yet. Browse and add from the Browse tab.</p>
          )}

          <div className="rank-list">
            {ranked.map((cid, idx) => {
              const c = recommendations.find(r => r.id === cid);
              if (!c) return null;
              return (
                <div key={cid} className="rank-item">
                  <span className="rank-pos">{idx + 1}</span>
                  <div className="rank-info">
                    <strong>{c.name}</strong>
                    <span>{c.level} · {c.preferred_industries.join(", ")}</span>
                  </div>
                  <ScoreBadge score={c.score.total} small />
                  {!submitted && (
                    <div className="rank-controls">
                      <button onClick={() => moveUp(cid)}>▲</button>
                      <button onClick={() => moveDown(cid)}>▼</button>
                      <button onClick={() => toggleRank(cid)} className="remove-btn">✕</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!submitted && ranked.length > 0 && (
            <button className="submit-btn" onClick={submitRanking}>
              Submit Preferences →
            </button>
          )}

          {submitted && !matchResults && (
            <div style={{ marginTop: "24px" }}>
              <button className="run-match-btn" onClick={runMatching} disabled={matching}>
                {matching ? "Running Gale-Shapley..." : "🎯 Run Matching Algorithm"}
              </button>
              <p className="rank-hint">This will run matching for all consultants and projects.</p>
            </div>
          )}
        </div>
      )}

      {tab === "results" && (
        <MatchResults results={matchResults} onReset={resetAll} currentProjectId={projectId} />
      )}
    </div>
  );
}
