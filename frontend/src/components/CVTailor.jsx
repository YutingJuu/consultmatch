import React, { useState, useRef } from "react";

// Your actual CV experience section as the default template
const DEFAULT_CV_TEXT = `EXPERIENCE

Singapore Central Bank - DevOps Engineer (Oct 2024 – Apr 2026)
• Onboarded 10+ applications onto CI/CD pipelines (Jenkins/CloudBees, with ongoing migration to GitLab), resolving build issues and deployment blockers, and successfully promoting pilot applications into production environments.
• Supported containerised application deployments in RHEL-based environments and contributed to migration efforts towards OCP for standardised orchestration.
• Led planning and design discussions for GCC data landing zone migration, and conducted pilot testing in AWS using Apache Airflow, S3, EC2 and other services.
• Addressed security and code quality findings from tools such as SonarQube and Nexus IQ, remediating vulnerabilities to meet MAS security and compliance standards.
• Managed and coordinated weekly deployment activities across a 15+ member team, ensuring efficient release cycles with minimal downtime.

Government Technology Agency - SRE / Data Analyst (Jun 2021 – Sep 2024)
• Designed and implemented a centralised ETL process and cost and usage reporting portal on AWS, aggregating billing data across multiple AWS accounts, enabling stakeholders to perform data-driven cost analysis and optimisation.
• Built a self-service platform for alert and maintenance window management used across multiple application teams, aligned with defined SLA/SLO targets, improving service reliability and reducing manual operational overhead.
• Developed and maintained observability dashboards using Grafana and Prometheus, and leveraged Datadog for API endpoint monitoring, enabling real-time visibility into system health, early detection of failures, and faster incident response and recovery.

Maritime Sector – Internship & Publication
• Published a paper "Impact of shipping CO2 emissions from marine traffic in Western Singapore Straits during COVID-19" (Science of the Total Environment, May 2021) using Python and Spark.
• Applied data analytics and machine learning techniques for consulting projects, built a classification model to identify risky vessels, and a live Power BI dashboard for vessel carbon emission monitoring.

MSc Business Analytics, NUS – AI & Analytics Projects
• Developed an AI-powered wedding design application that generates personalised visual concepts and vendor recommendations using LLM-driven prompt generation and image generation models.
• Built an agentic AI pet health assistant that performs guided symptom triage and generates structured care insights using multi-step reasoning, dual RAG, and LLM-based decision support.`;

export default function CVTailor({ project, consultantProfile, consultantId, onClose, onApplied }) {
  const [step, setStep] = useState("upload"); // upload | tailoring | review | submitted
  const [cvText, setCvText] = useState(consultantProfile?.cvText && !consultantProfile.cvText.startsWith("[PDF") ? consultantProfile.cvText : "");
  const [tailoredText, setTailoredText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tailorMode, setTailorMode] = useState(null);
  const [fileData, setFileData] = useState(
    consultantProfile?.cvFileBase64
      ? { base64: consultantProfile.cvFileBase64, name: consultantProfile.cvFileName || "cv.pdf" }
      : null
  );
  const fileRef = useRef();

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    setError("");

    if (name.endsWith(".txt")) {
      const text = await file.text();
      setCvText(text);
      setFileData(null);
    } else {
      // PDF, PPTX, DOCX — convert to base64, send to backend for AI extraction
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        setFileData({ base64, name: file.name });
        setCvText(""); // clear text — file will be sent directly
      };
      reader.readAsDataURL(file);
    }
  };

  const useDefault = () => {
    setCvText(DEFAULT_CV_TEXT);
  };

  const tailorCV = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = fileData
        ? { project_id: project.id, file_base64: fileData.base64, file_name: fileData.name }
        : { project_id: project.id, cv_text: cvText };

      const response = await axios.post(`${API}/tailor`, payload);
      setTailoredText(response.data.tailored_text);
      setTailorMode(response.data.mode);
      setStep("review");
    } catch (e) {
      const msg = e.response?.data?.detail || "Failed to tailor CV. Please try again.";
      setError(msg);
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await axios.post(`${API}/applications`, {
        consultant_id: consultantId,
        project_id: project.id,
        cv_text: tailoredText,
      });
      if (onApplied) onApplied(project.id, tailoredText);
    } catch (e) {
      // Already applied — still show submitted
    }
    setStep("submitted");
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">

        {/* Header */}
        <div className="modal-header">
          <div>
            <h3>Apply to Role</h3>
            <p>{project.name} · {project.client}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Step indicators */}
        <div className="modal-steps">
          {["Upload CV", "AI Tailoring", "Review & Submit"].map((s, i) => (
            <div key={s} className={`modal-step ${
              (step === "upload" && i === 0) ||
              (step === "tailoring" && i === 1) ||
              ((step === "review" || step === "submitted") && i === 2) ? "active" :
              (step === "review" && i < 2) || (step === "submitted" && i < 3) ? "done" :
              (step === "tailoring" && i === 0) ? "done" : ""
            }`}>
              <span className="modal-step-dot">{
                (step === "review" && i < 2) || (step === "submitted") ? "✓" : i + 1
              }</span>
              <span>{s}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* Step 1: Upload */}
          {step === "upload" && (
            <div>
              <p className="modal-hint">
                Upload your CV or paste the experience section. AI will tailor it for
                <strong> {project.name}</strong> — highlighting your most relevant experience.
              </p>

              <div className="cv-upload-zone" onClick={() => fileRef.current.click()}>
                <span className="upload-icon">📄</span>
                <span>Click to upload CV</span>
                <span className="upload-sub">or use the options below</span>
                <input ref={fileRef} type="file" accept=".pdf,.txt,.pptx,.docx,.doc"
                  style={{display:"none"}} onChange={handleFileUpload} />
              </div>

              <div className="cv-divider"><span>or</span></div>

              <button className="cv-default-btn" onClick={useDefault}>
                {consultantProfile?.cvText && !consultantProfile.cvText.startsWith("[PDF")
                  ? "📋 Use my profile CV"
                  : "📋 Use sample CV (demo)"}
              </button>

              <div className="cv-divider"><span>or paste directly</span></div>

              <textarea
                className="cv-textarea"
                placeholder="Paste your experience section here..."
                value={cvText}
                onChange={e => setCvText(e.target.value)}
                rows={8}
              />

              {error && <p className="cv-error">{error}</p>}

              {cvText && (
                <div className="cv-preview-notice">
                  ✅ CV content loaded ({cvText.length} characters)
                </div>
              )}
            </div>
          )}

          {/* Step 2: Tailoring */}
          {step === "tailoring" && (
            <div className="tailoring-screen">
              <div className="tailoring-icon">🤖</div>
              <h4>Tailoring your CV...</h4>
              <p>Claude is rewriting your experience bullets to highlight relevance for:</p>
              <div className="tailoring-role">
                <strong>{project.name}</strong>
                <span>Required: {project.required_skills.join(", ")}</span>
              </div>
              <div className="tailoring-spinner" />
            </div>
          )}

          {/* Step 3: Review */}
          {step === "review" && (
            <div>
              <div className="review-banner">
                <span>{tailorMode === "ai" ? "🤖" : "⚙️"}</span>
                <div>
                  <strong>CV tailored for {project.name}</strong>
                  <p>
                    {tailorMode === "ai"
                      ? "Claude AI rewrote your experience to highlight relevance. Review and edit below."
                      : "Bullets reordered by keyword relevance. Review and edit below before submitting."}
                  </p>
                </div>
                <span className="tailor-mode-badge">
                  {tailorMode === "ai" ? "AI ✨" : "Rule-based ⚙️"}
                </span>
              </div>

              <div className="diff-header">
                <span>Tailored Experience Section</span>
                <span className="diff-hint">Click anywhere to edit</span>
              </div>
              <textarea
                className="cv-textarea review"
                value={tailoredText}
                onChange={e => setTailoredText(e.target.value)}
                rows={14}
              />

              <div className="role-requirements">
                <p className="req-title">Matched against:</p>
                <div className="skills-row">
                  {project.required_skills.map(s => (
                    <span key={s} className="skill-chip">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Submitted */}
          {step === "submitted" && (
            <div className="submitted-screen">
              <div className="submitted-icon">✅</div>
              <h4>Application Submitted!</h4>
              <p>Your tailored CV has been submitted for <strong>{project.name}</strong>.</p>
              <div className="submitted-details">
                <div className="submitted-row">
                  <span>Project</span><strong>{project.name}</strong>
                </div>
                <div className="submitted-row">
                  <span>Client</span><strong>{project.client}</strong>
                </div>
                <div className="submitted-row">
                  <span>Industry</span><strong>{project.industry}</strong>
                </div>
                <div className="submitted-row">
                  <span>Status</span>
                  <strong className="status-pending">⏳ Under Review</strong>
                </div>
              </div>
              <p className="submitted-note">
                You will be notified if the project team expresses interest in your profile.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {step === "upload" && (
            <button
              className="modal-btn primary"
              onClick={() => { setStep("tailoring"); tailorCV(); }}
              disabled={!cvText && !fileData}
            >
              ✨ Tailor with AI →
            </button>
          )}
          {step === "review" && (
            <>
              <button className="modal-btn secondary"
                onClick={() => setStep("upload")}>
                ← Re-upload
              </button>
              <button className="modal-btn primary" onClick={handleSubmit}>
                Submit Application →
              </button>
            </>
          )}
          {step === "submitted" && (
            <button className="modal-btn primary" onClick={onClose}>
              Done
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
