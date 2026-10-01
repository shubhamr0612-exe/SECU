"""Structured knowledge retrieval layer.

Loads approved knowledge from /app/backend/knowledge/*.json and returns only the
relevant sections for a given user query (keyword based). Designed to be upgraded
to RAG + a vector DB later without changing the agent interface.
"""
import json
from pathlib import Path

KNOWLEDGE_DIR = Path(__file__).resolve().parents[2] / "knowledge"

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


def _load(name: str) -> dict:
    path = KNOWLEDGE_DIR / f"{name}.json"
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_all() -> dict:
    return {name: _load(name) for name in _TOPIC_KEYWORDS}


def retrieve(query: str) -> dict:
    """Return only knowledge sections relevant to the query. Always include institute."""
    q = (query or "").lower()
    relevant = {"institute": _load("institute")}
    for topic, keywords in _TOPIC_KEYWORDS.items():
        if topic == "institute":
            continue
        if any(k in q for k in keywords):
            relevant[topic] = _load(topic)
    # If nothing matched, give a small default context (institute + courses)
    if len(relevant) == 1:
        relevant["courses"] = _load("courses")
    return relevant


def as_context_string(query: str) -> str:
    data = retrieve(query)
    return json.dumps(data, ensure_ascii=False, indent=2)
