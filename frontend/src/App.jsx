import React, { useState } from "react";
import LoginScreen from "./components/LoginScreen";
import ConsultantView from "./components/ConsultantView";
import ManagerView from "./components/ManagerView";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);
  // session = { role: "consultant"|"manager", id: "C01"|"M01", name: "..." }

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="logo">ConsultMatch</span>
          <span className="header-sub">Preference-Driven Allocation</span>
        </div>
        <div className="header-right">
          <span className="user-badge">
            {session.role === "consultant" ? "👤" : "📋"} {session.name}
          </span>
          <button className="logout-btn" onClick={() => setSession(null)}>
            Switch Role
          </button>
        </div>
      </header>

      <main className="app-main">
        {session.role === "consultant" ? (
          <ConsultantView consultantId={session.id} />
        ) : (
          <ManagerView projectId={session.id} />
        )}
      </main>
    </div>
  );
}
