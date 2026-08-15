import React, { useState } from "react";
import LoginScreen from "./components/LoginScreen";
import ConsultantView from "./components/ConsultantView";
import ManagerView from "./components/ManagerView";
import ProfilePage from "./components/ProfilePage";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  const handleLogin = (sess) => {
    setSession(sess);
    setShowProfile(false);
  };

  const handleProfileUpdate = (updatedProfile) => {
    setSession(s => ({
      ...s,
      name: updatedProfile.name,
      profile: updatedProfile,
    }));
  };

  if (!session) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="logo">ConsultMatch</span>
          <span className="header-sub">Preference-Driven Allocation</span>
        </div>
        <div className="header-right">
          {session.role === "consultant" && (
            <button className="profile-header-btn"
              onClick={() => setShowProfile(true)}>
              👤 {session.name}
              {session.isCustom && <span className="custom-badge">You</span>}
              {session.isCustom && !(session.profile?.cvText) &&
                <span className="cv-missing-dot" title="CV not uploaded">●</span>}
            </button>
          )}
          {session.role === "manager" && (
            <span className="user-badge">📋 {session.name}</span>
          )}
          <button className="logout-btn" onClick={() => setSession(null)}>
            Switch Role
          </button>
        </div>
      </header>

      <main className="app-main">
        {session.role === "consultant" ? (
          <ConsultantView
            consultantId={session.id}
            customProfile={session.isCustom ? session.profile : null}
          />
        ) : (
          <ManagerView projectId={session.id} />
        )}
      </main>

      {showProfile && session.isCustom && (
        <ProfilePage
          profile={session.profile}
          onUpdate={handleProfileUpdate}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
