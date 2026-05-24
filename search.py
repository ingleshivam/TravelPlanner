import os
import re
from datetime import datetime
from typing import List, Optional

from firecrawl import FirecrawlApp
from pydantic import AliasChoices, BaseModel, Field
from tavily import TavilyClient

from agents import _structured_chain

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


def web_search(query: str, max_results: int = 3) -> str:
    try:
        response = _get_tavily().search(query=query, max_results=max_results, search_depth="basic")
        results = response.get("results", [])
        if not results:
            return "No results found."
        return "\n".join(f"- {r['title']}: {r['content'][:250]}" for r in results)
    except Exception as e:
        return f"(Search unavailable: {e})"


def _scrape(url: str, wait_ms: int = 0) -> str:
    try:
        result = _get_fc().scrape(url, wait_for=wait_ms or None)
        return result.markdown
    except Exception as e:
        return f"(Scrape unavailable: {e})"


def _strip_markup(text: str) -> str:
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    return text


def _flight_url(origin_iata: str, dest_iata: str, date_ddmmyyyy: str) -> str:
    return (
        f"https://www.yatra.com/flight-schedule/{origin_iata}-to-{dest_iata}-flights.html"
    )


def _bus_url(origin_city: str, dest_city: str, date_yyyymmdd: str) -> str:
    from_slug = origin_city.lower().replace(" ", "-")
    to_slug = dest_city.lower().replace(" ", "-")
    
    return (
        f"https://www.redbus.in/bus-tickets/{from_slug}-to-{to_slug}"
    )


def _train_url(origin_code: str, dest_code: str, date_yyyymmdd: str,
               origin_name: str = "", dest_name: str = "") -> str:
    url = (
        f"https://www.redbus.in/railways/search"
        f"?src={origin_code}&dst={dest_code}&doj={date_yyyymmdd}"
    )
    if origin_name:
        url += f"&srcName={origin_name.replace(' ', '%20')}"
    if dest_name:
        url += f"&dstName={dest_name.replace(' ', '%20')}"
    return url



def _extract_flights(markdown: str) -> str:
    if not markdown or len(markdown) < 100 or "(Scrape unavailable" in markdown:
        return "No flights found."

    text = _strip_markup(markdown)
    text = re.sub(r'\n{2,}', '\n', text)

    pattern = re.compile(
        r'[A-Z][A-Za-z][A-Za-z &\.]*?\n'
        r'[A-Z0-9]{2}[-\s]?\d{2,4}\n'
        r'#*\s*\d{1,2}:\d{2}\n'
        r'[A-Z]{3}\n'
        r'\d+h\s*\d*m?\n'
        r'(?:Non-?stop|\d+\s*Stops?)\n'
        r'#*\s*\d{1,2}:\d{2}\n'
        r'[A-Z]{3}\n'
        r'#*\s*₹[\d,]+',
        re.MULTILINE,
    )

    seen: set = set()
    results = []
    for m in pattern.finditer(text):
        entry = '  '.join(
            line.lstrip('#').strip()
            for line in m.group(0).splitlines()
            if line.strip()
        )
        if entry not in seen:
            seen.add(entry)
            results.append(entry)

    return "\n".join(results) if results else "No flights found."


def _extract_buses(markdown: str) -> str:
    text = _strip_markup(markdown)
    text = re.sub(r'^- ', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n{2,}', '\n', text)

    pattern = re.compile(
        r'(\d{1,2}:\d{2})\n'
        r'(\d{1,2}:\d{2})\n'
        r'(\d+h \d+m)\n'
        r'(\d+ Seats)\n'
        r'(?:\([^)]+\)\n)?'
        r'(?:₹[\d,]+\n)?'
        r'(₹[\d,]+)\n'
        r'Onwards\n'
        r'([^\n]+)\n'
        r'(?:Live tracking\n)?'
        r'([^\n]+)\n'
        r'(\d+\.\d+)\n'
        r'(\d+)',
        re.MULTILINE,
    )

    seen = set()
    results = []
    for m in pattern.finditer(text):
        dep, arr, duration, seats, price, operator, bus_type, rating, reviews = m.groups()
        key = (dep, arr, price, operator)
        if key in seen:
            continue
        seen.add(key)
        results.append(
            f"{operator}  {dep} -> {arr}  {duration}  {bus_type}  {seats}  {rating}* ({reviews} reviews)  {price}"
        )

    return "\n".join(results) if results else "No buses found."


def _extract_trains(markdown: str) -> str:
    text = _strip_markup(markdown)

    pattern = re.compile(
        r'(\d{5})\s+([A-Za-z][A-Za-z ]+?)\s+[MTWTFSS]+\s+'
        r'(\d{2}:\d{2}(?:\s*[AP]M)?)\s*.*?'
        r'(\d{2}:\d{2}(?:\s*[AP]M)?)'
        r'(.*?)(?=\d{5}\s+[A-Za-z]|\Z)',
        re.DOTALL,
    )

    seen = set()
    results = []
    for m in pattern.finditer(text):
        train_no, name, dep, arr, fare_block = m.groups()
        key = (train_no, dep, arr)
        if key in seen:
            continue
        seen.add(key)
        fares = re.findall(r'([A-Z0-9]{1,3})₹(\d+)', fare_block or '')
        fare_str = "  ".join(f"{cls}:₹{amt}" for cls, amt in fares)
        line = f"{train_no} {name.strip()}  {dep} -> {arr}"
        if fare_str:
            line += f"  | {fare_str}"
        results.append(line)

    return "\n".join(results) if results else "No trains found."


def search_transport_prices(origin: str, destination: str, start_date: str) -> str:
    class RouteCity(BaseModel):
        city: str = Field(default="", description="City name")
        iata: Optional[str] = Field(default=None, description="3-letter IATA airport code e.g. PNQ for Pune, BOM for Mumbai, DEL for Delhi, MAA for Chennai")
        railway: Optional[str] = Field(default=None, description="Indian Railways station code e.g. PUNE for Pune, CSTM for Mumbai CST, NDLS for New Delhi, MAS for Chennai")

    class RouteCodes(BaseModel):
        origin: RouteCity
        destination: RouteCity

    chain = _structured_chain(
        system_prompt=(
            "You are a travel code lookup assistant. "
            "Given city names, return their IATA airport codes and Indian Railways station codes. "
            "Only set iata if the city has an active commercial airport with scheduled passenger flights — set null otherwise. "
            "Only set railway if the city has an Indian Railways station — set null otherwise. "
            "Respond with JSON only."
        ),
        schema=RouteCodes,
    )
    codes: RouteCodes = chain.invoke({
        "input": (
            f"origin: {origin}\n"
            f"destination: {destination}\n"
        )
    })
    print("RouteCodes:", codes)

    dt = datetime.strptime(start_date, "%Y-%m-%d")
    date_ddmmyyyy = dt.strftime("%d%m%Y")   
    date_yyyymmdd = dt.strftime("%Y%m%d")   

    parts: list[str] = []
    llm_flights: list[dict] = []

    if codes.origin.iata and codes.destination.iata:
        url = _flight_url(origin, destination, date_ddmmyyyy)
        print("Fllight url : ", url)
        raw = _scrape(url, wait_ms=10000)
        
        class FlightInformation(BaseModel):
            model_config = {"populate_by_name": True}
            flight_name: Optional[str] = Field(default=None, description="Airline name e.g. Air India, IndiGo. Key must be flight_name.")
            flight_fare: Optional[str] = Field(default=None, description="Flight fare e.g. ₹9,696. Key must be flight_fare.")
            flight_duration: Optional[str] = Field(default=None, description="Flight duration e.g. 4h 20m. Key must be flight_duration.")
            flight_departure_time: Optional[str] = Field(default=None, description="Departure time from origin e.g. 06:30. Key must be flight_departure_time.")

        class FlightResults(BaseModel):
            flights: List[FlightInformation] = Field(default_factory=list, description="List of all available flights extracted from the data.")

        flight_chain = _structured_chain(
            system_prompt=(
                "Extract ALL available flights from the given data. "
                "Return a JSON object with a 'flights' array. Each flight must have: "
                "flight_name (airline), flight_fare (price with ₹), flight_duration (e.g. 2h 15m), flight_departure_time (HH:MM). "
                "Respond with JSON only."
            ),
            schema=FlightResults,
        )

        result: FlightResults = flight_chain.invoke({"input": raw[:10000]})
        print("Flight chain result:", result)

        llm_flights = []
        for f in result.flights:
            price = 0.0
            if f.flight_fare:
                try:
                    price = float(re.sub(r'[₹,\s]', '', f.flight_fare))
                except ValueError:
                    price = 0.0
            llm_flights.append({
                "airline": f.flight_name or "",
                "flight_number": "",
                "departure": f.flight_departure_time or "",
                "arrival": "",
                "duration": f.flight_duration or "",
                "seat_class": "",
                "seats_available": 0,
                "price": price,
            })

        llm_flights.sort(key=lambda x: x["price"])
        llm_flights = llm_flights[:5]

        flights = _extract_flights(raw)
        parts.append(f"=== FLIGHTS ===\n{flights}")
    else:
        parts.append("=== FLIGHTS ===\nNo direct flights (no commercial airport at origin or destination).")

    # Use just the city name (before any comma) for the URL slug
    def _city_name(code_city: str, fallback: str) -> str:
        raw = code_city if code_city else fallback
        return raw.split(",")[0].strip()

    bus_origin = _city_name(codes.origin.city, origin)
    bus_dest = _city_name(codes.destination.city, destination)
    url = _bus_url(bus_origin, bus_dest, date_yyyymmdd)
    raw = _scrape(url, wait_ms=3000)
    buses = _extract_buses(raw)
    parts.append(f"=== BUSES ===\n{buses}")

    if codes.origin.railway and codes.destination.railway:
        url = _train_url(
            codes.origin.railway, codes.destination.railway, date_yyyymmdd,
            codes.origin.city, codes.destination.city,
        )
        raw = _scrape(url, wait_ms=5000)
        trains = _extract_trains(raw)
        parts.append(f"=== TRAINS ===\n{trains}")
    else:
        parts.append("=== TRAINS ===\nNo railway codes available.")

    return {"text": "\n\n".join(parts), "flights": llm_flights}


def search_accommodation_prices(destination: str, travel_style: str, num_days: int) -> str:
    tier = "hostels" if travel_style == "budget-backpacker" else "budget hotels"
    queries = [
        f"{tier} in {destination} price per night 2025",
        f"cheapest accommodation {destination} {num_days} nights booking",
    ]
    parts = []
    for q in queries:
        parts.append(web_search(q, max_results=2))
    return "\n".join(parts)


def search_destination_info(destination: str, origin: str, num_days: int) -> str:
    queries = [
        f"budget travel {destination} daily cost backpacker 2025",
        f"visa requirements {origin} passport {destination} 2025",
    ]
    parts = []
    for q in queries:
        parts.append(web_search(q, max_results=2))
    return "\n".join(parts)
