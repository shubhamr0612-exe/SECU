"""Structured knowledge retrieval layer.

The knowledge base is stored in MongoDB (editable via the admin dashboard) and
passed in as a dict. The JSON files under /knowledge are used only to SEED the DB
the first time. Returns only the sections relevant to a query (keyword based).
Designed to be upgraded to RAG + a vector DB later without changing the interface.
"""
import json
from pathlib import Path

KNOWLEDGE_DIR = Path(__file__).resolve().parents[2] / "knowledge"

SECTIONS = ["institute", "courses", "seminars", "faq", "contact"]

_TOPIC_KEYWORDS = {
    "courses": ["course", "courses", "duration", "days", "syllabus", "learn", "class",
                "batch", "fee", "fees", "price", "cost", "cyber security course"],
    "seminars": ["seminar", "seminars", "workshop", "event", "session"],
    "institute": ["esecurityin", "institute", "about", "who are you", "company",
                  "organisation", "organization"],
    "faq": ["discount", "job", "placement", "guarantee", "certificate", "certification",
            "faq", "question"],
    "contact": ["contact", "phone", "email", "address", "reach", "call", "location"],
}


def _load_file(name: str) -> dict:
    path = KNOWLEDGE_DIR / f"{name}.json"
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def seed() -> dict:
    """Build the initial KB dict from the JSON seed files."""
    return {name: _load_file(name) for name in SECTIONS}


def retrieve(query: str, kb: dict) -> dict:
    """Return only KB sections relevant to the query. Always include institute."""
    q = (query or "").lower()
    kb = kb or {}
    relevant = {"institute": kb.get("institute", {})}
    for topic, keywords in _TOPIC_KEYWORDS.items():
        if topic == "institute":
            continue
        if any(k in q for k in keywords):
            relevant[topic] = kb.get(topic, {})
    if len(relevant) == 1:
        relevant["courses"] = kb.get("courses", {})
    return relevant


def as_context_string(query: str, kb: dict) -> str:
    data = retrieve(query, kb)
    return json.dumps(data, ensure_ascii=False, indent=2)
