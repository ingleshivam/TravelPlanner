from datetime import date
from typing import Dict, List, Optional

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

_REQUIRED = ["origin", "budget", "start_date", "num_days", "num_travelers", "travel_style"]
_sessions: Dict[str, dict] = {}


class _ExtractedParams(BaseModel):
    budget: Optional[float] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[str] = None
    num_days: Optional[int] = None
    num_travelers: Optional[int] = None
    travel_style: Optional[str] = None
    interests: Optional[List[str]] = None


def _today() -> str:
    return date.today().isoformat()


def _extract_prompt() -> str:
    return (
        f"Today is {_today()}. Extract travel parameters from the ENTIRE conversation into JSON.\n"
        "- Convert relative dates (next Saturday, this weekend, June 10) to YYYY-MM-DD.\n"
        "- If the user corrects a value later in the conversation, use the latest value.\n"
        "- Set start_date to null if the date is in the past (before today).\n"
        "- Map styles: budget/backpacker→budget-backpacker, mid/moderate→mid-range, comfort/luxury→comfort-budget.\n"
        "- Extract ALL values mentioned anywhere in the conversation, not just the latest message.\n"
        'Schema: {{"budget": null, "origin": null, "destination": null, "start_date": null, '
        '"num_days": null, "num_travelers": null, "travel_style": null, "interests": null}}'
    )


def _followup_prompt() -> str:
    return (
        f"Today is {_today()}. You are a friendly AI travel planning assistant. "
        "Ask the user for the missing information listed below. "
        "Be brief (1-2 sentences). Ask for all missing items in one go."
    )


def _history_text(history: list) -> str:
    return "\n".join(f"{m['role'].upper()}: {m['content']}" for m in history[-10:])


def get_or_create(session_id: str) -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {"history": [], "params": {}}
    return _sessions[session_id]


def clear(session_id: str) -> None:
    _sessions.pop(session_id, None)


def extract_params(history: list) -> dict:
    from agents import llm
    prompt = ChatPromptTemplate.from_messages([
        ("system", _extract_prompt()),
        ("human", "{conv}"),
    ])
    chain = prompt | llm.with_structured_output(_ExtractedParams, method="json_mode")
    try:
        result = chain.invoke({"conv": _history_text(history)})
        return {k: v for k, v in result.model_dump().items() if v is not None}
    except Exception as e:
        print(f"[chat_session] extract_params failed: {e}")
        return {}


def missing_fields(params: dict) -> list:
    missing = [f for f in _REQUIRED if not params.get(f)]
    # Treat a past start_date as missing so the user is asked for a future date
    if "start_date" not in missing and params.get("start_date"):
        try:
            if date.fromisoformat(params["start_date"]) < date.today():
                missing.append("start_date")
        except ValueError:
            missing.append("start_date")
    return missing


def follow_up_question(history: list, missing: list) -> str:
    from agents import llm
    prompt = ChatPromptTemplate.from_messages([
        ("system", _followup_prompt()),
        ("human", "Conversation:\n{conv}\n\nMissing info needed: {missing}"),
    ])
    chain = prompt | llm
    try:
        return chain.invoke({
            "conv": _history_text(history),
            "missing": ", ".join(f.replace("_", " ") for f in missing),
        }).content
    except Exception:
        return f"Could you share your {missing[0].replace('_', ' ')}?"
