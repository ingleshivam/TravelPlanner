import json
import re
import time
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from groq import RateLimitError, APIStatusError
import os
from dotenv import load_dotenv

load_dotenv()

from schemas import (
    DestinationResearchOutput,
    TransportPlanOutput,
    AccommodationPlanOutput,
    ItineraryOutput,
    BudgetTrackerOutput,
)
from prompts import (
    SUPERVISOR_SYSTEM_PROMPT,
    DESTINATION_RESEARCHER_PROMPT,
    TRANSPORT_AGENT_PROMPT,
    ACCOMMODATION_AGENT_PROMPT,
    ITINERARY_AGENT_PROMPT,
    BUDGET_TRACKER_PROMPT,
)

if not os.getenv("GROQ_API_KEY"):
    raise RuntimeError("Missing GROQ_API_KEY. Add it to .env before starting the API.")

llm = ChatGroq(
    model="openai/gpt-oss-120b",
    temperature=0,
    api_key=os.getenv("GROQ_API_KEY"),
)


def invoke_with_retry(chain, input_data: dict, max_retries: int = 6):
    """Invoke a LangChain chain, retrying on 429 rate-limit and 413 payload-too-large errors."""
    for attempt in range(max_retries):
        try:
            return chain.invoke(input_data)
        except RateLimitError as exc:
            if attempt == max_retries - 1:
                raise
            m = re.search(r"try again in (\d+\.?\d*)s", str(exc))
            wait = float(m.group(1)) + 2.0 if m else min(4 * (2 ** attempt), 60)
            print(f"[rate-limit] waiting {wait:.1f}s before retry {attempt + 1}/{max_retries - 1} …")
            time.sleep(wait)
        except APIStatusError as exc:
            if exc.status_code != 413 or attempt == max_retries - 1:
                raise
            # Progressively truncate real_time_search_data and retry
            if "input" in input_data:
                try:
                    payload = json.loads(input_data["input"])
                    raw = payload.get("real_time_search_data", "")
                    if raw:
                        new_len = int(len(raw) * 0.6)
                        payload["real_time_search_data"] = raw[:new_len] + "\n[truncated]"
                        input_data = {**input_data, "input": json.dumps(payload)}
                        print(f"[413-too-large] truncated search data to {new_len} chars, retry {attempt + 1}/{max_retries - 1}")
                        continue
                except (json.JSONDecodeError, TypeError):
                    pass
            raise


def _plain_chain(system_prompt: str):
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])
    return prompt | llm

def _structured_chain(system_prompt: str, schema):
    if "json" not in system_prompt.lower():
        system_prompt = system_prompt + "\nRespond with JSON only."
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])
    return prompt | llm.with_structured_output(schema, method="json_mode")


supervisor_chain    = _plain_chain(SUPERVISOR_SYSTEM_PROMPT)
researcher_chain    = _structured_chain(DESTINATION_RESEARCHER_PROMPT,  DestinationResearchOutput)
transport_chain     = _structured_chain(TRANSPORT_AGENT_PROMPT,         TransportPlanOutput)
accommodation_chain = _structured_chain(ACCOMMODATION_AGENT_PROMPT,     AccommodationPlanOutput)
itinerary_chain     = _structured_chain(ITINERARY_AGENT_PROMPT,         ItineraryOutput)
budget_chain        = _structured_chain(BUDGET_TRACKER_PROMPT,          BudgetTrackerOutput)
