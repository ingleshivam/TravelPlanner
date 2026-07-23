# AI Travel Planner

A conversational AI travel planning app. Chat with the assistant, share your destination and budget, and get a complete trip plan — transport options (flights, trains, buses), accommodation picks, and a day-by-day itinerary — all within your budget.

## How it works

1. **Chat** — describe your trip in plain text (destination, dates, budget, travel style).
2. **Extract** — the backend parses your messages to collect required trip parameters.
3. **Allocate** — confirm or adjust a five-category budget split (transport, accommodation, food, activities, misc).
4. **Plan** — a single SerpAPI Google AI Mode call returns live transport fares, hotel rates, and a full itinerary in structured JSON.
5. **Display** — the Next.js frontend renders transport cards, accommodation options, and a per-day schedule with costs.

## Tech stack

| Layer | Technologies |
|---|---|
| Backend | Python, FastAPI, LangGraph, LangChain, Groq (LLM), SerpAPI |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |

## Project structure

```
TravelPlanner/
├── api.py            # FastAPI app — /api/chat endpoint
├── agents.py         # LangChain chains backed by Groq LLM
├── graph.py          # LangGraph state graph
├── nodes.py          # Graph nodes (live data research)
├── search.py         # SerpAPI Google AI Mode integration
├── chat_session.py   # Session state, param extraction, budget allocation
├── prompts.py        # System prompts for each agent
├── schemas.py        # Pydantic output schemas
├── state.py          # LangGraph state definition
├── main.py           # CLI entry point (run a plan directly)
├── requirements.txt
└── frontend/         # Next.js chat UI
    ├── app/
    │   └── page.tsx  # Chat interface + plan renderer
    └── components/
```

## Prerequisites

- Python 3.11+
- Node.js 18+ and [pnpm](https://pnpm.io/)
- [Groq API key](https://console.groq.com/) (free tier available)
- [SerpAPI key](https://serpapi.com/) (for live travel data)

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/ingleshivam/TravelPlanner.git
cd TravelPlanner
```

### 2. Backend

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key
SERPAPI_API_KEY=your_serpapi_key
```

Start the API server:

```bash
uvicorn api:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
pnpm install
```

Create `frontend/.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

Type a trip request in the chat, for example:

> *"Plan a 3-day budget trip from Pune to Goa in June for 2 people, budget ₹20,000"*

The assistant will ask for any missing details, confirm your budget allocation, then generate a full plan with:

- **Transport** — ranked flight, train, and bus options with fares and booking tips
- **Accommodation** — ranked hotels/hostels with per-night cost and amenities
- **Itinerary** — morning/afternoon/evening activities + meals for each day
- **Budget summary** — breakdown and status (Within Budget / Tight Fit / Over Budget)

## CLI mode

Run the planner directly without the chat UI by editing the `initial_state` in `main.py` and running:

```bash
python main.py
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Groq API key for LLM inference |
| `SERPAPI_API_KEY` | Yes | SerpAPI key for live travel data |
| `NEXT_PUBLIC_API_URL` | No | Backend URL (default: `http://localhost:8000`) |
| `CORS_ORIGINS` | No | Comma-separated extra origins allowed to call the API (e.g. a custom domain). `*.vercel.app` and `localhost:3000` are always allowed. |

## Deployment

Backend and frontend deploy separately.

### Backend (Render)

1. Push this repo to GitHub.
2. On [Render](https://render.com), **New → Blueprint**, point it at the repo. It picks up [`render.yaml`](render.yaml) and creates a free web service (`uvicorn api:app`) with a `/health` check.
3. In the service's **Environment** tab, set `GROQ_API_KEY` and `SERPAPI_API_KEY` (Render prompts for these since the blueprint marks them `sync: false` — they're never committed to the repo).
4. Note the service URL, e.g. `https://travelplanner-api.onrender.com`.

The free plan spins the service down after 15 minutes of inactivity — the first request after a period of idleness takes ~30-50s to wake up. That's fine for casual/dev use; upgrade to a paid instance to keep it always warm.

### Frontend (Vercel)

1. On [Vercel](https://vercel.com), **Add New → Project**, import the repo, and set the project root to `frontend/`.
2. Set the environment variable `NEXT_PUBLIC_API_URL` to your Render backend URL from above.
3. Deploy. Vercel builds and hosts the Next.js app on a free `*.vercel.app` domain — the backend's CORS config already allows any `*.vercel.app` origin.

Anyone with the Vercel URL can now use the app; they don't need their own API keys since the backend holds them.

## License

MIT
