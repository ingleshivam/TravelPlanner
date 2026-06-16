# from groq import Groq
# import os
# import json
# from dotenv import load_dotenv

# load_dotenv()

# if not os.getenv("GROQ_API_KEY"):
#     raise RuntimeError("Missing GROQ_API_KEY. Add it to .env before starting the API.")

# TRAIN_DETAILS_PROMPT = """
# You are a train information extraction assistant with access to web search.

# Task:
# 1. Search the web for the train journey information requested by the user.
# 2. Identify the most reliable source containing the train details.
# 3. Extract the required information.
# 4. Return the result strictly according to the output schema.
# 5. Do not return explanations, reasoning, citations, or additional fields.
# 6. If a field cannot be found, return an empty string.

# Fields to extract:
# - train_number: Train number.
# - train_name: Train name.
# - departure_time_from_origin: Departure time from the originating station.
# - arrival_time_at_destination: Arrival time at the destination station.
# - total_duration: Total journey duration.
# - fare: Train fare.

# Extraction Rules:
# - Use only information found from web search results.
# - Prefer official railway sources when available.
# - Do not guess or infer missing values.
# - If multiple fares exist, return the base/general fare shown for the journey.
# - Preserve the exact format of times and duration as displayed on the source.

# Return Array of JSON object matching this schema:

# [{
#   "train_number": 0,
#   "train_name": "",
#   "departure_time_from_origin": "",
#   "arrival_time_at_destination": "",
#   "total_duration": "",
#   "fare": ""
# }]
# """

# client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# response = client.chat.completions.create(
#     model="openai/gpt-oss-120b",
#     messages=[
#         {"role": "system", "content": TRAIN_DETAILS_PROMPT},
#         {"role": "user", "content": "Find me train from Pune to Parbhani"},
#     ],
#     max_completion_tokens=1000,
#     temperature=0,
#     tools=[{"type": "browser_search"}],
#     reasoning_effort="medium",
#     stream=False,
#     stop=None,
# )

# print("TRAIN RESULTS:", response.choices[0].message.content)

import os
import serpapi
from dotenv import load_dotenv

load_dotenv()

prompt = """
Find me trains from Pune to Parbhani.
The data should include train name, train number, train departure time from source station, train arrival time at destination station, total journey time and fare.
Return the result in JSON structure.
[
	{{
		train_number :,
		train_name:,
		train_departure_time_from_source_station:,
		train_arrival_time_at_destination_station:,
		total_journey_time:,
		fare :,
	}}
]
"""


client = serpapi.Client(api_key=os.getenv("SERPAPI_API_KEY"))
results = client.search({
  "engine": "google_ai_mode",
  "q": prompt
})
 
print(results)


# import json

# with open("serpapi_result.json", "r", encoding="utf-8") as f:
#     results = json.load(f)

# # Extract the JSON code block from text_blocks
# code_block = next(
#     (b["code"] for b in results["text_blocks"] if b["type"] == "code_block" and b["language"] == "json"),
#     None
# )

# trains = json.loads(code_block)
# print(json.dumps(trains, indent=2, ensure_ascii=True))