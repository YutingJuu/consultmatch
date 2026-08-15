import React, { useState, useEffect } from "react";
import axios from "axios";
import ScoreBadge from "./ScoreBadge";
import CVTailor from "./CVTailor";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function ConsultantView({ consultantId, customProfile }) {
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);         // all projects (unscored)
  const [recommendations, setRecommendations] = useState([]); // scored + ranked
  const [ranked, setRanked] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [tab, setTab] = useState("browse");
  const [scoresUnlocked, setScoresUnlocked] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  const [applyingTo, setApplyingTo] = useState(null);

  const isCustom = !!customProfile;

  useEffect(() => {
    if (isCustom) {
      // Custom profile — load all projects unscored first
      setProfile(customProfile);
      axios.get(`${API}/projects`).then(r => setProjects(r.data));
    } else {
      // Existing profile — load scored recommendations immediately
      axios.get(`${API}/consultants/${consultantId}`).then(r => setProfile(r.data));
      axios.get(`${API}/consultants/${consultantId}/recommendations`).then(r => {
        setRecommendations(r.data);
        setScoresUnlocked(true);
      });
      axios.get(`${API}/consultants/${consultantId}/rankings`).then(r => {
        if (r.data.ranked_ids?.length) {
          setRanked(r.data.ranked_ids);
          setSubmitted(true);
        }
      });
    }
  }, [consultantId, isCustom]);

  const unlockScores = async () => {
    setLoadingScores(true);
    try {
      // Score each project against custom profile
      const scored = await Promise.all(
        projects.map(async (p) => {
          const r = await axios.post(`${API}/score/custom`, {
            consultant: customProfile,
            project_id: p.id,
          });
          return { ...p, score: r.data };
        })
      );
      const sorted = scored.sort((a, b) => b.score.total - a.score.total);
      setRecommendations(sorted);
      setScoresUnlocked(true);
    } finally {
      setLoadingScores(false);
    }
  };

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
    const id = isCustom ? "CUSTOM" : consultantId;
    await axios.post(`${API}/consultants/rankings`, { id, ranked_ids: ranked });
    setSubmitted(true);
  };

  if (!profile) return <div className="loading">Loading...</div>;

  // List to display in browse tab
  const displayList = scoresUnlocked ? recommendations : projects;

  return (
    <div className="view-container">

      {/* Profile completeness banner for custom users */}
      {isCustom && !scoresUnlocked && (
        <div className="unlock-banner">
          <div className="unlock-banner-left">
            <span className="unlock-icon">🔒</span>
            <div>
              <strong>Profile complete! Unlock your compatibility scores</strong>
              <p>You're seeing all available projects. Click below to see how well each one matches your profile.</p>
            </div>
          </div>
          <button
            className="unlock-btn"
            onClick={unlockScores}
            disabled={loadingScores}
          >
            {loadingScores ? "Calculating..." : "✨ Unlock My Scores"}
          </button>
        </div>
      )}

      {/* Profile card */}
      <div className="profile-card">
        <div className="profile-header">
          <div>
            <h2>{profile.name}</h2>
            <span className="tag">{profile.level}</span>
            <span className="tag tag-secondary">L{profile.seniority}</span>
            {isCustom && <span className="tag tag-new">Your Profile</span>}
          </div>
          <div className="profile-meta">
            <span>📅 Available {profile.available_from}</span>
            <span>🏠 {profile.wfh_preference}</span>
            <span>🎯 {profile.career_goal?.replace("_", " ")}</span>
          </div>
        </div>
        <div className="skills-row">
          {profile.skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
        </div>
        <div className="pref-row">
          <span>Industries: {profile.preferred_industries?.join(", ")}</span>
          <span>Style: {profile.work_style}</span>
          <span>Duration: {profile.preferred_duration}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={tab === "browse" ? "tab active" : "tab"} onClick={() => setTab("browse")}>
          🔍 Browse Projects ({displayList.length})
          {scoresUnlocked && <span className="tab-badge">Scored</span>}
        </button>
        <button className={tab === "rank" ? "tab active" : "tab"} onClick={() => setTab("rank")}>
          📝 My Preferences {ranked.length > 0 ? `(${ranked.length})` : ""}
        </button>
      </div>

      {tab === "browse" && (
        <div className="card-list">
          {!scoresUnlocked && (
            <div className="unscored-notice">
              <span>📋</span>
              <span>Showing all {projects.length} available projects. Complete your profile setup to see compatibility scores and personalised rankings.</span>
            </div>
          )}

          {displayList.map((p, i) => (
            <div key={p.id} className={`project-card ${ranked.includes(p.id) ? "selected" : ""}`}>
              <div className="card-top">
                <div>
                  {scoresUnlocked && <span className="rank-num">#{i + 1}</span>}
                  <strong>{p.name}</strong>
                  <span className="card-client">{p.client}</span>
                </div>
                {scoresUnlocked && p.score
                  ? <ScoreBadge score={p.score.total} />
                  : <div className="score-locked">🔒 Score locked</div>
                }
              </div>

              <div className="card-meta">
                <span>🏭 {p.industry}</span>
                <span>📍 {p.location}</span>
                <span>🏠 {p.wfh_policy}</span>
                <span>⏱ {p.duration}</span>
                <span>👥 {p.team_size} people</span>
              </div>

              {scoresUnlocked && p.score && (
                <>
                  <div className="score-breakdown">
                    <span>Skills {p.score.breakdown.skills}/40</span>
                    <span>Preferences {p.score.breakdown.preference}/40</span>
                    <span>Seniority {p.score.breakdown.seniority}/20</span>
                  </div>

                  {/* Per-skill breakdown */}
                  <div className="skill-match-row">
                    {p.required_skills.map(s => {
                      const matched = p.score.matched_skills.includes(s.toLowerCase());
                      return (
                        <span key={s} className={`skill-match-chip ${matched ? "match" : "no-match"}`}>
                          {matched ? "✅" : "❌"} {s}
                        </span>
                      );
                    })}
                  </div>

                  <div className="card-flags">
                    {p.score.industry_match && <span className="flag green">✓ Industry fit</span>}
                    {p.score.wfh_match && <span className="flag green">✓ WFH match</span>}
                    {p.score.style_match && <span className="flag green">✓ Work style match</span>}
                    {p.score.duration_match && <span className="flag green">✓ Duration match</span>}
                    {!p.score.industry_match && <span className="flag grey">✗ Industry mismatch</span>}
                    {!p.score.wfh_match && <span className="flag grey">✗ WFH mismatch</span>}
                  </div>
                </>
              )}

              <p className="card-desc">{p.description}</p>

              <button
                className={`select-btn ${ranked.includes(p.id) ? "selected" : ""}`}
                onClick={() => toggleRank(p.id)}
                disabled={submitted}
              >
                {ranked.includes(p.id) ? "✓ Added to preferences" : "+ Add to preferences"}
              </button>
              <button
                className="apply-btn"
                onClick={() => setApplyingTo(p)}
              >
                📄 Apply to this Role
              </button>
            </div>
          ))}
        </div>
      )}

      {applyingTo && (
        <CVTailor
          project={applyingTo}
          consultantProfile={profile}
          onClose={() => setApplyingTo(null)}
        />
      )}

      {tab === "rank" && !submitted && (
        <div className="rank-panel">
          <h3>Your Preference Ranking</h3>
          <p className="rank-hint">Order your preferred projects. #1 is your top choice.</p>

          {ranked.length === 0 && (
            <p className="empty-msg">No projects added yet. Browse and add from the Browse tab.</p>
          )}

          <div className="rank-list">
            {ranked.map((pid, idx) => {
              const p = displayList.find(r => r.id === pid);
              if (!p) return null;
              return (
                <div key={pid} className="rank-item">
                  <span className="rank-pos">{idx + 1}</span>
                  <div className="rank-info">
                    <strong>{p.name}</strong>
                    <span>{p.client} · {p.industry}</span>
                  </div>
                  {scoresUnlocked && p.score && <ScoreBadge score={p.score.total} small />}
                  <div className="rank-controls">
                    <button onClick={() => moveUp(pid)}>▲</button>
                    <button onClick={() => moveDown(pid)}>▼</button>
                    <button onClick={() => toggleRank(pid)} className="remove-btn">✕</button>
                  </div>
                </div>
              );
            })}
          </div>

          {ranked.length > 0 && (
            <button className="submit-btn" onClick={submitRanking}>
              Submit Preferences →
            </button>
          )}
        </div>
      )}

      {tab === "rank" && submitted && (
        <div className="confirmation-screen">
          <div className="confirmation-icon">✅</div>
          <h3>Preferences Submitted!</h3>
          <p>Your project preferences have been recorded successfully.</p>

          <div className="confirmation-list">
            <p className="confirmation-list-title">Your ranked preferences:</p>
            {ranked.map((pid, idx) => {
              const p = displayList.find(r => r.id === pid);
              if (!p) return null;
              return (
                <div key={pid} className="confirmation-item">
                  <span className="rank-pos">{idx + 1}</span>
                  <div className="rank-info">
                    <strong>{p.name}</strong>
                    <span>{p.client} · {p.industry}</span>
                  </div>
                  {scoresUnlocked && p.score && <ScoreBadge score={p.score.total} small />}
                </div>
              );
            })}
          </div>

          <div className="confirmation-next">
            <div className="next-step-badge">📬 What happens next?</div>
            <p>
              Your profile and project preferences are now visible to project managers
              and the staffing team. You will be notified if a project team expresses
              interest in your profile.
            </p>
            <p className="confirmation-note">
              In the meantime, you can continue browsing projects and update your
              preferences at any time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
