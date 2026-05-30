import asyncio
from datetime import date, timedelta
from typing import Dict, List, Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator
from starlette.concurrency import run_in_threadpool

import chat_session as cs
from graph import travel_planner

load_dotenv()


class BudgetAllocation(BaseModel):
    transport: float = Field(default=35, ge=0, le=100)
    accommodation: float = Field(default=35, ge=0, le=100)
    food: float = Field(default=15, ge=0, le=100)
    activities: float = Field(default=10, ge=0, le=100)
    misc: float = Field(default=5, ge=0, le=100)

    @model_validator(mode="after")
    def validate_total(self) -> "BudgetAllocation":
        total = (
            self.transport
            + self.accommodation
            + self.food
            + self.activities
            + self.misc
        )
        if total > 100:
            raise ValueError("Budget allocation total must be 100% or less.")
        return self


class TravelPlanRequest(BaseModel):
    user_budget: float = Field(gt=0)
    origin: str = Field(min_length=2)
    destination: Optional[str] = Field(default=None)
    start_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    num_days: int = Field(gt=0, le=60)
    num_travelers: int = Field(gt=0, le=20)
    travel_style: Literal["budget-backpacker", "mid-range", "comfort-budget"]
    interests: List[str] = Field(default_factory=list)
    budget_allocation: BudgetAllocation = Field(default_factory=BudgetAllocation)

    @field_validator("destination", mode="before")
    @classmethod
    def normalize_destination(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str) and not value.strip():
            return None
        return value


class TravelPlanResponse(BaseModel):
    currency: str
    currency_symbol: str
    destination: Optional[str]
    destination_research: Optional[Dict] = None
    transport_plan: Optional[Dict] = None
    accommodation_plan: Optional[Dict] = None
    itinerary: Optional[Dict] = None
    budget_summary: Optional[Dict] = None
    final_plan_ready: bool
    raw_search_destination: Optional[str] = None
    raw_search_transport: Optional[str] = None
    raw_search_accommodation: Optional[str] = None
    raw_search_itinerary: Optional[str] = None


app = FastAPI(
    title="TravelPlanner API",
    description="AI multi-agent travel planner powered by LangGraph.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    plan: Optional[TravelPlanResponse] = None
    awaiting_info: bool = True


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/travel-plan", response_model=TravelPlanResponse)
async def create_travel_plan(request: TravelPlanRequest) -> Dict:
    initial_state = {
        "user_budget": request.user_budget,
        "currency": "",
        "currency_symbol": "",
        "origin": request.origin,
        "destination": request.destination,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "num_days": request.num_days,
        "num_travelers": request.num_travelers,
        "travel_style": request.travel_style,
        "interests": request.interests,
        "budget_allocation": request.budget_allocation.model_dump(),
        "destination_research": None,
        "transport_plan": None,
        "accommodation_plan": None,
        "itinerary": None,
        "budget_summary": None,
        "raw_search_destination": None,
        "raw_search_transport": None,
        "raw_search_accommodation": None,
        "raw_search_itinerary": None,
        "budget_overrun": False,
        "overrun_amount": 0.0,
        "budget_constraint_message": None,
        "reroute_count": 0,
        "step_count": 0,
        "messages": [],
        "final_plan_ready": False,
    }

    try:
        result = await asyncio.wait_for(
            run_in_threadpool(travel_planner.invoke, initial_state),
            timeout=240.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Travel plan generation timed out after 120 seconds.")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        import traceback
        raise HTTPException(
            status_code=500,
            detail=f"Travel plan generation failed: {type(exc).__name__}: {exc}\n{traceback.format_exc()}",
        ) from exc

    return {
        "currency": result.get("currency", ""),
        "currency_symbol": result.get("currency_symbol", ""),
        "destination": result.get("destination"),
        "destination_research": result.get("destination_research"),
        "transport_plan": result.get("transport_plan"),
        "accommodation_plan": result.get("accommodation_plan"),
        "itinerary": result.get("itinerary"),
        "budget_summary": result.get("budget_summary"),
        "final_plan_ready": result.get("final_plan_ready", False),
        "raw_search_destination": result.get("raw_search_destination"),
        "raw_search_transport": result.get("raw_search_transport"),
        "raw_search_accommodation": result.get("raw_search_accommodation"),
        "raw_search_itinerary": result.get("raw_search_itinerary"),
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> Dict:
    session = cs.get_or_create(request.session_id)
    session["history"].append({"role": "user", "content": request.message})

    new_params = await run_in_threadpool(cs.extract_params, session["history"])
    session["params"].update(new_params)
    params = session["params"]

    missing = cs.missing_fields(params)

    if missing:
        reply = await run_in_threadpool(cs.follow_up_question, session["history"], missing)
        session["history"].append({"role": "assistant", "content": reply})
        return {"session_id": request.session_id, "reply": reply, "plan": None, "awaiting_info": True}

    start = date.fromisoformat(params["start_date"])
    end_date = (start + timedelta(days=int(params["num_days"]))).isoformat()

    initial_state = {
        "user_budget": params["budget"],
        "currency": "",
        "currency_symbol": "",
        "origin": params["origin"],
        "destination": params.get("destination") or None,
        "start_date": params["start_date"],
        "end_date": end_date,
        "num_days": int(params["num_days"]),
        "num_travelers": int(params["num_travelers"]),
        "travel_style": params["travel_style"],
        "interests": params.get("interests") or [],
        "budget_allocation": {"transport": 35, "accommodation": 35, "food": 15, "activities": 10, "misc": 5},
        "destination_research": None,
        "transport_plan": None,
        "accommodation_plan": None,
        "itinerary": None,
        "budget_summary": None,
        "raw_search_destination": None,
        "raw_search_transport": None,
        "raw_search_accommodation": None,
        "raw_search_itinerary": None,
        "budget_overrun": False,
        "overrun_amount": 0.0,
        "budget_constraint_message": None,
        "reroute_count": 0,
        "step_count": 0,
        "messages": [],
        "final_plan_ready": False,
    }

    try:
        result = await asyncio.wait_for(
            run_in_threadpool(travel_planner.invoke, initial_state),
            timeout=240.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Travel plan generation timed out.")
    except Exception as exc:
        import traceback
        raise HTTPException(
            status_code=500,
            detail=f"Plan generation failed: {type(exc).__name__}: {exc}\n{traceback.format_exc()}",
        )

    dest = result.get("destination") or params.get("destination") or "your destination"
    reply = f"Here's your {params['num_days']}-day trip to {dest}! 🎉"
    session["history"].append({"role": "assistant", "content": reply})

    plan = {
        "currency": result.get("currency", ""),
        "currency_symbol": result.get("currency_symbol", ""),
        "destination": result.get("destination"),
        "destination_research": result.get("destination_research"),
        "transport_plan": result.get("transport_plan"),
        "accommodation_plan": result.get("accommodation_plan"),
        "itinerary": result.get("itinerary"),
        "budget_summary": result.get("budget_summary"),
        "final_plan_ready": result.get("final_plan_ready", False),
        "raw_search_destination": result.get("raw_search_destination"),
        "raw_search_transport": result.get("raw_search_transport"),
        "raw_search_accommodation": result.get("raw_search_accommodation"),
        "raw_search_itinerary": result.get("raw_search_itinerary"),
    }

    return {"session_id": request.session_id, "reply": reply, "plan": plan, "awaiting_info": False}
