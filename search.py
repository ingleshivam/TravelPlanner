import os
import re
from datetime import datetime
from typing import List, Optional

from firecrawl import FirecrawlApp
from pydantic import AliasChoices, BaseModel, Field
from tavily import TavilyClient

from agents import _plain_chain, _structured_chain, invoke_with_retry

_tavily_client: TavilyClient | None = None
_fc_client: FirecrawlApp | None = None


def _get_tavily() -> TavilyClient:
    global _tavily_client
    if _tavily_client is None:
        key = os.getenv("TAVILY_API_KEY")
        if not key:
            raise RuntimeError("Missing TAVILY_API_KEY. Add it to .env.")
        _tavily_client = TavilyClient(api_key=key)
    return _tavily_client


def _get_fc() -> FirecrawlApp:
    global _fc_client
    if _fc_client is None:
        key = os.getenv("FIRECRAWL_API_KEY")
        if not key:
            raise RuntimeError("Missing FIRECRAWL_API_KEY. Add it to .env.")
        _fc_client = FirecrawlApp(api_key=key)
    return _fc_client


def web_search(query: str, domains:list, max_results: int = 1) -> str:
    try:
        response = _get_tavily().search(query=query, max_results=max_results, search_depth="advanced", include_domains=["goibibo.com"], exclude_domains=domains)
        results = response.get("results", [])
        if not results:
            return "No results found."
        return "\n".join(f"- {r['title']}: {r['content']}" for r in results)
    except Exception as e:
        return f"(Search unavailable: {e})"


def _scrape(url: str, wait_ms: int = 0) -> str:
    try:
        result = _get_fc().scrape(url, wait_for=wait_ms or None)
        return result.markdown
    except Exception as e:
        return f"(Scrape unavailable: {e})"


def _strip_markup_for_accomodation(text: str) -> str:
    lines = text.splitlines()
    for i, l in enumerate(lines):
        if l.strip().startswith('**'):
            lines = lines[i:]
            break
    lines = [l for l in lines if not re.match(r'^\s*(\[!\[|!\[|-\s*!\[|\\\\)', l)]
    text = '\n'.join(lines)
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'\n\s*\n+', '\n', text)
    return '\n'.join(text.strip().splitlines()[:300])

def accomodation_url(checkin: str, checkout: str, travelers: str, destination: str) -> str:
    room = 1
    if travelers > 2:
        room = travelers  / 2
    return (
        f"https://www.ixigo.com/hotels/search/result?locationName={destination}&checkinDate={checkin}&checkoutDate={checkout}&adultCount={travelers}&roomCount={int(room)}&childCount=0&&sort=SC_P_LH"
        
        # f"https://www.ixigo.com/hotels/search/result?locationId=982&locationName=Mumbai&locationType=C&masterLocationId=49654&countryId=1&checkinDate=27052026&checkoutDate=28052026&adultCount=2&roomCount=1&childCount=0&&sort=SC_P_LH"
    )

def search_transport_prices(origin: str, destination: str, start_date: str) -> str:
    
    query = f"Latest flights from {origin} to {destination} on {start_date}"
    
    content  = web_search(query=query,domains=[])
        
    FLIGHT_INFORMATION_SYSTEM_PROMPT = """
        Using only the provided flight search results and scraped travel data, generate a structured and professional flight information summary for the requested route.

        Strict Instructions / Guardrails:

        Use ONLY the information explicitly present in the provided data.
        Do NOT add assumptions, external knowledge, predictions, or self-generated details.
        Do NOT infer missing information.
        Do NOT include unrelated search results or irrelevant content.
        Do NOT rewrite information creatively.
        Do NOT add city descriptions, tourism suggestions, or extra travel advice unless explicitly present in the data.
        Do NOT provide information that is not requested in this prompt.
        Do NOT “think” beyond the supplied dataset.
        If information is missing, simply omit it instead of guessing.
        Preserve factual accuracy from the source data.
        Re-structure and summarize the data cleanly without changing meaning.
        Avoid duplicate statements and noisy scraped text.

        The output should include only:

        Departure and arrival airport codes
        Approximate distance
        Flight duration
        Airlines mentioned
        Fare ranges mentioned
        Cheapest month/date information if available
        Schedule/timing information if available
        Direct vs connecting flight details if available
        Alternative transport comparison only if explicitly mentioned in the data
        Booking/timing notes only if explicitly mentioned

        Formatting Requirements:

        Use professional headings.
        Use bullet points and tables where useful
        Keep the response concise, clean, and traveler-friendly
        Present the information like a professional travel assistant or airline summary

        Final Rule:

        Transform the provided raw data into a cleaner structured format only.
        Do not generate new facts under any circumstance.
    """
    
    chain  = _plain_chain(system_prompt=FLIGHT_INFORMATION_SYSTEM_PROMPT)
    print("Flight chain output : ", chain)
    result = invoke_with_retry(chain, {"input": content})
    print("\n\nFlight Information from Web Search : ", result)

    return result.content


def search_train_prices(origin: str, destination: str, start_date: str) -> str:

    query = f"Latest trains from {origin} to {destination} on {start_date}"

    content = web_search(query=query,domains=["erail.in","rome2rio.com","easemytrip.com"])

    TRAIN_INFORMATION_SYSTEM_PROMPT = """
        Using only the provided train search results and scraped travel data, generate a structured and professional train information summary for the requested route.

        Strict Instructions / Guardrails:

        Use ONLY the information explicitly present in the provided data.
        Do NOT add assumptions, external knowledge, predictions, or self-generated details.
        Do NOT infer missing information.
        Do NOT include unrelated search results or irrelevant content.
        Do NOT rewrite information creatively.
        Do NOT add city descriptions, tourism suggestions, or extra travel advice unless explicitly present in the data.
        Do NOT provide information that is not requested in this prompt.
        Do NOT "think" beyond the supplied dataset.
        If information is missing, simply omit it instead of guessing.
        Preserve factual accuracy from the source data.
        Avoid duplicate statements and noisy scraped text.

        The output should include only:

        Departure and arrival station names
        Approximate distance
        Journey duration
        Train names/numbers mentioned
        Class options and fares mentioned
        date/timing information if available
        Schedule/timing information if available        

        Formatting Requirements:

        Use professional headings.
        Use bullet points and tables where useful
        Keep the response concise, clean, and traveler-friendly
        Present the information like a professional travel assistant or railway summary

        Final Rule:

        Transform the provided raw data into a cleaner structured format only.
        Do not generate new facts under any circumstance.
    """

    chain  = _plain_chain(system_prompt=TRAIN_INFORMATION_SYSTEM_PROMPT)
    result = invoke_with_retry(chain, {"input": content})
    print("Train Result : ", result)
    print("\n\nTrain Information from Web Search : ", result)

    return result.content


def search_bus_prices(origin: str, destination: str, start_date: str) -> str:

    query = f"Latest buses from {origin} to {destination} on {start_date}"

    content = web_search(query=query,domains=[])

    BUS_INFORMATION_SYSTEM_PROMPT = """
        Using only the provided bus search results and scraped travel data, generate a structured and professional bus information summary for the requested route.

        Strict Instructions / Guardrails:

        Use ONLY the information explicitly present in the provided data.
        Do NOT add assumptions, external knowledge, predictions, or self-generated details.
        Do NOT infer missing information.
        Do NOT include unrelated search results or irrelevant content.
        Do NOT rewrite information creatively.
        Do NOT add city descriptions, tourism suggestions, or extra travel advice unless explicitly present in the data.
        Do NOT provide information that is not requested in this prompt.
        Do NOT "think" beyond the supplied dataset.
        If information is missing, simply omit it instead of guessing.
        Preserve factual accuracy from the source data.
        Re-structure and summarize the data cleanly without changing meaning.
        Avoid duplicate statements and noisy scraped text.

        The output should include only:

        Departure and arrival bus stop/terminal names
        Approximate distance
        Journey duration
        Bus operators/services mentioned
        Bus type options (sleeper, AC, non-AC, etc.) and fare ranges mentioned
        Cheapest date/timing information if available
        Schedule/timing information if available
        Direct vs connecting bus details if available
        Booking/timing notes only if explicitly mentioned

        Formatting Requirements:

        Use professional headings.
        Use bullet points and tables where useful
        Keep the response concise, clean, and traveler-friendly
        Present the information like a professional travel assistant or bus service summary

        Final Rule:

        Transform the provided raw data into a cleaner structured format only.
        Do not generate new facts under any circumstance.
    """

    chain  = _plain_chain(system_prompt=BUS_INFORMATION_SYSTEM_PROMPT)
    result = invoke_with_retry(chain, {"input": content})
    print("\n\nBus Information from Web Search : ", result)

    return result.content

def search_accommodation_info(destination: str, checkin: str, checkout: str, travelers: int) -> str:
    queries = [
        f"best budget hotels hostels {destination} checkin {checkin} checkout {checkout} {travelers} travelers price per night 2025",
        f"cheap accommodation {destination} {travelers} guests backpacker hostel guesthouse review",
    ]
    parts = []
    for q in queries:
        parts.append(web_search(q,domains=[]))
    return "\n".join(parts)


def search_activities_food(destination: str, travel_style: str, interests: str) -> str:
    queries = [
        f"free things to do {destination} {interests} top attractions {travel_style} travel 2025",
        f"best street food local restaurants {destination} {interests} cheap eats budget",
    ]
    parts = []
    for q in queries:
        parts.append(web_search(q,domains=[]))
    return "\n".join(parts)


def search_destination_info(destination: str, origin: str, num_days: int) -> str:
    queries = [
        f"budget travel {destination} daily cost backpacker 2025",
        f"visa requirements {origin} passport {destination} 2025",
    ]
    parts = []
    for q in queries:
        parts.append(web_search(q,domains=[]))
    return "\n".join(parts)
