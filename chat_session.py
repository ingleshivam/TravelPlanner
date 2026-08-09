import json
from datetime import date
from typing import List, Optional

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

DEFAULT_ALLOCATION = {
    "transport": 35,
    "accommodation": 35,
    "food": 15,
    "activities": 10,
    "misc": 5,
}

_ALLOCATION_LABELS = {
    "transport": "Transport (flights / trains / buses)",
    "accommodation": "Accommodation",
    "food": "Food & dining",
    "activities": "Activities & sightseeing",
    "misc": "Miscellaneous buffer",
}


class _ExtractedParams(BaseModel):
    budget: Optional[float] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[str] = None
    num_days: Optional[int] = None
    num_travelers: Optional[int] = None
    travel_style: Optional[str] = None
    interests: Optional[List[str]] = None


class _BudgetAllocation(BaseModel):
    transport: int = DEFAULT_ALLOCATION["transport"]
    accommodation: int = DEFAULT_ALLOCATION["accommodation"]
    food: int = DEFAULT_ALLOCATION["food"]
    activities: int = DEFAULT_ALLOCATION["activities"]
    misc: int = DEFAULT_ALLOCATION["misc"]


def _today() -> str:
    return date.today().isoformat()


def _extract_prompt() -> str:
    return (
        f"Today is {_today()}. Extract travel parameters from the ENTIRE conversation into JSON.\n"
        "- Convert relative dates (next Saturday, this weekend, June 10) to YYYY-MM-DD.\n"
        "- If the user corrects a value later in the conversation, use the latest value.\n"
        "- Set start_date to null if the date is in the past (before today).\n"
        "- Map styles: budget/backpacker→budget-backpacker, mid/moderate→mid-range, comfort/luxury→comfort-budget.\n"
        "- Infer currency and currency_symbol from the origin city/country if not stated "
        "(e.g. Pune/Mumbai/Delhi → INR/₹, New York/LA → USD/$, London → GBP/£, Paris → EUR/€). "
        "currency must be an ISO 4217 code; currency_symbol its unicode symbol.\n"
        "- Extract ALL values mentioned anywhere in the conversation, not just the latest message.\n"
        'Schema: {{"budget": null, "currency": null, "currency_symbol": null, "origin": null, "destination": null, '
        '"start_date": null, "num_days": null, "num_travelers": null, "travel_style": null, "interests": null}}'
    )


def _budget_alloc_prompt(default: dict) -> str:
    default_escaped = json.dumps(default).replace("{", "{{").replace("}", "}}")
    return (
        "The user was shown a default budget allocation and asked if they want to change it. "
        f"Default: {default_escaped}. "
        "If the user confirms (yes, ok, looks good, proceed, sure, etc.) return the default values. "
        "If they request changes, adjust only the mentioned categories and redistribute the remaining "
        "percentage so all five values still sum to 100. "
        'Return JSON: {{"transport": int, "accommodation": int, "food": int, "activities": int, "misc": int}}'
    )


def _history_text(history: list) -> str:
    return "\n".join(f"{m['role'].upper()}: {m['content']}" for m in history[-10:])



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


def budget_allocation_message(params: dict, alloc: dict, amounts: dict) -> str:
    sym = params.get("currency_symbol", "")
    total = float(params["budget"])
    lines = [
        f"I have everything I need! Here's the default budget split for your "
        f"{sym}{total:,.0f} {params.get('currency', '')} trip:",
        "",
    ]
    for k, pct in alloc.items():
        lines.append(f"• {_ALLOCATION_LABELS.get(k, k.title())}: {pct}%  ({sym}{amounts[k]:,.0f})")
    lines += ["", "Proceed with this allocation, or tell me what you'd like to adjust."]
    return "\n".join(lines)


def extract_budget_allocation(history: list, default_alloc: dict) -> dict:
    from agents import llm
    prompt = ChatPromptTemplate.from_messages([
        ("system", _budget_alloc_prompt(default_alloc)),
        ("human", "{conv}"),
    ])
    chain = prompt | llm.with_structured_output(_BudgetAllocation, method="json_mode")
    try:
        result = chain.invoke({"conv": _history_text(history)})
        return result.model_dump()
    except Exception as e:
        print(f"[chat_session] extract_budget_allocation failed: {e}")
        return default_alloc.copy()
