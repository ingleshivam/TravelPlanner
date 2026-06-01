import os
import re
import sys
from firecrawl import FirecrawlApp
from dotenv import load_dotenv


sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

_client: FirecrawlApp | None = None

from tavily import TavilyClient

_tavily = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY"))

response = _tavily.search(
    query="Pune to mumbai flights on date 30/05/2026",
    max_results=1,
    search_depth="advanced",
    include_domains=["ixigo.com", "rai`lyatri.in"],
)

results = [r for r in response.get("results", []) if r.get("score", 0) > 0.9]
print(f"High-confidence results (score > 0.9): {len(results)}")
url = ""
for r in results:
    url = r['url']
    print(f"  [{r['score']:.3f}] {r['url']}")



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
    
content = scrape(url)
lines = content.splitlines()
total = len(lines)
print(f"Total lines: {total}")
skip = int(total * 0.15)
middle = lines[skip: total - skip] if total > skip * 2 else lines
print(f"Writing {len(middle)} middle lines (skipped first/last {skip} = 15% of {total})")
with open("scrape_result.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(middle[:500]))


# def accomodation_url(checkin: str, checkout: str, travelers: str, destination: str) -> str:
#     room = 1
#     if travelers > 2:
#         room = travelers  / 2
#     return (
#         # f"https://www.goibibo.com/hotels/hotel-listing/?checkin={checkin}&checkout={checkout}&roomString={int(room)}-{travelers}-0&searchText={destination}"
#         f"https://www.ixigo.com/hotels/search/result?locationName={destination}&checkinDate={checkin}&checkoutDate={checkout}&adultCount={travelers}&roomCount={int(room)}&childCount=0"
#     )

# def _strip_markup_for_accomodation(text: str) -> str:
#     lines = text.splitlines()
#     for i, l in enumerate(lines):
#         if l.strip().startswith('**'):
#             lines = lines[i:]
#             break
#     lines = [l for l in lines if not re.match(r'^\s*(\[!\[|!\[|-\s*!\[|\\\\)', l)]
#     text = '\n'.join(lines)
#     text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
#     text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
#     text = re.sub(r'\n\s*\n+', '\n', text)
#     return '\n'.join(text.strip().splitlines()[:300])

# def test_flights(checkin="20260528", checkout="20260531", travelers=4, destination="mumbai"):
#     print(f"\n{'='*50}")
#     print(f"Accomodation in {destination} for {travelers} from {checkin} to {checkout}")
#     print('='*50)
#     url = accomodation_url(checkin, checkout, travelers, destination)
#     print("URL:", url)
#     content = scrape(url, wait_ms=5000)
#     result = _strip_markup_for_accomodation(content)
#     with open("Accomodation_raw.txt")
#     with open("accomodation_raw.txt", "w", encoding="utf-8") as f:
#         f.write(result)
#     print(result)

# test_flights()