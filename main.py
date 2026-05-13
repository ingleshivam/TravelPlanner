import os
from graph import travel_planner
from dotenv import load_dotenv

load_dotenv()

initial_state = {
    "user_budget": 1500.0,
    "origin": "Mumbai, India",
    "destination": "Tramabakeshwar, Nashik",            # let destination_researcher decide
    "start_date": "2025-09-10",
    "end_date": "2025-09-17",
    "num_days": 2,
    "num_travelers": 1,
    "travel_style": "budget-backpacker",
    "interests": ["culture", "street food", "temples", "markets"],

    # Agent outputs (empty to start)
    "destination_research": None,
    "transport_plan": None,
    "accommodation_plan": None,
    "itinerary": None,
    "budget_summary": None,

    # Control flow
    "next_agent": "",
    "budget_overrun": False,
    "overrun_amount": 0.0,
    "reroute_count": 0,
    "messages": [],
    "final_plan_ready": False,
}

result = travel_planner.invoke(initial_state)

import json
print(json.dumps(result["budget_summary"], indent=2))
print(json.dumps(result["itinerary"]["itinerary"][:2], indent=2))  # first 2 days