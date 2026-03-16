import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx
from dotenv import load_dotenv
import anthropic


load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID")
ADZUNA_API_KEY = os.getenv("ADZUNA_API_KEY")

if not ANTHROPIC_API_KEY:
    raise RuntimeError("ANTHROPIC_API_KEY is required in environment")


class AnalyzeRequest(BaseModel):
    name: str
    grade_level: str
    interests: str
    math_comfort: str
    coding_exposure: str
    career_goal: str
    transcript: Optional[str] = None


class AnalyzeResponse(BaseModel):
    fields: List[str]
    roadmap: List[str]
    electives: List[str]
    resources: List[dict]


app = FastAPI(title="AI Career Coach")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_anthropic_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


async def fetch_jobs(role: str, location: str = "remote") -> List[dict]:
    """
    Simple Adzuna API wrapper for illustrative purposes.
    """
    if not ADZUNA_APP_ID or not ADZUNA_API_KEY:
        return []

    url = f"https://api.adzuna.com/v1/api/jobs/us/search/1"
    params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_API_KEY,
        "results_per_page": 5,
        "what": role,
        "where": location,
        "content-type": "application/json",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except Exception:
            return []
    data = resp.json()
    return data.get("results", [])


def suggest_electives(field_name: str) -> List[str]:
    mapping = {
        "machine learning": [
            "Intro to Machine Learning",
            "Probability and Statistics",
            "Linear Algebra for Data Science",
        ],
        "web development": [
            "Full-Stack Web Development",
            "Databases",
            "Human-Computer Interaction",
        ],
        "systems": [
            "Operating Systems",
            "Computer Architecture",
            "Distributed Systems",
        ],
        "security": [
            "Intro to Cybersecurity",
            "Network Security",
            "Applied Cryptography",
        ],
    }
    for key, courses in mapping.items():
        if key in field_name.lower():
            return courses
    return [
        "Data Structures and Algorithms",
        "Software Engineering",
        "Discrete Mathematics",
    ]


TOOLS = [
    {
        "name": "fetch_jobs",
        "description": "Look up real job postings for a given role title.",
        "input_schema": {
            "type": "object",
            "properties": {
                "role": {"type": "string", "description": "Job title to search for."},
                "location": {
                    "type": "string",
                    "description": "Location or 'remote'.",
                    "default": "remote",
                },
            },
            "required": ["role"],
        },
    },
    {
        "name": "suggest_electives",
        "description": "Map a CS subfield to recommended elective course types.",
        "input_schema": {
            "type": "object",
            "properties": {
                "field_name": {
                    "type": "string",
                    "description": "Name of CS field, e.g. 'machine learning'.",
                }
            },
            "required": ["field_name"],
        },
    },
]


async def run_agentic_loop(payload: AnalyzeRequest) -> AnalyzeResponse:
    """
    Anthropic tool-use loop that keeps going until the model
    returns a final JSON answer instead of more tool_use blocks.
    """
    client = get_anthropic_client()

    system_prompt = (
        "You are an AI career coach for computer science students. "
        "Given a student's background, you will:\n"
        "1) Identify promising CS fields for them (`fields`),\n"
        "2) Design a weekly learning roadmap (`roadmap`),\n"
        "3) Recommend university or online electives (`electives`), and\n"
        "4) Suggest concrete learning resources (`resources`).\n\n"
        "You have access to tools that can fetch real job postings and suggest electives. "
        "When you are done, respond ONLY with a single JSON object of the form:\n"
        '{\"fields\": string[], \"roadmap\": string[], \"electives\": string[], '
        '"resources\": {\"skill\": string, \"items\": string[]}[] }. '
        "Do not include markdown."
    )

    user_content = (
        f"Student name: {payload.name}\n"
        f"Grade level: {payload.grade_level}\n"
        f"Interests: {payload.interests}\n"
        f"Math comfort: {payload.math_comfort}\n"
        f"Coding exposure: {payload.coding_exposure}\n"
        f"Career goal: {payload.career_goal}\n"
    )
    if payload.transcript:
        user_content += f"\nTranscript:\n{payload.transcript}\n"

    messages = [
        {
            "role": "user",
            "content": [{"type": "text", "text": user_content}],
        }
    ]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1200,
            system=system_prompt,
            tools=TOOLS,
            messages=messages,
        )

        # If the model answered directly with text JSON, parse and return.
        if response.stop_reason == "end_turn":
            # Collect all text blocks in assistant message.
            text_chunks: List[str] = []
            for block in response.content:
                if block.type == "text":
                    text_chunks.append(block.text)
            import json

            try:
                data = json.loads("\n".join(text_chunks))
            except Exception as exc:
                raise HTTPException(status_code=500, detail=f"Failed to parse model JSON: {exc}")

            return AnalyzeResponse(
                fields=data.get("fields", []),
                roadmap=data.get("roadmap", []),
                electives=data.get("electives", []),
                resources=data.get("resources", []),
            )

        # Otherwise we expect tool_use blocks and need to call tools, then continue loop.
        tool_results_content = []
        for block in response.content:
            if block.type != "tool_use":
                continue

            if block.name == "fetch_jobs":
                args = block.input
                jobs = await fetch_jobs(role=args.get("role", ""), location=args.get("location", "remote"))
                tool_results_content.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": [
                            {
                                "type": "text",
                                "text": httpx.dumps(jobs) if hasattr(httpx, "dumps") else str(jobs),
                            }
                        ],
                    }
                )
            elif block.name == "suggest_electives":
                args = block.input
                electives = suggest_electives(field_name=args.get("field_name", ""))
                tool_results_content.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": [{"type": "text", "text": "\n".join(electives)}],
                    }
                )

        messages.append(
            {
                "role": "assistant",
                "content": response.content,
            }
        )
        messages.append(
            {
                "role": "user",
                "content": tool_results_content,
            }
        )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    try:
        return await run_agentic_loop(request)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

