import React, { useState, useEffect } from "react";
import axios from "axios";
import ScoreBadge from "./ScoreBadge";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function ConsultantView({ consultantId }) {
  const [profile, setProfile] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [ranked, setRanked] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [tab, setTab] = useState("browse");

  useEffect(() => {
    axios.get(`${API}/consultants/${consultantId}`).then(r => setProfile(r.data));
    axios.get(`${API}/consultants/${consultantId}/recommendations`).then(r => {
      setRecommendations(r.data);
    });
    axios.get(`${API}/consultants/${consultantId}/rankings`).then(r => {
      if (r.data.ranked_ids?.length) {
        setRanked(r.data.ranked_ids);
        setSubmitted(true);
      }
    });
  }, [consultantId]);

  const toggleRank = (pid) => {
    if (submitted) return;
    setRanked(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  };

  const moveUp = (pid) => {
    const idx = ranked.indexOf(pid);
    if (idx <= 0) return;
    const next = [...ranked];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setRanked(next);
  };

  const moveDown = (pid) => {
    const idx = ranked.indexOf(pid);
    if (idx < 0 || idx >= ranked.length - 1) return;
    const next = [...ranked];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setRanked(next);
  };

  const submitRanking = async () => {
    await axios.post(`${API}/consultants/rankings`, {
      id: consultantId,
      ranked_ids: ranked,
    });
    setSubmitted(true);
  };

  if (!profile) return <div className="loading">Loading...</div>;

  return (
    <div className="view-container">
      {/* Profile card */}
      <div className="profile-card">
        <div className="profile-header">
          <div>
            <h2>{profile.name}</h2>
            <span className="tag">{profile.level}</span>
            <span className="tag tag-secondary">Seniority L{profile.seniority}</span>
          </div>
          <div className="profile-meta">
            <span>📅 Available {profile.available_from}</span>
            <span>🏠 {profile.wfh_preference}</span>
            <span>🎯 {profile.career_goal.replace("_", " ")}</span>
          </div>
        </div>
        <div className="skills-row">
          {profile.skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
        </div>
        <div className="pref-row">
          <span>Preferred industries: {profile.preferred_industries.join(", ")}</span>
          <span>Work style: {profile.work_style}</span>
          <span>Duration: {profile.preferred_duration}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={tab === "browse" ? "tab active" : "tab"} onClick={() => setTab("browse")}>
          🔍 Browse Projects ({recommendations.length})
        </button>
        <button className={tab === "rank" ? "tab active" : "tab"} onClick={() => setTab("rank")}>
          📝 My Preferences {ranked.length > 0 ? `(${ranked.length} selected)` : ""}
        </button>
      </div>

      {tab === "browse" && (
        <div className="card-list">
          {recommendations.map((p, i) => (
            <div key={p.id} className={`project-card ${ranked.includes(p.id) ? "selected" : ""}`}>
              <div className="card-top">
                <div>
                  <span className="rank-num">#{i + 1}</span>
                  <strong>{p.name}</strong>
                  <span className="card-client">{p.client}</span>
                </div>
                <ScoreBadge score={p.score.total} />
              </div>

              <div className="card-meta">
                <span>🏭 {p.industry}</span>
                <span>📍 {p.location}</span>
                <span>🏠 {p.wfh_policy}</span>
                <span>⏱ {p.duration}</span>
                <span>👥 {p.team_size} people</span>
              </div>

              <div className="score-breakdown">
                <span>Skills {p.score.breakdown.skills}/40</span>
                <span>Preferences {p.score.breakdown.preference}/40</span>
                <span>Seniority {p.score.breakdown.seniority}/20</span>
              </div>

              {p.score.matched_skills.length > 0 && (
                <div className="matched-skills">
                  ✅ Matched: {p.score.matched_skills.join(", ")}
                </div>
              )}

              <div className="card-flags">
                {p.score.industry_match && <span className="flag green">✓ Industry fit</span>}
                {p.score.wfh_match && <span className="flag green">✓ WFH match</span>}
                {p.score.style_match && <span className="flag green">✓ Work style match</span>}
                {p.score.duration_match && <span className="flag green">✓ Duration match</span>}
                {!p.score.industry_match && <span className="flag grey">✗ Industry mismatch</span>}
                {!p.score.wfh_match && <span className="flag grey">✗ WFH mismatch</span>}
              </div>

              <p className="card-desc">{p.description}</p>

              {!submitted && (
                <button
                  className={`select-btn ${ranked.includes(p.id) ? "selected" : ""}`}
                  onClick={() => toggleRank(p.id)}
                >
                  {ranked.includes(p.id) ? "✓ Added to preferences" : "+ Add to preferences"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "rank" && (
        <div className="rank-panel">
          <h3>Your Preference Ranking</h3>
          <p className="rank-hint">
            {submitted
              ? "✅ Preferences submitted. Waiting for matching to run."
              : "Drag or use arrows to reorder. Your top choice is first."}
          </p>

          {ranked.length === 0 && (
            <p className="empty-msg">No projects added yet. Browse and add projects from the Browse tab.</p>
          )}

          <div className="rank-list">
            {ranked.map((pid, idx) => {
              const p = recommendations.find(r => r.id === pid);
              if (!p) return null;
              return (
                <div key={pid} className="rank-item">
                  <span className="rank-pos">{idx + 1}</span>
                  <div className="rank-info">
                    <strong>{p.name}</strong>
                    <span>{p.client} · {p.industry}</span>
                  </div>
                  <ScoreBadge score={p.score.total} small />
                  {!submitted && (
                    <div className="rank-controls">
                      <button onClick={() => moveUp(pid)}>▲</button>
                      <button onClick={() => moveDown(pid)}>▼</button>
                      <button onClick={() => toggleRank(pid)} className="remove-btn">✕</button>
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
        </div>
      )}
    </div>
  );
}
