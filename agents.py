import json
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
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

llm = ChatGroq(
    model="openai/gpt-oss-120b",
    temperature=0.2,
    api_key=os.environ["GROQ_API_KEY"]
)

# Supervisor stays plain text (it returns a routing keyword, not structured data)
def _plain_chain(system_prompt: str):
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])
    return prompt | llm

# Structured chains — schema is enforced at the LLM level (tool-calling / JSON mode)
def _structured_chain(system_prompt: str, schema):
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])
    return prompt | llm.with_structured_output(schema)


supervisor_chain    = _plain_chain(SUPERVISOR_SYSTEM_PROMPT)
researcher_chain    = _structured_chain(DESTINATION_RESEARCHER_PROMPT,  DestinationResearchOutput)
transport_chain     = _structured_chain(TRANSPORT_AGENT_PROMPT,         TransportPlanOutput)
accommodation_chain = _structured_chain(ACCOMMODATION_AGENT_PROMPT,     AccommodationPlanOutput)
itinerary_chain     = _structured_chain(ITINERARY_AGENT_PROMPT,         ItineraryOutput)
budget_chain        = _structured_chain(BUDGET_TRACKER_PROMPT,          BudgetTrackerOutput)