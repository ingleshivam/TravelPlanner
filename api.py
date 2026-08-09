import os

from typing import Dict

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from copilotkit import LangGraphAGUIAgent
from ag_ui_langgraph import add_langgraph_fastapi_endpoint

from graph import travel_planner

load_dotenv()


app = FastAPI(
    title="TravelPlanner API",
    description="AI multi-agent travel planner powered by LangGraph.",
    version="1.0.0",
)

_default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_extra_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


add_langgraph_fastapi_endpoint(
    app,
    LangGraphAGUIAgent(name="travel_planner", graph=travel_planner),
    "/copilotkit",
)
