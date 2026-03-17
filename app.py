import asyncio
import io
import json
import os
import statistics
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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

def _summarize_anthropic_content_blocks(content: list) -> str:
    """Best-effort summary of Anthropic response blocks for debugging."""
    try:
        parts = []
        for block in content or []:
            btype = getattr(block, "type", type(block).__name__)
            name = getattr(block, "name", None)
            parts.append(f"{btype}{'(' + name + ')' if name else ''}")
        return "[" + ", ".join(parts) + "]"
    except Exception:
        return "[unavailable]"


def _extract_first_json_object(text: str) -> str | None:
    """
    Best-effort extraction of the first top-level JSON object substring.
    This is a fallback for when the model wraps JSON in extra prose.
    """
    if not text:
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    return text[start : end + 1]


def _parse_model_json(text: str, *, debug_context: str) -> dict:
    raw = (text or "").strip()
    if not raw:
        raise HTTPException(
            status_code=502,
            detail=f"Model returned empty text; cannot parse JSON. Context: {debug_context}",
        )
    try:
        return json.loads(raw)
    except Exception:
        extracted = _extract_first_json_object(raw)
        if extracted and extracted != raw:
            try:
                return json.loads(extracted)
            except Exception:
                pass
        preview = raw[:800]
        raise HTTPException(
            status_code=502,
            detail=(
                "Failed to parse model JSON. "
                f"Context: {debug_context}. "
                f"Raw preview (first 800 chars): {preview}"
            ),
        )


def _course_level(number: str) -> int:
    """Extract numeric level from COMP NNN (e.g. COMP 442 -> 442)."""
    try:
        return int(number.split()[-1].rstrip("/L"))
    except (ValueError, IndexError):
        return 0


_COMP_TOKEN_RE = re.compile(r"\bC+O+M+P+\s+(\d{3,9})(L{0,4})\b", re.IGNORECASE)
_IP_MARK_RE = re.compile(r"\bI+P+\b", re.IGNORECASE)


def _normalize_ocr_digits(d: str) -> str:
    d = (d or "").strip()
    if not d:
        return ""
    # OCR often repeats each digit (e.g. 331100 -> 310, 222888222 -> 282).
    if len(d) == 6 and all(d[i] == d[i + 1] for i in (0, 2, 4)):
        candidate = d[0] + d[2] + d[4]
        if candidate.isdigit():
            return candidate
    if len(d) == 9 and all(d[i] == d[i + 1] == d[i + 2] for i in (0, 3, 6)):
        candidate = d[0] + d[3] + d[6]
        if candidate.isdigit():
            return candidate
    m = re.search(r"\d{3}", d)
    return m.group(0) if m else ""


def _normalize_course_number(n: str) -> str:
    return (n or "").upper().split("/")[0].strip()


def _base_comp(course: str) -> str:
    c = (course or "").strip().upper()
    # Treat lab suffixes as part of the base course in this app (catalog entries include lab in the title).
    if c.endswith("L") and len(c) >= 2 and c[-2].isdigit():
        return c[:-1]
    return c


def extract_comp_courses_from_dpr(text: str) -> tuple[set[str], set[str]]:
    """
    Extract COMP course tokens from DPR text.
    Returns (completed_or_other, in_progress) sets as normalized strings like "COMP 256L".
    """
    completed: set[str] = set()
    in_progress: set[str] = set()
    if not text:
        return completed, in_progress

    # Only count a course as taken if the same line contains a grade marker.
    # This avoids incorrectly treating "needed" course lists as completed.
    grade_re = re.compile(r"\b(?:I+P+|E+X+|A\+?|A-?|B\+?|B-?|C\+?|C-?|D\+?|D-?|F)\b", re.IGNORECASE)

    for line in text.splitlines():
        if "COMP" not in line.upper() and "CCOOOMMMP" not in line.upper():
            continue
        m = _COMP_TOKEN_RE.search(line)
        if not m:
            continue
        digits = _normalize_ocr_digits(m.group(1))
        if not digits:
            continue
        lab = "L" if m.group(2) else ""
        code = f"COMP {digits}{lab}"

        if _IP_MARK_RE.search(line):
            in_progress.add(code)
        elif grade_re.search(line):
            completed.add(code)
        else:
            # No grade marker on this line → treat as "listed/needed", not completed.
            continue

    completed -= in_progress
    # Normalize lab variants to their base course so COMP 380/L is treated as COMP 380.
    completed = {_base_comp(c) for c in completed}
    in_progress = {_base_comp(c) for c in in_progress}
    completed -= in_progress
    return completed, in_progress


_COMP_PREREQ_RE = re.compile(r"\bCOMP\s+\d{3}(?:L)?\b", re.IGNORECASE)


def extract_required_comp_core_from_dpr(text: str) -> set[str]:
    """
    Best-effort extraction of required COMP core courses from the DPR section:
    "NO COMPUTER SCIENCE UPPER DIVISION CORE REQUIREMENTS ... TAKE ALL OF THE LISTED COURSES".
    Returns normalized strings like "COMP 380L" or "COMP 333".
    """
    if not text:
        return set()

    upper = text.upper()
    start = upper.find("NO COMPUTER SCIENCE UPPER DIVISION CORE")
    if start == -1:
        return set()

    # Stop at senior electives section or end of doc
    end = upper.find("NO COMPUTER SCIENCE SENIOR ELECTIVE", start)
    if end == -1:
        end = len(text)

    section = text[start:end]
    # This section contains normal and OCR-expanded tokens.
    required: set[str] = set()

    # 1) Capture explicit COMP tokens (e.g. "COMP 333", "CCOOOMMMPPP 333333").
    for m in _COMP_TOKEN_RE.finditer(section):
        digits = _normalize_ocr_digits(m.group(1))
        if not digits:
            continue
        required.add(f"COMP {digits}")

    # 2) Capture DPR "COURSE LIST:: COMP 331100,,332222 ,,332222LL,," style lists
    # where COMP prefix appears once and subsequent items are bare numbers.
    for line in section.splitlines():
        # Match OCR variants like "CCOOUURRSSEE LLIISSTT::"
        if not re.search(r"C+O+U+R+S+E+.*L+I+S+T+", line, re.IGNORECASE):
            continue
        # Match OCR variants like COMP / CCOOMMPP / CCOOOMMMPPP etc.
        mcomp = re.search(r"C+O+M+P+", line, re.IGNORECASE)
        if not mcomp:
            continue
        after = line[mcomp.end() :]
        for token in re.split(r"[,\s]+", after):
            token = token.strip()
            if not token:
                continue
            m2 = re.match(r"^(\d{3,9})(L{0,4})$", token, re.IGNORECASE)
            if not m2:
                continue
            digits = _normalize_ocr_digits(m2.group(1))
            if not digits:
                continue
            required.add(f"COMP {digits}")

    return required


def build_remaining_degree_roadmap(
    *,
    required: set[str],
    completed: set[str],
    in_progress: set[str],
    catalog_by_number: dict,
) -> List[dict]:
    """
    Group remaining required COMP courses by semester based on COMP prerequisites.
    Excludes completed and in-progress courses from the remaining list.
    """
    required = {_base_comp(c) for c in required}
    completed = {_base_comp(c) for c in completed}
    in_progress = {_base_comp(c) for c in in_progress}

    remaining = sorted(required - completed - in_progress)
    if not remaining:
        return []

    satisfied = set(completed) | set(in_progress)
    remaining_set = set(remaining)

    def comp_prereqs(course_number: str) -> set[str]:
        course = catalog_by_number.get(course_number)
        prereq_text = (course.get("prereq") if course else "") or ""
        prereqs = set()
        for token in _COMP_PREREQ_RE.findall(prereq_text):
            prereqs.add(_normalize_course_number(token))
        return prereqs

    semesters: List[dict] = []
    semester_idx = 1
    safety = 0
    while remaining_set and safety < 20:
        safety += 1
        available = []
        for c in sorted(remaining_set):
            prereqs = comp_prereqs(c)
            if prereqs.issubset(satisfied | (set(required) - remaining_set)):
                available.append(c)

        if not available:
            # If we can't schedule due to missing prereqs in catalog parsing, dump remaining as "Later".
            available = sorted(remaining_set)
            label = "Later"
        else:
            label = f"Semester {semester_idx}"
            semester_idx += 1

        courses = []
        for c in available:
            course = catalog_by_number.get(c, {"number": c, "name": c, "prereq": None})
            courses.append(
                {
                    "number": course.get("number", c),
                    "name": course.get("name", ""),
                    "prereq": course.get("prereq") or None,
                }
            )
            remaining_set.discard(c)
            satisfied.add(c)

        semesters.append({"semester": label, "courses": courses})

        if label == "Later":
            break

    return semesters


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
    in_progress: Optional[bool] = None


class RemainingCourse(BaseModel):
    number: str
    name: str
    prereq: Optional[str] = None


class RemainingSemester(BaseModel):
    semester: str
    courses: List[RemainingCourse]


class AnalyzeResponse(BaseModel):
    fields: List[str]
    reasoning: str
    electives: List[ElectiveCourse]
    resources: List[dict]
    remaining_courses: List[RemainingSemester] = []


_SENIOR_ELECTIVE_UNITS_RE = re.compile(
    r"NO\s+COMPUTER\s+SCIENCE\s+SENIOR\s+ELECTIVE\s+REQUIREMENT\s*\(\s*(\d+)\s*UNITS\s*\)",
    re.IGNORECASE,
)
_NEEDS_UNITS_RE = re.compile(r"N+E+E+D+S+::\s*([0-9\.]+)\s*U+N+I+T+S+", re.IGNORECASE)


def extract_senior_elective_units_remaining(text: str) -> int | None:
    if not text:
        return None
    m = _SENIOR_ELECTIVE_UNITS_RE.search(text)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            pass
    # Fallback: look for NEEDS in the senior elective section
    upper = text.upper()
    start = upper.find("NO COMPUTER SCIENCE SENIOR ELECTIVE")
    if start != -1:
        end = min(len(text), start + 800)
        section = text[start:end]
        m2 = _NEEDS_UNITS_RE.search(section)
        if m2:
            try:
                return int(round(float(m2.group(1))))
            except Exception:
                return None
    return None


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    profile: Dict[str, Any] = Field(default_factory=dict)
    plan: Dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    answer: str


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


async def fetch_jobs(role: str) -> Dict[str, Any]:
    """
    Adzuna API wrapper. Returns:
      {"listings": [...], "median_salary": str, "error": str|None}
    """
    if not ADZUNA_APP_ID or not ADZUNA_API_KEY:
        return {"listings": [], "median_salary": "Not listed", "error": "Missing ADZUNA_APP_ID/ADZUNA_API_KEY"}

    role_query = "+".join((role or "").strip().split())
    if not role_query:
        return {"listings": [], "median_salary": "Not listed", "error": "No results found for this role"}

    url = "https://api.adzuna.com/v1/api/jobs/us/search/1"
    params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_API_KEY,
        "results_per_page": 5,
        "what": role_query,
        "content-type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return {"listings": [], "median_salary": "Not listed", "error": "No results found for this role"}

    results = data.get("results") or []
    if not results:
        return {"listings": [], "median_salary": "Not listed", "error": "No results found for this role"}

    listings: List[dict] = []
    salary_samples: List[float] = []
    for job in results:
        job = job or {}
        title = job.get("title") or ""
        desc = job.get("description") or ""
        company = ((job.get("company") or {}) or {}).get("display_name") or ""
        location = ((job.get("location") or {}) or {}).get("display_name") or ""
        salary_min = job.get("salary_min")
        salary_max = job.get("salary_max")

        def _to_float(v: Any) -> float | None:
            try:
                if v is None:
                    return None
                return float(v)
            except Exception:
                return None

        smin = _to_float(salary_min)
        smax = _to_float(salary_max)
        if smin is not None and smax is not None:
            salary_samples.append((smin + smax) / 2.0)
        elif smin is not None:
            salary_samples.append(smin)
        elif smax is not None:
            salary_samples.append(smax)

        listings.append(
            {
                "title": str(title),
                "company": str(company),
                "location": str(location),
                "salary_min": smin,
                "salary_max": smax,
                "description": str(desc)[:400],
            }
        )

    if salary_samples:
        median = statistics.median(sorted(salary_samples))
        median_k = int(round(median / 1000.0))
        median_salary = f"${median_k}k"
    else:
        median_salary = "Not listed"

    return {"listings": listings, "median_salary": median_salary, "error": None}


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
        "description": "Look up real job postings for a given role title via Adzuna. Returns {listings, median_salary, error}.",
        "input_schema": {
            "type": "object",
            "properties": {
                "role": {"type": "string", "description": "Job title to search for."},
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
        "2) Explain why you chose these fields (`reasoning`),\n"
        "3) Recommend CSUN COMP electives (`electives`), and\n"
        "4) Suggest concrete learning resources (`resources`).\n\n"
        "Early in your reasoning, call fetch_jobs with the student's target role (career_goal) to see what skills "
        "employers are asking for. Use the returned job listing descriptions to prioritize the most in-demand skills "
        "in your recommendations.\n\n"
        "Use resume_text (if provided) to understand the student's existing skills, experience, and "
        "background. Use degree_progress_text (if provided) to identify which CSUN COMP courses they have "
        "already completed and which are in progress. Cross-reference with the CSUN catalog: recommend only "
        "courses they have NOT taken yet and are eligible for based on prerequisites.\n\n"
        "For electives: use the suggest_electives tool with the student's grade_level so you only "
        "get courses they are eligible for. Filter out any courses that appear as completed or in-progress "
        "in their degree progress. When you suggest electives, pass the exact "
        "course objects returned by the tool: each must have \"number\", \"name\", and \"prereq\" (or null).\n\n"
        "You have access to tools that can fetch real job postings and suggest CSUN catalog electives. "
        "When you are done, respond ONLY with a single JSON object of the form:\n"
        '{\"fields\": string[], \"reasoning\": string, '
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
            for block in response.content or []:
                if getattr(block, "type", None) == "text" and getattr(block, "text", None):
                    text_chunks.append(block.text)

            debug_context = (
                f"stop_reason={getattr(response, 'stop_reason', None)}, "
                f"blocks={_summarize_anthropic_content_blocks(getattr(response, 'content', None))}"
            )
            data = _parse_model_json("\n".join(text_chunks), debug_context=debug_context)

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
                reasoning=data.get("reasoning", ""),
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
                jobs = await fetch_jobs(role=args.get("role", ""))
                tool_results_content.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": [
                            {
                                "type": "text",
                                "text": json.dumps(jobs),
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


def _ndjson_sse(obj: dict) -> bytes:
    """
    Stream newline-delimited JSON chunks over an SSE-compatible content type.
    We emit each JSON object as a single line prefixed with `data: `.
    """
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n".encode("utf-8")


async def _anthropic_text(
    *,
    client: anthropic.Anthropic,
    system: str,
    user_text: str,
    max_tokens: int,
) -> str:
    # Run sync SDK call off the event loop so streaming stays responsive.
    response = await asyncio.to_thread(
        client.messages.create,
        model="claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": [{"type": "text", "text": user_text}]}],
    )

    text_chunks: List[str] = []
    for block in getattr(response, "content", None) or []:
        if getattr(block, "type", None) == "text" and getattr(block, "text", None):
            text_chunks.append(block.text)
    return ("\n".join(text_chunks) or "").strip()


def _analyze_user_context(payload: AnalyzeRequest) -> str:
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
        user_content += (
            "\nDegree progress / audit (uploaded PDF text — use this to see completed and in-progress CSUN courses):\n"
            f"{payload.degree_progress_text}\n"
        )
    return user_content


def _is_vague_goal(goal: str) -> bool:
    g = (goal or "").strip().lower()
    if not g:
        return True
    vague = {
        "undecided",
        "not sure",
        "unsure",
        "idk",
        "i don't know",
        "i dont know",
        "n/a",
        "na",
        "none",
        "tbd",
        "maybe",
        "unknown",
    }
    return g in vague


def _derive_role_from_interests(interests: str) -> str:
    text = (interests or "").lower()

    def has_any(*keywords: str) -> bool:
        return any(k in text for k in keywords)

    if has_any("cryptography", "crypto", "encryption", "security", "pentest", "penetration", "malware"):
        return "security engineer"
    if has_any("deep learning", "neural", "ml", "machine learning", "prediction", "predictive", "ai"):
        return "machine learning engineer"
    if has_any("data science", "analytics", "data analysis", "statistics", "regression"):
        return "data scientist"
    if has_any("frontend", "front-end", "react", "ui", "ux", "web"):
        return "frontend developer"
    if has_any("backend", "back-end", "api", "database", "distributed", "systems"):
        return "software engineer"
    if has_any("games", "gaming", "game", "unity", "unreal"):
        return "software engineer"
    return "software engineer"


def _job_market_query(payload: AnalyzeRequest) -> str:
    if not _is_vague_goal(payload.career_goal):
        return payload.career_goal
    return _derive_role_from_interests(payload.interests)


def _role_for_field(field: str) -> str:
    f = (field or "").strip().lower()
    if not f:
        return "software engineer"
    if "cyber" in f or "security" in f or "crypt" in f:
        return "security engineer"
    if "machine learning" in f or f in {"ml", "ai"} or "artificial intelligence" in f or "deep learning" in f:
        return "machine learning engineer"
    if "data" in f or "analytics" in f:
        return "data scientist"
    if "web" in f or "frontend" in f or "ui" in f or "ux" in f or "hci" in f:
        return "frontend developer"
    if "network" in f:
        return "network engineer"
    if "systems" in f or "operating" in f or "distributed" in f:
        return "software engineer"
    return "software engineer"


async def stream_analyze(payload: AnalyzeRequest):
    """
    Progressive analyze pipeline streamed as SSE (text/event-stream).
    Emits NDJSON chunks for: status, fields, reasoning, electives, resources, done, error.
    """
    client = get_anthropic_client()
    context = _analyze_user_context(payload)

    # Initialize client-side partial state.
    yield _ndjson_sse({"type": "init"})
    yield _ndjson_sse({"type": "status", "stage": "starting", "message": "Warming up Luminary..."})
    await asyncio.sleep(0)

    # 0) Fields + reasoning first.
    yield _ndjson_sse({"type": "status", "stage": "fields", "message": "Picking the best tracks for you..."})
    fields_system = (
        "You are an AI career coach for computer science students. "
        "Return ONLY valid JSON (no markdown). "
        "Output schema: {\"fields\": string[], \"reasoning\": string}.\n\n"
        "Fields requirements:\n"
        "- Return EXACTLY 3 fields.\n"
        "- The 3 fields must be meaningfully different from each other (avoid near-duplicates or subfields under the same umbrella).\n"
        "- If two fields overlap heavily, replace the more specific/redundant one with a different area.\n"
        "- At least 1 field must connect the student's technical background with their non-technical interests (e.g., gaming/creativity).\n"
        "- Treat hobbies as career signals, not just personality traits.\n\n"
        "Reasoning requirements: 2–3 sentences in plain English explaining WHY you chose these fields, "
        "explicitly referencing the student's actual inputs (interests, math comfort, grade level, career goal)."
    )
    fields_text = await _anthropic_text(
        client=client,
        system=fields_system,
        user_text=context,
        max_tokens=450,
    )
    fields_data = _parse_model_json(fields_text, debug_context="stream_analyze:fields")
    fields = fields_data.get("fields", []) or []
    reasoning = str(fields_data.get("reasoning", "") or "").strip()
    yield _ndjson_sse({"type": "fields", "fields": fields})
    yield _ndjson_sse({"type": "reasoning", "reasoning": reasoning})

    # 0.5) Remaining required COMP roadmap (DPR + catalog)
    yield _ndjson_sse({"type": "status", "stage": "degree_roadmap", "message": "Building your degree roadmap..."})
    completed, in_progress = extract_comp_courses_from_dpr(payload.degree_progress_text or "")
    required_core = extract_required_comp_core_from_dpr(payload.degree_progress_text or "")
    catalog_by_number = {c["number"].split("/")[0].strip().upper(): c for c in CSUN_CATALOG}
    remaining_courses = build_remaining_degree_roadmap(
        required=required_core,
        completed=completed,
        in_progress=in_progress,
        catalog_by_number=catalog_by_number,
    )
    elective_units = extract_senior_elective_units_remaining(payload.degree_progress_text or "")
    if elective_units and elective_units > 0:
        remaining_courses.append(
            {
                "semester": "Senior electives",
                "courses": [
                    {
                        "number": f"{elective_units} units",
                        "name": "Senior electives remaining (400/500-level COMP).",
                        "prereq": "Choose eligible electives that fit your interests and schedule.",
                    }
                ],
            }
        )
    yield _ndjson_sse({"type": "remaining_courses", "remaining_courses": remaining_courses})

    # 1) Job market research (Adzuna) — once per field
    yield _ndjson_sse({"type": "status", "stage": "job_market", "message": "Researching the job market..."})

    async def _field_market(field_name: str) -> dict:
        role_query = _role_for_field(field_name)
        jm = await fetch_jobs(role_query)
        listings = jm.get("listings") or []

        companies: List[str] = []
        locations: List[str] = []
        titles: List[str] = []
        seen_companies = set()
        seen_locations = set()
        seen_titles = set()

        for l in listings:
            t = str((l or {}).get("title") or "").strip()
            if t and t not in seen_titles:
                seen_titles.add(t)
                titles.append(t)
            c = str((l or {}).get("company") or "").strip()
            if c and c not in seen_companies:
                seen_companies.add(c)
                companies.append(c)
            loc = str((l or {}).get("location") or "").strip()
            if loc:
                # Adzuna often includes county; keep the most user-friendly prefix.
                loc = loc.split(",")[0].strip()
            if loc and loc not in seen_locations:
                seen_locations.add(loc)
                locations.append(loc)

        return {
            "field": field_name,
            "median_salary": jm.get("median_salary", "Not listed"),
            "companies": companies[:3],
            "locations": locations[:3],
            "titles": titles[:3],
            "listings": listings,  # keep full listings for prompting resources
        }

    job_market_results: List[dict] = []
    # Stream results as they complete.
    tasks = [asyncio.create_task(_field_market(f)) for f in (fields or [])]
    for coro in asyncio.as_completed(tasks):
        res = await coro
        job_market_results.append(res)
        yield _ndjson_sse(
            {
                "type": "job_market",
                "field": res["field"],
                "median_salary": res["median_salary"],
                "companies": res["companies"],
                "locations": res["locations"],
                "titles": res["titles"],
            }
        )

    job_market_prompt = json.dumps(
        [
            {"field": r["field"], "listings": r.get("listings", [])}
            for r in job_market_results
        ],
        ensure_ascii=False,
    )

    # 2) Electives (catalog-driven; fast)
    yield _ndjson_sse({"type": "status", "stage": "electives", "message": "Matching electives to your interests..."})
    top_field = fields[0] if fields else payload.career_goal
    electives = suggest_electives(field_name=str(top_field), grade_level=payload.grade_level)
    completed, in_progress = extract_comp_courses_from_dpr(payload.degree_progress_text or "")

    filtered: List[dict] = []
    for e in electives:
        num = _normalize_course_number(str((e or {}).get("number") or ""))
        if num and num in completed:
            continue
        if num and num in in_progress:
            e = {**e, "in_progress": True}
        filtered.append(e)

    yield _ndjson_sse({"type": "electives", "electives": filtered})

    # 3) Resources
    yield _ndjson_sse({"type": "status", "stage": "resources", "message": "Curating resources for your skill gaps..."})
    resources_system = (
        "You are an AI career coach. Return ONLY valid JSON (no markdown). "
        "Output schema: {\"resources\": [{\"skill\": string, \"items\": string[]}]}.\n"
        "Give 4–6 skills. Each should have 3–6 specific resources (courses, docs, playlists, practice sites)."
        "Prioritize skills that appear frequently in the provided job listing descriptions."
    )
    resources_user = (
        context
        + "\nSelected fields:\n"
        + json.dumps(fields, ensure_ascii=False)
        + "\nJob market listings (by field):\n"
        + job_market_prompt
    )
    resources_text = await _anthropic_text(
        client=client,
        system=resources_system,
        user_text=resources_user,
        max_tokens=800,
    )
    resources_data = _parse_model_json(resources_text, debug_context="stream_analyze:resources")
    resources = resources_data.get("resources", []) or []
    yield _ndjson_sse({"type": "resources", "resources": resources})

    yield _ndjson_sse({"type": "done"})


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Single-turn Q&A endpoint.
    The client sends the user's question plus the plan/profile context; the server returns one answer.
    """
    client = get_anthropic_client()

    system_prompt = (
        "You are Luminary, an academic advisor for computer science students. "
        "Answer the student's question using the provided context. "
        "Be concise, practical, and specific. "
        "If the context doesn't contain enough information, say what you'd need next. "
        "Do not output JSON; return plain text only."
    )

    user_text = (
        "Context (student profile):\n"
        f"{json.dumps(request.profile, ensure_ascii=False)}\n\n"
        "Context (their generated plan):\n"
        f"{json.dumps(request.plan, ensure_ascii=False)}\n\n"
        f"Question: {request.question}\n"
    )

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        system=system_prompt,
        messages=[{"role": "user", "content": [{"type": "text", "text": user_text}]}],
    )

    text_chunks: List[str] = []
    for block in getattr(response, "content", None) or []:
        if getattr(block, "type", None) == "text" and getattr(block, "text", None):
            text_chunks.append(block.text)

    debug_context = (
        f"stop_reason={getattr(response, 'stop_reason', None)}, "
        f"blocks={_summarize_anthropic_content_blocks(getattr(response, 'content', None))}"
    )
    answer = ("\n".join(text_chunks) or "").strip()
    if not answer:
        raise HTTPException(
            status_code=502,
            detail=f"Model returned empty answer text. Context: {debug_context}",
        )

    return ChatResponse(answer=answer)


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


@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    async def event_stream():
        try:
            async for chunk in stream_analyze(request):
                yield chunk
        except HTTPException as exc:
            # Emit a final error chunk so the frontend can show it.
            yield _ndjson_sse({"type": "error", "detail": exc.detail})
        except Exception as exc:
            yield _ndjson_sse({"type": "error", "detail": str(exc)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

