import React, { useState, useEffect } from "react";
import axios from "axios";
import OnboardingWizard from "./OnboardingWizard";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function LoginScreen({ onLogin }) {
  const [role, setRole] = useState("landing"); // landing | consultant-choice | onboarding | existing | manager
  const [consultants, setConsultants] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedConsultantId, setSelectedConsultantId] = useState("");
  const [selectedManagerId, setSelectedManagerId] = useState("");

  useEffect(() => {
    axios.get(`${API}/consultants`).then(r => {
      setConsultants(r.data);
      if (r.data.length > 0) setSelectedConsultantId(r.data[0].id);
    });
    axios.get(`${API}/projects`).then(r => {
      setProjects(r.data);
      if (r.data.length > 0) setSelectedManagerId(r.data[0].manager_id);
    });
  }, []);

  const handleExistingLogin = () => {
    const c = consultants.find(c => c.id === selectedConsultantId);
    onLogin({ role: "consultant", id: c.id, name: c.name, isCustom: false });
  };

  const handleManagerLogin = () => {
    const p = projects.find(p => p.manager_id === selectedManagerId);
    onLogin({ role: "manager", id: p.id, name: p.manager_name });
  };

  const handleOnboardingComplete = (customProfile) => {
    onLogin({ role: "consultant", id: customProfile.id, name: customProfile.name,
               isCustom: true, profile: customProfile });
  };

  // ── Landing screen ───────────────────────────────────────────────────────
  if (role === "landing") {
    return (
      <div className="login-screen">
        <div className="login-card landing-card">
          <div className="login-logo">ConsultMatch</div>
          <p className="login-tagline">Preference-Driven Consultant Allocation</p>
          <p className="landing-desc">
            A two-sided matching system that aligns consultants and projects
            based on mutual compatibility — not just skill overlap.
          </p>
          <div className="landing-roles">
            <button className="landing-role-btn" onClick={() => setRole("consultant-choice")}>
              <span className="role-icon">👤</span>
              <span className="role-title">I'm a Consultant</span>
              <span className="role-sub">Browse projects and express preferences</span>
            </button>
            <button className="landing-role-btn" onClick={() => setRole("manager")}>
              <span className="role-icon">📋</span>
              <span className="role-title">I'm a Project Manager</span>
              <span className="role-sub">Find the right consultant for your project</span>
            </button>
          </div>
          <p className="login-note">Demo prototype · NUS MSBA Capstone 2026</p>
        </div>
      </div>
    );
  }

  // ── Consultant choice: new or existing ───────────────────────────────────
  if (role === "consultant-choice") {
    return (
      <div className="login-screen">
        <div className="login-card">
          <button className="back-btn" onClick={() => setRole("landing")}>← Back</button>
          <div className="login-logo" style={{fontSize:"20px"}}>ConsultMatch</div>
          <p className="login-tagline">How would you like to continue?</p>

          <div className="choice-cards">
            <button className="choice-card primary" onClick={() => setRole("onboarding")}>
              <span className="choice-icon">✨</span>
              <span className="choice-title">New here?</span>
              <span className="choice-sub">Fill in your profile and preferences to get personalised project matches</span>
            </button>
            <button className="choice-card" onClick={() => setRole("existing")}>
              <span className="choice-icon">🔄</span>
              <span className="choice-title">Use existing profile</span>
              <span className="choice-sub">Select a pre-filled consultant profile to explore the system</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Onboarding wizard ────────────────────────────────────────────────────
  if (role === "onboarding") {
    return (
      <OnboardingWizard
        onComplete={handleOnboardingComplete}
        onBack={() => setRole("consultant-choice")}
      />
    );
  }

  // ── Existing consultant select ────────────────────────────────────────────
  if (role === "existing") {
    return (
      <div className="login-screen">
        <div className="login-card">
          <button className="back-btn" onClick={() => setRole("consultant-choice")}>← Back</button>
          <div className="login-logo" style={{fontSize:"20px"}}>ConsultMatch</div>
          <p className="login-tagline">Select a consultant profile</p>

          <div className="login-field">
            <label>Choose profile</label>
            <select value={selectedConsultantId}
              onChange={e => setSelectedConsultantId(e.target.value)}>
              {consultants.map(c => (
                <option key={c.id} value={c.id}>{c.name} (CL{c.cl} {c.cl_title})</option>
              ))}
            </select>
          </div>

          {selectedConsultantId && (() => {
            const c = consultants.find(x => x.id === selectedConsultantId);
            if (!c) return null;
            return (
              <div className="profile-preview">
                <div className="preview-row"><span>Level</span><strong>CL{c.cl} {c.cl_title}</strong></div>
                <div className="preview-row"><span>Industries</span><strong>{c.preferred_industries.join(", ")}</strong></div>
                <div className="preview-row"><span>WFH</span><strong>{c.wfh_preference}</strong></div>
                <div className="preview-row"><span>Goal</span><strong>{c.career_goal.replace("_"," ")}</strong></div>
                <div className="preview-skills">
                  {c.skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
                </div>
              </div>
            );
          })()}

          <button className="login-btn" onClick={handleExistingLogin}>
            Enter as this consultant →
          </button>
        </div>
      </div>
    );
  }

  // ── Manager login ────────────────────────────────────────────────────────
  if (role === "manager") {
    const selectedProject = projects.find(x => x.manager_id === selectedManagerId);
    return (
      <div className="login-screen">
        <div className="login-card">
          <button className="back-btn" onClick={() => setRole("landing")}>← Back</button>
          <div className="login-logo" style={{fontSize:"20px"}}>ConsultMatch</div>
          <p className="login-tagline">Select your project</p>

          <div className="login-field">
            <label>Your project</label>
            <select value={selectedManagerId}
              onChange={e => setSelectedManagerId(e.target.value)}>
              {projects.map(p => (
                <option key={p.manager_id} value={p.manager_id}>
                  {p.manager_name} — {p.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div className="profile-preview">
              <div className="preview-row">
                <span>Client</span><strong>{selectedProject.client}</strong>
              </div>
              <div className="preview-row">
                <span>Industry</span><strong>{selectedProject.industry}</strong>
              </div>
              <div className="preview-row">
                <span>Duration</span><strong>{selectedProject.duration}</strong>
              </div>
              <div className="preview-row">
                <span>WFH</span><strong>{selectedProject.wfh_policy}</strong>
              </div>
              <div className="preview-row">
                <span>Roles</span>
                <strong>{selectedProject.team_slots?.length || 0} open</strong>
              </div>
              <div className="preview-skills">
                {selectedProject.team_slots?.map(s => (
                  <span key={s.slot_id} className="skill-chip">{s.role}</span>
                ))}
              </div>
            </div>
          )}

          <button className="login-btn" onClick={handleManagerLogin}
            disabled={!selectedProject}>
            Enter as Project Manager →
          </button>
        </div>
      </div>
    );
  }
}
