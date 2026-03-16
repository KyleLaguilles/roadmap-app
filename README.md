## AI Career Roadmap App

This project is a full‑stack, agentic AI career coach built for hackathon demos.  
Students fill out a short intake form (grade level, interests, math comfort, coding exposure, career goals, optional transcript), and the app generates:

- **Recommended CS fields** (e.g., web dev, ML, systems)
- **A weekly learning roadmap timeline**
- **Suggested electives / courses to prioritize**
- **Curated resources grouped by skill**

Under the hood, the backend runs an **agentic loop** that can call tools (job search and elective suggestion) and then produces a structured JSON roadmap for the frontend to render.

---

## Tech Stack

- **Backend**
  - Python, **FastAPI**
  - **Anthropic** Messages API (tool use) for the agentic loop
  - **Adzuna Jobs API** as a job‑market signal
  - `uvicorn` for local dev server
- **Frontend**
  - **React + TypeScript** (Vite)
  - **Tailwind‑style UI** via PostCSS (`@tailwindcss/postcss` + Tailwind utilities)
  - Single‑page app with intake form and results view

You can also pair this app with **IBM watsonx Orchestrate** by either:

- Calling watsonx Orchestrate from the FastAPI backend instead of Anthropic, or
- Letting Orchestrate call this app’s `/analyze` endpoint as a Skill action.

---

## Features Implemented So Far

- **Backend API**
  - `GET /health` – simple health check.
  - `POST /analyze` – main endpoint that:
    - Accepts JSON with `name`, `grade_level`, `interests`, `math_comfort`, `coding_exposure`, `career_goal`, and optional `transcript`.
    - Runs an Anthropic **tool‑use loop** that:
      - Calls `fetch_jobs` (Adzuna API) to sample relevant job postings.
      - Calls `suggest_electives` to map a CS field (e.g. “machine learning”) to elective course ideas.
      - Iterates until the model returns a final JSON object.
    - Returns a structured response:
      - `fields: string[]`
      - `roadmap: string[]`
      - `electives: string[]`
      - `resources: { skill: string; items: string[] }[]`

- **Frontend UX**
  - **Intake form** with:
    - Name
    - Grade level: `high school`, `freshman`, `sophomore`, `junior`, `senior`
    - Interests (free text)
    - Math comfort: `low`, `medium`, `high`
    - Coding exposure: `none`, `some`, `experienced`
    - Career goal (free text)
    - Optional transcript/resume paste area
  - **Loading state** while `/analyze` runs:
    - Shows a spinner and message:
      > “Your agent is researching the job market...”
  - **Results page** showing:
    - Recommended CS fields as cards
    - Weekly roadmap timeline (one item per “week”)
    - Suggested electives list
    - Resources grouped by skill
  - **“Start Over” button** to reset to the intake form.

---

## Prerequisites

- **Python 3.10+** (for FastAPI and Anthropic SDK)
- **Node.js 18+** and **npm** (for Vite/React frontend)
- API keys:
  - **Anthropic** API key
  - **Adzuna** App ID and API key (optional; if missing, job search gracefully returns empty results)

---

## Environment Variables

Environment variables are loaded from a `.env` file in the project root via `python-dotenv`.

Use `.env.example` as a template:

```bash
cp .env.example .env
```

Then fill in:

- `ANTHROPIC_API_KEY` – your Anthropic key.
- `ADZUNA_APP_ID` – Adzuna app ID (optional but recommended).
- `ADZUNA_API_KEY` – Adzuna API key (optional but recommended).

If Adzuna keys are omitted, the app still works, but the job‑fetching tool will return an empty list.

---

## Backend Setup & Running

From the project root (`roadmap-app`):

```bash
cd ~/Desktop/IBM_Hackathon/roadmap-app

# (optional but recommended) create a virtualenv
python3 -m venv .venv
source .venv/bin/activate  # macOS / Linux
# .venv\Scripts\activate   # Windows PowerShell

# install Python dependencies
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
uvicorn app:app --reload --port 8000
# or, if uvicorn isn't on PATH:
python -m uvicorn app:app --reload --port 8000
```

Key endpoints:

- `GET http://localhost:8000/health`
- `POST http://localhost:8000/analyze`

Example `curl` call to `/analyze`:

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alex",
    "grade_level": "sophomore",
    "interests": "AI, building web apps, hackathons",
    "math_comfort": "medium",
    "coding_exposure": "some",
    "career_goal": "machine learning engineer",
    "transcript": null
  }'
```

---

## Frontend Setup & Running

The frontend lives in the `frontend/` directory (Vite + React + TypeScript).

From the project root:

```bash
cd frontend
npm install
npm run dev
```

By default, Vite serves the app at:

- `http://localhost:5173`

The frontend is configured to call the backend at:

- `http://localhost:8000/analyze`

Make sure the **backend is running** before trying to generate a roadmap from the UI.

---

## High‑Level Architecture

- **Frontend**
  - Collects user input via a React form.
  - On submit, performs a `fetch` POST to `http://localhost:8000/analyze`.
  - Displays a loading state, then renders the structured roadmap once the response arrives.

- **Backend**
  - Receives the intake JSON.
  - Builds a prompt and runs an Anthropic `messages.create` call with:
    - A system prompt describing the coaching task and required JSON schema.
    - User message containing the student profile.
    - Tool definitions: `fetch_jobs`, `suggest_electives`.
  - Handles any `tool_use` blocks by:
    - Calling Adzuna (for jobs) and the elective mapper.
    - Sending back `tool_result` blocks.
  - Loops until `stop_reason == "end_turn"` and the model returns a final JSON object that matches the expected shape.

---

## Using with IBM watsonx Orchestrate (Conceptual)

This project currently uses Anthropic for the agent. To integrate with **IBM watsonx Orchestrate** you have two main options:

- **Option A – Orchestrate as the brain**
  - Implement the “career roadmap” logic as a Skill / Playbook inside watsonx Orchestrate.
  - Have the FastAPI `/analyze` endpoint call Orchestrate’s API instead of Anthropic.
  - Return Orchestrate’s structured output to the frontend.

- **Option B – Orchestrate as the orchestrator**
  - Keep this app as‑is.
  - Create a Skill in Orchestrate that calls your `/analyze` endpoint as an HTTP action.
  - Trigger “Generate CS roadmap” directly from the Orchestrate chat UI, which then uses your app behind the scenes.

For hackathons, either option lets you credibly say:

> “This UI is powered by an agentic backend that can be hosted behind IBM watsonx Orchestrate.”

---

## Next Ideas / TODOs

- Add authentication and per‑student history.
- Persist roadmaps in a database for later review.
- Add more tools (e.g., university catalog search, scholarship lookup).
- Tighten JSON parsing and validation on the agent’s response.

