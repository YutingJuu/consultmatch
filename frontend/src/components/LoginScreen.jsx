import React, { useState, useEffect } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function LoginScreen({ onLogin }) {
  const [role, setRole] = useState("consultant");
  const [consultants, setConsultants] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    axios.get(`${API}/consultants`).then(r => {
      setConsultants(r.data);
      setSelectedId(r.data[0]?.id || "");
    });
    axios.get(`${API}/projects`).then(r => setProjects(r.data));
  }, []);

  useEffect(() => {
    if (role === "consultant" && consultants.length) {
      setSelectedId(consultants[0].id);
    } else if (role === "manager" && projects.length) {
      setSelectedId(projects[0].manager_id);
    }
  }, [role, consultants, projects]);

  const handleLogin = () => {
    if (role === "consultant") {
      const c = consultants.find(c => c.id === selectedId);
      onLogin({ role: "consultant", id: c.id, name: c.name });
    } else {
      const p = projects.find(p => p.manager_id === selectedId);
      onLogin({ role: "manager", id: p.id, name: p.manager_name });
    }
  };

  const options =
    role === "consultant"
      ? consultants.map(c => ({ value: c.id, label: `${c.name} (${c.level})` }))
      : projects.map(p => ({ value: p.manager_id, label: `${p.manager_name} — ${p.name}` }));

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">ConsultMatch</div>
        <p className="login-tagline">Preference-Driven Consultant Allocation</p>

        <div className="role-toggle">
          <button
            className={`toggle-btn ${role === "consultant" ? "active" : ""}`}
            onClick={() => setRole("consultant")}
          >
            👤 I'm a Consultant
          </button>
          <button
            className={`toggle-btn ${role === "manager" ? "active" : ""}`}
            onClick={() => setRole("manager")}
          >
            📋 I'm a Project Manager
          </button>
        </div>

        <div className="login-field">
          <label>Select your profile</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <button className="login-btn" onClick={handleLogin}>
          Enter →
        </button>

        <p className="login-note">
          Demo prototype — NUS MSBA Capstone 2026
        </p>
      </div>
    </div>
  );
}
