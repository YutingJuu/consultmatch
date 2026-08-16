import React, { useState, useEffect } from "react";
import axios from "axios";
import OnboardingWizard from "./OnboardingWizard";
import ProjectWizard from "./ProjectWizard";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

// 5 curated sample profiles — varied CLs and backgrounds
const SAMPLE_IDS = ["C07", "C05", "C01", "C04", "C15"];
// C07: Grace Koh      — CL11 Analyst, Healthcare/Gov, onsite
// C05: Eva Chen       — CL10 Senior Analyst, Retail/Logistics, hybrid
// C01: Alice Tan      — CL9 Consultant, ML/Python, Banking/Tech, hybrid
// C04: David Ng       — CL8 Associate Manager, Strategy, Banking, hybrid
// C15: Olivia Tan     — CL7 Manager, Strategy/M&A, Banking/PE, onsite

export default function LoginScreen({ onLogin }) {
  const [role, setRole] = useState("landing"); // landing | consultant-choice | onboarding | existing | manager-choice | project-wizard | existing-project
  const [consultants, setConsultants] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedConsultantId, setSelectedConsultantId] = useState("");
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [customProfiles, setCustomProfiles] = useState(
    () => JSON.parse(sessionStorage.getItem("consultmatch_custom_profiles") || "[]")
  );
  const [customProject, setCustomProject] = useState(null);

  useEffect(() => {
    axios.get(`${API}/consultants`).then(r => {
      const samples = r.data.filter(c => SAMPLE_IDS.includes(c.id));
      setConsultants(samples);
      // Default to first custom profile if exists, else first sample
      const saved = JSON.parse(sessionStorage.getItem("consultmatch_custom_profiles") || "[]");
      if (saved.length > 0) setSelectedConsultantId(saved[0].id);
      else if (samples.length > 0) setSelectedConsultantId(samples[0].id);
    });
    axios.get(`${API}/projects`).then(r => {
      setProjects(r.data);
      if (r.data.length > 0) setSelectedManagerId(r.data[0].manager_id);
    });
  }, []);

  const handleExistingLogin = () => {
    const c = [...customProfiles, ...consultants].find(c => c.id === selectedConsultantId);
    const isCustom = customProfiles.some(p => p.id === c.id);
    onLogin({ role: "consultant", id: c.id, name: c.name,
              isCustom, profile: isCustom ? c : null });
  };

  const handleManagerLogin = () => {
    const p = projects.find(p => p.manager_id === selectedManagerId);
    onLogin({ role: "manager", id: p.id, name: p.manager_name });
  };

  const handleProjectComplete = (project) => {
    setCustomProject(project);
    onLogin({ role: "manager", id: project.id, name: project.manager_name,
               isCustomProject: true, project });
  };

  const handleOnboardingComplete = (customProfile) => {
    // Save to sessionStorage so it persists within the session
    const saved = JSON.parse(sessionStorage.getItem("consultmatch_custom_profiles") || "[]");
    const updated = [customProfile, ...saved.filter(p => p.id !== customProfile.id)];
    sessionStorage.setItem("consultmatch_custom_profiles", JSON.stringify(updated));
    setCustomProfiles(updated);
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
            <button className="landing-role-btn" onClick={() => setRole("manager-choice")}>
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
              {customProfiles.length > 0 && (
                <optgroup label="Your Profiles">
                  {customProfiles.map(c => (
                    <option key={c.id} value={c.id}>
                      ✨ {c.name} (CL{c.cl} {c.cl_title})
                    </option>
                  ))}
                </optgroup>
              )}
              <>
                {consultants.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (CL{c.cl} {c.cl_title})</option>
                ))}
              </>
            </select>
          </div>

          {selectedConsultantId && (() => {
            const c = [...customProfiles, ...consultants].find(x => x.id === selectedConsultantId);
            if (!c) return null;
            return (
              <div className="profile-preview">
                <div className="preview-row">
                  <span>Level</span>
                  <strong>CL{c.cl} {c.cl_title}</strong>
                </div>
                <div className="preview-row">
                  <span>Industries</span>
                  <strong>{c.preferred_industries?.join(", ") || "—"}</strong>
                </div>
                <div className="preview-row">
                  <span>WFH</span>
                  <strong>{c.wfh_preference}</strong>
                </div>
                <div className="preview-row">
                  <span>Goal</span>
                  <strong>{c.career_goal?.replace("_"," ") || "—"}</strong>
                </div>
                <div className="preview-skills">
                  {c.skills?.map(s => <span key={s} className="skill-chip">{s}</span>)}
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

  // ── Manager: new project wizard ──────────────────────────────────────────
  if (role === "project-wizard") {
    return (
      <ProjectWizard
        onComplete={handleProjectComplete}
        onBack={() => setRole("manager-choice")}
      />
    );
  }

  // ── Manager: choice screen ────────────────────────────────────────────────
  if (role === "manager-choice") {
    return (
      <div className="login-screen">
        <div className="login-card">
          <button className="back-btn" onClick={() => setRole("landing")}>← Back</button>
          <div className="login-logo" style={{fontSize:"20px"}}>ConsultMatch</div>
          <p className="login-tagline">How would you like to continue?</p>

          <div className="choice-cards">
            <button className="choice-card primary" onClick={() => setRole("project-wizard")}>
              <span className="choice-icon">✨</span>
              <span className="choice-title">New project</span>
              <span className="choice-sub">Define your project and team composition to find the best consultants</span>
            </button>
            <button className="choice-card" onClick={() => setRole("existing-project")}>
              <span className="choice-icon">📋</span>
              <span className="choice-title">Use existing project</span>
              <span className="choice-sub">Select from sample projects to explore the system</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Manager: existing project select ──────────────────────────────────────
  if (role === "existing-project") {
    const SAMPLE_PROJECT_IDS = ["P01", "P03", "P05", "P08", "P13"];
    const sampleProjects = projects.filter(p => SAMPLE_PROJECT_IDS.includes(p.id));
    const selectedProject = sampleProjects.find(x => x.manager_id === selectedManagerId)
      || sampleProjects[0];

    return (
      <div className="login-screen">
        <div className="login-card">
          <button className="back-btn" onClick={() => setRole("manager-choice")}>← Back</button>
          <div className="login-logo" style={{fontSize:"20px"}}>ConsultMatch</div>
          <p className="login-tagline">Select a project</p>

          <div className="login-field">
            <label>Choose project</label>
            <select value={selectedManagerId}
              onChange={e => setSelectedManagerId(e.target.value)}>
              {sampleProjects.map(p => (
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
