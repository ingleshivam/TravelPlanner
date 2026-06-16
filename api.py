import asyncio

from typing import Dict, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

import chat_session as cs

load_dotenv()


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


class GenUI(BaseModel):
    type: str  # "missing_fields_form" | "budget_allocation_form" | "travel_plan"
    data: Dict = {}


class ChatResponse(BaseModel):
    session_id: str
    stage: str   # "info_collection" | "budget_allocation" | "complete"
    reply: str
    awaiting_info: bool
    genui: Optional[GenUI] = None
    plan: Optional[Dict] = None


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}



@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> Dict:
    session = cs.get_or_create(request.session_id)
    session["history"].append({"role": "user", "content": request.message})
    stage = session.get("stage", "info_collection")

    # ── Stage 1: collect all required trip info ────────────────────────────────
    if stage == "info_collection":
        new_params = await run_in_threadpool(cs.extract_params, session["history"])
        session["params"].update(new_params)
        missing = cs.missing_fields(session["params"])

        if missing:
            reply = await run_in_threadpool(cs.follow_up_question, session["history"], missing)
            session["history"].append({"role": "assistant", "content": reply})
            return {
                "session_id": request.session_id,
                "stage": "info_collection",
                "reply": reply,
                "awaiting_info": True,
                "genui": {
                    "type": "missing_fields_form",
                    "data": {"missing_fields": missing, "collected": session["params"]},
                },
            }

        # All info in hand — advance to budget allocation stage
        session["stage"] = "budget_allocation"
        params = session["params"]
        total = float(params["budget"])
        default_alloc = cs.DEFAULT_ALLOCATION
        amounts = {k: round(total * v / 100, 2) for k, v in default_alloc.items()}
        reply = cs.budget_allocation_message(params, default_alloc, amounts)
        session["history"].append({"role": "assistant", "content": reply})
        return {
            "session_id": request.session_id,
            "stage": "budget_allocation",
            "reply": reply,
            "awaiting_info": True,
            "genui": {
                "type": "budget_allocation_form",
                "data": {
                    "total_budget": total,
                    "currency": params.get("currency", ""),
                    "currency_symbol": params.get("currency_symbol", ""),
                    "default_allocation": default_alloc,
                    "allocation_amounts": amounts,
                },
            },
        }
    
    # ── Stage 2: confirm / adjust budget allocation, then plan ────────────────
    if stage == "budget_allocation":
        budget_alloc = await run_in_threadpool(
            cs.extract_budget_allocation, session["history"], cs.DEFAULT_ALLOCATION
        )
        session["budget_allocation"] = budget_alloc

        try:
            plan = await asyncio.wait_for(
                run_in_threadpool(cs.process_travel_plan, session["params"], budget_alloc),
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

        session["stage"] = "complete"
        overview = (plan.get("trip_overview") or {})
        dest = overview.get("destination") or session["params"].get("destination") or "your destination"
        reply = f"Here's your complete {session['params']['num_days']}-day travel plan to {dest}!"
        session["history"].append({"role": "assistant", "content": reply})
        return {
            "session_id": request.session_id,
            "stage": "complete",
            "reply": reply,
            "awaiting_info": False,
            "genui": {"type": "travel_plan", "data": plan},
            "plan": plan,
        }

    # ── Stage 3: plan already generated ───────────────────────────────────────
    reply = "Your travel plan is ready above. Would you like to plan another trip?"
    session["history"].append({"role": "assistant", "content": reply})
    return {
        "session_id": request.session_id,
        "stage": "complete",
        "reply": reply,
        "awaiting_info": False,
    }
