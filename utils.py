import re


def parse_transport_options(raw_text: str) -> dict:
    """Parse the structured scraper output into a dict matching AvailableOptions."""
    flights, buses, trains = [], [], []

    section = None
    for line in raw_text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("=== FLIGHTS"):
            section = "flights"
        elif line.startswith("=== BUSES"):
            section = "buses"
        elif line.startswith("=== TRAINS"):
            section = "trains"
        elif line.startswith("No ") or line.startswith("("):
            continue
        elif section == "buses":
            # Format: Operator  HH:MM -> HH:MM  Xh Ym  Bus Type  N Seats  rating* (N reviews)  ₹price
            parts = [p.strip() for p in re.split(r'  +', line) if p.strip()]
            if len(parts) < 4:
                continue
            try:
                operator = parts[0]
                time_part = parts[1]  # "21:45 -> 06:05"
                dep, arr = [t.strip() for t in time_part.split("->")]
                duration = parts[2] if re.match(r'\d+h', parts[2]) else ""
                idx = 3 if duration else 2
                bus_type = parts[idx] if idx < len(parts) else ""
                seats_str = next((p for p in parts if "Seat" in p), "")
                seats = int(re.search(r'\d+', seats_str).group()) if seats_str else 0
                rating_str = next((p for p in parts if "*" in p and "review" in p.lower()), "")
                rating = re.match(r'[\d.]+\*', rating_str).group().rstrip("*") if rating_str else ""
                price_str = next((p for p in parts if "₹" in p), "")
                price = float(re.sub(r'[₹,]', '', price_str)) if price_str else 0.0
                buses.append({
                    "operator": operator, "departure": dep, "arrival": arr,
                    "duration": duration, "bus_type": bus_type,
                    "seats_available": seats, "rating": rating, "price": price,
                })
            except Exception:
                continue
        elif section == "trains":
            # Format: NNNNN Train Name  HH:MM PM -> HH:MM AM  | CLS:₹amt  CLS:₹amt
            m = re.match(r'(\d{4,6})\s+(.+?)\s{2,}(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*->\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)(.*)', line)
            if not m:
                continue
            train_no, name, dep, arr, fare_block = m.groups()
            classes = [
                {"class_name": cls, "price": float(amt)}
                for cls, amt in re.findall(r'([A-Z0-9]{1,3}):₹(\d+)', fare_block)
            ]
            trains.append({
                "train_number": train_no.strip(), "name": name.strip(),
                "departure": dep.strip(), "arrival": arr.strip(), "classes": classes,
            })
        elif section == "flights":
            # Format: Airline  FlightNo  dep  ORIG  duration  stops  arr  DEST  ₹price
            parts = [p.strip() for p in re.split(r'  +', line) if p.strip()]
            if len(parts) < 5:
                continue
            try:
                airline   = parts[0]
                flight_no = parts[1]
                dep       = parts[2]
                duration  = next((p for p in parts if re.match(r'\d+h', p)), "")
                price_str = next((p for p in parts if p.startswith("₹")), "")
                price     = float(re.sub(r'[₹,]', '', price_str)) if price_str else 0.0
                times     = [p for p in parts if re.match(r'\d{1,2}:\d{2}$', p)]
                arr       = times[1] if len(times) > 1 else ""
                flights.append({
                    "airline": airline, "flight_number": flight_no,
                    "departure": dep, "arrival": arr,
                    "duration": duration, "seat_class": "", "seats_available": 0, "price": price,
                })
            except Exception:
                continue

    MAX = 5

    buses.sort(key=lambda x: x["price"])
    buses = buses[:MAX]

    trains.sort(key=lambda x: min((c["price"] for c in x["classes"]), default=0))
    trains = trains[:MAX]

    flights.sort(key=lambda x: x["price"])
    flights = flights[:MAX]

    return {"flights": flights, "buses": buses, "trains": trains}
