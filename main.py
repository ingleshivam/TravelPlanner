import os
import json
from graph import travel_planner
from dotenv import load_dotenv

load_dotenv()

initial_state = {
    "user_budget": 1000.0,
    "currency": "",         # filled by currency_inference_node
    "currency_symbol": "",  # filled by currency_inference_node
    "origin": "Pune, India",
    "destination": "Mumbai, India",            # let destination_researcher decide
    "start_date": "2025-09-10",
    "end_date": "2025-09-17",
    "num_days": 7,
    "num_travelers": 1,
    "travel_style": "budget-backpacker",
    "interests": ["culture", "street food", "temples", "markets"],
    "budget_allocation": {
        "transport": 35,
        "accommodation": 35,
        "food": 15,
        "activities": 10,
        "misc": 5,
    },

    # Agent outputs (empty to start)
    "destination_research": None,
    "transport_plan": None,
    "accommodation_plan": None,
    "itinerary": None,
    "budget_summary": None,

    # Control flow
    "budget_overrun": False,
    "overrun_amount": 0.0,
    "budget_constraint_message": None,
    "reroute_count": 0,
    "step_count": 0,
    "messages": [],
    "final_plan_ready": False,
}

result = travel_planner.invoke(initial_state)

sym = result.get("currency_symbol", "")
cur = result.get("currency", "")


def fmt(amount: float) -> str:
    return f"{sym}{amount:,.2f} {cur}".strip()


def print_budget_summary(summary: dict) -> None:
    s = summary["budget_summary"]
    print(f"\n{'='*50}")
    print(f"  BUDGET SUMMARY  ({cur})")
    print(f"{'='*50}")
    print(f"  Total Budget       : {fmt(s['total_budget'])}")
    print(f"  Total Estimated    : {fmt(s['total_estimated_cost'])}")
    print(f"  Remaining Buffer   : {fmt(s['remaining_buffer'])}")
    print(f"  Status             : {s['status']}")
    print(f"\n  Breakdown:")
    for k, v in s["breakdown"].items():
        print(f"    {k:<35}: {fmt(v)}")
    print(f"\n  Verdict: {s['verdict']}")
    if s.get("top_savings_opportunities"):
        print(f"\n  Savings Tips:")
        for tip in s["top_savings_opportunities"]:
            print(f"    - {tip}")
    print(f"{'='*50}\n")


def print_itinerary_days(days: list) -> None:
    for day in days:
        print(f"--- Day {day['day']}: {day['theme']} ---")
        print(f"  Morning   : {day['morning']['activity']} ({fmt(day['morning']['cost'])})")
        print(f"  Breakfast : {day['breakfast']['place_type']} ({fmt(day['breakfast']['cost'])})")
        print(f"  Afternoon : {day['afternoon']['activity']} ({fmt(day['afternoon']['cost'])})")
        print(f"  Lunch     : {day['lunch']['place_type']} ({fmt(day['lunch']['cost'])})")
        print(f"  Evening   : {day['evening']['activity']} ({fmt(day['evening']['cost'])})")
        print(f"  Dinner    : {day['dinner']['place_type']} ({fmt(day['dinner']['cost'])})")
        print(f"  Transport : {fmt(day['local_transport'])}")
        print(f"  Day Total : {fmt(day['day_total'])}")
        print(f"  Tip       : {day['budget_tip']}\n")


print("\n===== RAW AGENT OUTPUTS =====\n")
for key in ("destination_research", "transport_plan", "accommodation_plan", "itinerary", "budget_summary"):
    value = result.get(key)
    if value is not None:
        print(f"--- {key.upper()} ---")
        print(json.dumps(value, indent=2, ensure_ascii=False))
        print()

print_budget_summary(result["budget_summary"])
print_itinerary_days(result["itinerary"]["itinerary"])
