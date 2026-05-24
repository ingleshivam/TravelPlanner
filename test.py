import os
import re
import sys
from firecrawl import FirecrawlApp
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

_client: FirecrawlApp | None = None


def _get_client() -> FirecrawlApp:
    global _client
    if _client is None:
        key = os.environ.get("FIRECRAWL_API_KEY")
        if not key:
            raise RuntimeError("Missing FIRECRAWL_API_KEY. Add it to .env.")
        _client = FirecrawlApp(api_key=key)
    return _client


def scrape(url: str, wait_ms: int = 0) -> str:
    try:
        result = _get_client().scrape(url, wait_for=wait_ms or None)
        return result.markdown
    except Exception as e:
        return f"(Scrape unavailable: {e})"


def accomodation_url(checkin: str, checkout: str, travelers: str, destination: str) -> str:
    room = 1
    if travelers > 2:
        room = travelers  / 2
    return (
        f"https://www.goibibo.com/hotels/hotel-listing/?checkin={checkin}&checkout={checkout}&roomString={int(room)}-{travelers}-0&searchText={destination}"
    )

def _strip_markup(text: str) -> str:
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    return text

def extract_flights(markdown: str) -> str:
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


def test_flights(checkin="20260528", checkout="20260531", travelers=4, destination="mumbai"):
    print(f"\n{'='*50}")
    print(f"Accomodation in {destination} for {travelers} from {checkin} to {checkout}")
    print('='*50)
    url = accomodation_url(checkin, checkout, travelers, destination)
    print("URL:", url)
    content = scrape(url, wait_ms=5000)
    with open("accomodation_raw.txt", "w", encoding="utf-8") as f:
        f.write(content)
    result = extract_flights(content)
    print(result)

test_flights()