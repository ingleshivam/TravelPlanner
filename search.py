import hashlib
import json
import os
import re
from datetime import datetime
from typing import List, Optional

from firecrawl import FirecrawlApp
from pydantic import AliasChoices, BaseModel, Field
from tavily import TavilyClient


# ── Structured output schemas for transport search ──────────────────────────

class _FlightOption(BaseModel):
    flight_name: str = ""
    flight_number: str = ""
    flight_time: str = ""
    flight_fare: float = 0.0

class _FlightResult(BaseModel):
    flights: List[_FlightOption] = []


class _TrainOption(BaseModel):
    train_number: str = ""
    train_name: str = ""
    departure_time: str = ""
    train_fare: float = 0.0

class _TrainResult(BaseModel):
    trains: List[_TrainOption] = []


class _BusOption(BaseModel):
    bus_name: str = ""
    bus_number: str = ""
    bus_fare: float = 0.0
    bus_time: str = ""

class _BusResult(BaseModel):
    buses: List[_BusOption] = []

from agents import _plain_chain, _structured_chain, invoke_with_retry

_tavily_client: TavilyClient | None = None
_fc_client: FirecrawlApp | None = None

_SCRAPE_CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scrape_cache.json")

def _cache_load() -> dict:
    if os.path.exists(_SCRAPE_CACHE_FILE):
        with open(_SCRAPE_CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def _cache_save(cache: dict):
    with open(_SCRAPE_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


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


def web_search(query: str, include_domains:list, max_results: int = 1) -> str:
    try:
        response = _get_tavily().search(query=query, max_results=max_results, search_depth="advanced", include_domains=include_domains)
        results = response.get("results", [])
        if not results:
            return "No results found."
        return "\n".join(f"- {r['title']}: {r['content']}" for r in results)
    except Exception as e:
        return f"(Search unavailable: {e})"


def _scrape(url: str, wait_ms: int = 0) -> str:
    key = hashlib.md5(url.encode()).hexdigest()
    cache = _cache_load()
    if key in cache:
        print(f"[cache] HIT: {url}")
        return cache[key]
    print(f"[scrape] MISS: {url}")
    try:
        result = _get_fc().scrape(url, wait_for=wait_ms or None)
        content = result.markdown
        cache[key] = content
        _cache_save(cache)
        return content
    except Exception as e:
        return f"(Scrape unavailable: {e})"


def _scrape_middle(url: str, wait_ms: int = 0, max_lines: int = 500, max_chars: int = 15000) -> str:
    content = _scrape(url, wait_ms)
    lines = content.splitlines()
    total = len(lines)
    skip = int(total * 0.15)
    middle = lines[skip: total - skip] if total > skip * 2 else lines
    text = "\n".join(middle[:max_lines])
    if len(text) > max_chars:
        text = text[:max_chars] + "\n[truncated]"
    return text


def _search_and_scrape(
    query: str,
    include_domains: list,
    url_keywords: list[str] = None,
    reject_url_keywords: list[str] = None,
    max_chars: int = 10000,
) -> str:
    try:
        response = _get_tavily().search(
            query=query,
            max_results=3,
            search_depth="advanced",
            include_domains=include_domains,
        )
        results = response.get("results", [])
        print("URL RESULTS : ", results)
        if not results:
            return "No results found."
        results.sort(key=lambda r: r.get("score", 0), reverse=True)
        url = None
        for r in results:
            url_lower = r["url"].lower()
            if reject_url_keywords and any(kw in url_lower for kw in reject_url_keywords):
                continue
            if url_keywords is None or all(kw.lower() in url_lower for kw in url_keywords):
                url = r["url"]
                break
        if url is None:
            url = results[0]["url"]
        print(f"[scrape] URL: {url}")
        return _scrape_middle(url, max_chars=max_chars)
    except Exception as e:
        return f"(Search unavailable: {e})"


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

_FLIGHT_PROMPT = (
    "Extract flight options from the provided search data and return them as JSON.\n\n"
    "Rules:\n"
    "- Use ONLY information explicitly present in the data. Do NOT invent or assume anything.\n"
    "- If a field is missing from the data, use an empty string or 0.\n"
    "- Return an empty flights list if no valid flights are found.\n\n"
    "Return a JSON object matching this schema exactly:\n"
    '{{"flights": [{{"flight_name": "airline name", "flight_number": "e.g. 6E-123", '
    '"flight_time": "HH:MM", "flight_fare": 0}}]}}'
)

_TRAIN_PROMPT = (
    "Extract train options from the provided search data and return them as JSON.\n\n"
    "Rules:\n"
    "- Use ONLY information explicitly present in the data. Do NOT invent or assume anything.\n"
    "- Include train number, name, departure time, and fare.\n"
    "- If a field is missing from the data, use an empty string or 0.\n"
    "- Return an empty trains list if no valid trains are found.\n\n"
    "Return a JSON object matching this schema exactly:\n"
    '{{"trains": [{{"train_number": "e.g. 12124", "train_name": "e.g. Deccan Queen Express", '
    '"departure_time": "HH:MM", "train_fare": 310}}]}}'
)

_BUS_PROMPT = (
    "Extract bus options from the provided search data and return them as JSON.\n\n"
    "Rules:\n"
    "- Use ONLY information explicitly present in the data. Do NOT invent or assume anything.\n"
    "- If a field is missing from the data, use an empty string or 0.\n"
    "- Return an empty buses list if no valid buses are found.\n\n"
    "Return a JSON object matching this schema exactly:\n"
    '{{"buses": [{{"bus_name": "operator name", "bus_number": "route/service number if any", '
    '"bus_fare": 0, "bus_time": "HH:MM departure time"}}]}}'
)


def search_transport_prices(origin: str, destination: str, start_date: str) -> dict:
    print("Flight origin : ", origin)
    print("Flight destination : ", destination)
    query = f"Latest flights from {origin} to {destination} on {start_date}"
    content = _search_and_scrape(
        query=query,
        include_domains=["ixigo.com", "goibibo.com", "skyscanner.co.in"],
        url_keywords=[origin, destination],
        reject_url_keywords=["train", "rail", "bus"],
    )
    chain = _structured_chain(_FLIGHT_PROMPT, _FlightResult)
    try:
        result = invoke_with_retry(chain, {"input": content})
        print("\n\nFlight search result:", result)
        return result.model_dump()
    except Exception as e:
        print(f"[flight-search] failed: {e}")
        return {"flights": []}


def search_train_prices(origin: str, destination: str, start_date: str) -> dict:
    print("Train origin : ", origin)
    print("Train destination : ", destination)
    query = f"Latest trains from {origin} to {destination} on {start_date}"
    content = _search_and_scrape(
        query=query,
        include_domains=["railyatri.in", "ixigo.com", "goibibo.com"],
        url_keywords=[destination],
    )
    chain = _structured_chain(_TRAIN_PROMPT, _TrainResult)
    try:
        result = invoke_with_retry(chain, {"input": content})
        print("\n\nTrain search result:", result)
        return result.model_dump()
    except Exception as e:
        print(f"[train-search] failed: {e}")
        return {"trains": []}


def search_bus_prices(origin: str, destination: str, start_date: str) -> dict:
    query = f"Latest buses from {origin} to {destination} on {start_date}"
    content = _search_and_scrape(query=query, include_domains=["goibibo.com", "redbus.in","ixigo.com"], url_keywords=[origin, destination])
    chain = _structured_chain(_BUS_PROMPT, _BusResult)
    try:
        result = invoke_with_retry(chain, {"input": content})
        print("\n\nBus search result:", result)
        return result.model_dump()
    except Exception as e:
        print(f"[bus-search] failed: {e}")
        return {"buses": []}

def search_accommodation_info(destination: str, checkin: str, checkout: str, travelers: int) -> str:
    query = f"best budget hotels hostels in {destination} for {travelers} travelers checkin {checkin} checkout {checkout} price per night"
    return _search_and_scrape(query, include_domains=["goibibo.com", "ixigo.com"], url_keywords=[destination])


def search_activities_food(destination: str, travel_style: str, interests: str) -> str:
    queries = [
        f"free things to do in {destination} {interests} top attractions {travel_style} travel",
        f"best street food local restaurants in {destination} {interests} cheap eats budget",
    ]
    parts = []
    for q in queries:
        parts.append(_search_and_scrape(q, include_domains=["tripadvisor.in", "wanderlog.com"], url_keywords=[destination]))
    return "\n".join(parts)


def search_destination_info(destination: str, origin: str, num_days: int) -> str:
    queries = [
        f"budget travel in {destination} daily cost backpacker",
        f"visa requirements {origin} passport {destination}",
    ]
    parts = []
    for q in queries:
        parts.append(_search_and_scrape(q, include_domains=["holidify.com"], url_keywords=[destination]))
    return "\n".join(parts)
