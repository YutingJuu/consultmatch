# ConsultMatch

**Preference-Driven Consultant-Project Allocation using Two-Sided Matching**

NUS MSBA Capstone Project 2026 · Ju Yuting

---

## Overview

ConsultMatch is a prototype system that improves consultant-to-project allocation in professional services firms using the Gale-Shapley deferred acceptance algorithm. Unlike current supply-push tools (e.g. Accenture myScheduling), ConsultMatch treats both consultants and project managers as active participants with ranked preferences, producing stable allocations that optimise mutual compatibility.

**Key features:**
- Compatibility scoring across skills, preferences, and seniority (0–100)
- Both consultant and project manager views with a role toggle
- Gale-Shapley matching engine (consultant-optimal, stable)
- Match results visualisation with score breakdown and distribution chart
- 20 synthetic consultants × 10 synthetic projects

---

## Architecture

```
consultmatch/
├── backend/              # Python + FastAPI
│   ├── main.py           # API routes
│   ├── scoring.py        # Compatibility scoring model
│   ├── matching.py       # Gale-Shapley algorithm
│   ├── data/
│   │   └── synthetic.py  # 20 consultants, 10 projects
│   └── requirements.txt
└── frontend/             # React
    └── src/
        ├── App.jsx
        └── components/
            ├── LoginScreen.jsx
            ├── ConsultantView.jsx
            ├── ManagerView.jsx
            ├── MatchResults.jsx
            └── ScoreBadge.jsx
```

---

## Live Demo

| | URL |
|---|---|
| **Frontend** | https://consultmatch.vercel.app *(update after deploying)* |
| **Backend API** | https://consultmatch-api.onrender.com *(update after deploying)* |
| **API Docs** | https://consultmatch-api.onrender.com/docs |

> **Note:** The backend runs on Render's free tier and may take ~30 seconds to wake up after inactivity. Open the app a minute before your demo.

---

## Deployment Guide

### Deploy Backend to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New** → **Web Service**
3. Connect your GitHub repo
4. Render will auto-detect `render.yaml` — just click **Deploy**
5. Copy your Render URL (e.g. `https://consultmatch-api.onrender.com`)

### Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your repo
2. Set **Root Directory** to `frontend`
3. Under **Environment Variables**, add:
   ```
   REACT_APP_API_URL = https://consultmatch-api.onrender.com
   ```
   *(use your actual Render URL from the step above)*
4. Click **Deploy**
5. Share the Vercel URL with your judges

### After deploying — update CORS

In `backend/main.py`, add your actual Vercel URL to `ALLOWED_ORIGINS` if it differs from the default, then redeploy.

---

## Local Development

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API will be available at `http://localhost:8000`
Interactive API docs at `http://localhost:8000/docs`

### 2. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm start
```

Frontend will open at `http://localhost:3000`

---

## How to Use

1. **Open** `http://localhost:3000`
2. **Toggle** between *Consultant* or *Project Manager* role
3. **Select** your profile from the dropdown
4. **Browse** recommended matches (ranked by compatibility score)
5. **Add** preferred matches and reorder them
6. **Submit** your preferences
7. *(Manager only)* Click **Run Matching Algorithm** to execute Gale-Shapley
8. **View results** — match table and score distribution

---

## Compatibility Score Breakdown

| Component | Weight | Description |
|---|---|---|
| Skills match | 40 pts | Jaccard overlap between consultant skills and project requirements |
| Preference alignment | 40 pts | Industry, WFH policy, work style, project duration |
| Seniority fit | 20 pts | Level alignment (exact = 20, ±1 level = 10) |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/consultants` | All consultants |
| GET | `/consultants/{id}/recommendations` | Projects ranked for a consultant |
| POST | `/consultants/rankings` | Submit consultant preference list |
| GET | `/projects` | All projects |
| GET | `/projects/{id}/recommendations` | Consultants ranked for a project |
| POST | `/projects/rankings` | Submit project manager preference list |
| POST | `/match` | Run Gale-Shapley matching |
| GET | `/match/results` | Retrieve latest match results |
| POST | `/match/reset` | Clear all state for a fresh demo |
| GET | `/score/{cid}/{pid}` | Compatibility score between one pair |

Full interactive docs: `http://localhost:8000/docs`

---

## Academic Context

This prototype accompanies the capstone paper:

> Ju Yuting. *"From Placement to Preference: A Data-Driven Two-Sided Matching Framework for Consultant-Project Allocation."* NUS MSBA Capstone, 2026.

The matching algorithm is based on:
> D. Gale and L. S. Shapley, "College Admissions and the Stability of Marriage," *The American Mathematical Monthly*, vol. 69, no. 1, pp. 9–15, 1962.
