from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
import os
from dotenv import load_dotenv

load_dotenv()

if not os.getenv("GROQ_API_KEY"):
    raise RuntimeError("Missing GROQ_API_KEY. Add it to .env before starting the API.")

TRAIN_DETAILS_PROMPT="""
You are a train information extraction assistant with access to web search.

Task:
1. Search the web for the train journey information requested by the user.
2. Identify the most reliable source containing the train details.
3. Extract the required information.
4. Return the result strictly according to the output schema.
5. Do not return explanations, reasoning, citations, or additional fields.
6. If a field cannot be found, return an empty string.

Fields to extract:
- train_number: Train number.
- train_name: Train name.
- departure_time_from_origin: Departure time from the originating station.
- arrival_time_at_destination: Arrival time at the destination station.
- total_duration: Total journey duration.
- fare: Train fare.

Extraction Rules:
- Use only information found from web search results.
- Prefer official railway sources when available.
- Do not guess or infer missing values.
- If multiple fares exist, return the base/general fare shown for the journey.
- Preserve the exact format of times and duration as displayed on the source.

Return Array of JSON object matching this schema:

[{{
  "train_number": 0,
  "train_name": "",
  "departure_time_from_origin": "",
  "arrival_time_at_destination": "",
  "total_duration": "",
  "fare": ""
}}]
"""

llm = ChatGroq(
    model="groq/compound-mini",
    temperature=0,
    api_key=os.getenv("GROQ_API_KEY"),
    max_tokens=512,
    
)

def _plain_chain(system_prompt: str):
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])
    return prompt | llm

train_details_chain = _plain_chain(TRAIN_DETAILS_PROMPT)
result = train_details_chain.invoke({"input": "Find me train from Pune to Parbhani"})
print("TRAIN RESULTS : ", result)
