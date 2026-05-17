import asyncio
from typing import Dict, List, Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator
from starlette.concurrency import run_in_threadpool

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
            timeout=120.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Travel plan generation timed out after 120 seconds.")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Travel plan generation failed. Check API key, model output, and server logs.",
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
    }
