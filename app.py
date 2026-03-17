import io
import json
import os
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx
import pdfplumber
from dotenv import load_dotenv
import anthropic


load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID")
ADZUNA_API_KEY = os.getenv("ADZUNA_API_KEY")

if not ANTHROPIC_API_KEY:
    raise RuntimeError("ANTHROPIC_API_KEY is required in environment")

# Load CSUN catalog at startup (course number, name, prereq)
CATALOG_PATH = Path(__file__).resolve().parent / "csun_catalog.txt"
CSUN_CATALOG: List[dict] = []


def load_csun_catalog() -> None:
    global CSUN_CATALOG
    if not CATALOG_PATH.exists():
        return
    with open(CATALOG_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split("|", 2)
            if len(parts) < 2:
                continue
            number = parts[0].strip()
            name = parts[1].strip()
            prereq = parts[2].strip() if len(parts) > 2 else ""
            CSUN_CATALOG.append({"number": number, "name": name, "prereq": prereq})


load_csun_catalog()


def _course_level(number: str) -> int:
    """Extract numeric level from COMP NNN (e.g. COMP 442 -> 442)."""
    try:
        return int(number.split()[-1].rstrip("/L"))
    except (ValueError, IndexError):
        return 0


# Topic keywords -> COMP course numbers (from catalog) for elective suggestions
TOPIC_TO_COMP: dict = {
    "machine learning": ["COMP 442", "COMP 542", "COMP 569", "COMP 643"],
    "ml": ["COMP 442", "COMP 542", "COMP 569", "COMP 643"],
    "ai": ["COMP 569", "COMP 560", "COMP 442", "COMP 542"],
    "artificial intelligence": ["COMP 569", "COMP 560", "COMP 442", "COMP 542"],
    "web": ["COMP 484", "COMP 584", "COMP 485", "COMP 585"],
    "web development": ["COMP 484", "COMP 584", "COMP 485"],
    "security": ["COMP 424", "COMP 429", "COMP 539"],
    "networking": ["COMP 324", "COMP 429", "COMP 529", "COMP 539"],
    "systems": ["COMP 322", "COMP 521", "COMP 522", "COMP 535", "COMP 545"],
    "operating systems": ["COMP 322", "COMP 521"],
    "database": ["COMP 440", "COMP 640", "COMP 641", "COMP 642"],
    "data science": ["COMP 442", "COMP 541", "COMP 542", "COMP 639", "COMP 640", "COMP 641", "COMP 642", "COMP 643", "COMP 644"],
    "software engineering": ["COMP 380", "COMP 582", "COMP 583", "COMP 584", "COMP 586", "COMP 587", "COMP 589"],
    "graphics": ["COMP 465", "COMP 565"],
    "hci": ["COMP 485", "COMP 585"],
    "human-computer": ["COMP 485", "COMP 585"],
    "algorithms": ["COMP 282", "COMP 482", "COMP 610"],
    "data structures": ["COMP 182", "COMP 282", "COMP 610"],
}

# Max course level by grade (inclusive). High school = prep/100 only; senior = up to 500.
MAX_LEVEL_BY_GRADE = {
    "high school": 199,
    "freshman": 299,
    "sophomore": 399,
    "junior": 499,
    "senior": 599,
}


class AnalyzeRequest(BaseModel):
    name: str
    grade_level: str
    interests: str
    math_comfort: str
    coding_exposure: str
    career_goal: str
    transcript: Optional[str] = None
    resume_text: Optional[str] = None
    degree_progress_text: Optional[str] = None


class ElectiveCourse(BaseModel):
    number: str
    name: str
    prereq: Optional[str] = None


class AnalyzeResponse(BaseModel):
    fields: List[str]
    roadmap: List[str]
    electives: List[ElectiveCourse]
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


def suggest_electives(field_name: str, grade_level: str) -> List[dict]:
    """Return CSUN COMP courses from catalog that match the field and are eligible for the student's grade level."""
    field_lower = field_name.lower()
    max_level = MAX_LEVEL_BY_GRADE.get(grade_level.lower(), 599)
    catalog_by_number = {c["number"].split("/")[0].strip(): c for c in CSUN_CATALOG}

    # Collect COMP numbers that match the field
    numbers_to_consider: List[str] = []
    for keyword, numbers in TOPIC_TO_COMP.items():
        if keyword in field_lower:
            numbers_to_consider.extend(numbers)
    if not numbers_to_consider:
        # Default: foundational and popular electives
        numbers_to_consider = ["COMP 182", "COMP 282", "COMP 380", "COMP 440", "COMP 484", "COMP 485"]

    result: List[dict] = []
    seen = set()
    for num in numbers_to_consider:
        base_num = num.split("/")[0].strip()
        if base_num in seen:
            continue
        course = catalog_by_number.get(base_num)
        if not course:
            continue
        level = _course_level(course["number"])
        if level > max_level:
            continue
        seen.add(base_num)
        result.append({
            "number": course["number"],
            "name": course["name"],
            "prereq": course["prereq"] or None,
        })
    return result[:12]


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
        "description": "Get CSUN COMP courses from the catalog that match a CS subfield and are eligible for the student's grade level. Returns course number, name, and prerequisites.",
        "input_schema": {
            "type": "object",
            "properties": {
                "field_name": {
                    "type": "string",
                    "description": "Name of CS field, e.g. 'machine learning', 'web development'.",
                },
                "grade_level": {
                    "type": "string",
                    "description": "Student's grade level: high school, freshman, sophomore, junior, or senior.",
                },
            },
            "required": ["field_name", "grade_level"],
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
        "3) Recommend CSUN COMP electives (`electives`), and\n"
        "4) Suggest concrete learning resources (`resources`).\n\n"
        "Use resume_text (if provided) to understand the student's existing skills, experience, and "
        "background. Use degree_progress_text (if provided) to identify which CSUN COMP courses they have "
        "already completed and which are in progress. Cross-reference with the CSUN catalog: recommend only "
        "courses they have NOT taken yet and are eligible for based on prerequisites. The roadmap must "
        "explicitly avoid recommending completed courses and prioritize what logically comes next in their degree.\n\n"
        "For electives: use the suggest_electives tool with the student's grade_level so you only "
        "get courses they are eligible for. Filter out any courses that appear as completed or in-progress "
        "in their degree progress. When you suggest electives, pass the exact "
        "course objects returned by the tool: each must have \"number\", \"name\", and \"prereq\" (or null).\n\n"
        "You have access to tools that can fetch real job postings and suggest CSUN catalog electives. "
        "When you are done, respond ONLY with a single JSON object of the form:\n"
        '{\"fields\": string[], \"roadmap\": string[], '
        '\"electives\": [{\"number\": string, \"name\": string, \"prereq\": string or null}], '
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
        user_content += f"\nTranscript (pasted):\n{payload.transcript}\n"
    if payload.resume_text:
        user_content += f"\nResume/Transcript (uploaded PDF text):\n{payload.resume_text}\n"
    if payload.degree_progress_text:
        user_content += f"\nDegree progress / audit (uploaded PDF text — use this to see completed and in-progress CSUN courses):\n{payload.degree_progress_text}\n"

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
            try:
                data = json.loads("\n".join(text_chunks))
            except Exception as exc:
                raise HTTPException(status_code=500, detail=f"Failed to parse model JSON: {exc}")

            raw_electives = data.get("electives", [])
            electives_list: List[ElectiveCourse] = []
            for e in raw_electives:
                if isinstance(e, dict) and "number" in e and "name" in e:
                    electives_list.append(ElectiveCourse(
                        number=str(e["number"]),
                        name=str(e["name"]),
                        prereq=str(e["prereq"]) if e.get("prereq") else None,
                    ))
                elif isinstance(e, str):
                    electives_list.append(ElectiveCourse(number="", name=e, prereq=None))

            return AnalyzeResponse(
                fields=data.get("fields", []),
                roadmap=data.get("roadmap", []),
                electives=electives_list,
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
                electives = suggest_electives(
                    field_name=args.get("field_name", ""),
                    grade_level=args.get("grade_level", "senior"),
                )
                tool_results_content.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": [{"type": "text", "text": json.dumps(electives)}],
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


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)) -> dict:
    """Accept a PDF file, extract text with pdfplumber, return extracted text."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    try:
        contents = await file.read()
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            parts = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    parts.append(text)
            return {"text": "\n\n".join(parts) if parts else ""}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract text from PDF: {e!s}")


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

