def infer_currency(origin: str) -> tuple[str, str]:
    """Return (currency_code, currency_symbol) inferred from origin string."""
    o = origin.lower()
    mappings: list[tuple[list[str], tuple[str, str]]] = [
        (["india", "mumbai", "delhi", "bangalore", "chennai", "kolkata",
          "hyderabad", "pune", "ahmedabad", "jaipur", "surat"], ("INR", "₹")),
        (["usa", "united states", "new york", "los angeles", "chicago",
          "houston", "miami", "san francisco", "seattle", "boston"], ("USD", "$")),
        (["uk", "united kingdom", "london", "manchester", "birmingham",
          "glasgow", "edinburgh"], ("GBP", "£")),
        (["europe", "france", "paris", "germany", "berlin", "spain", "madrid",
          "italy", "rome", "milan", "netherlands", "amsterdam", "portugal",
          "lisbon", "greece", "athens", "austria", "vienna"], ("EUR", "€")),
        (["japan", "tokyo", "osaka", "kyoto"], ("JPY", "¥")),
        (["australia", "sydney", "melbourne", "brisbane", "perth"], ("AUD", "A$")),
        (["canada", "toronto", "vancouver", "montreal", "calgary"], ("CAD", "C$")),
        (["thailand", "bangkok", "chiang mai", "phuket"], ("THB", "฿")),
        (["singapore"], ("SGD", "S$")),
        (["uae", "dubai", "abu dhabi", "sharjah"], ("AED", "AED")),
        (["malaysia", "kuala lumpur", "penang"], ("MYR", "RM")),
        (["indonesia", "bali", "jakarta", "yogyakarta"], ("IDR", "Rp")),
        (["vietnam", "hanoi", "ho chi minh", "da nang"], ("VND", "₫")),
        (["mexico", "mexico city", "cancun", "guadalajara"], ("MXN", "MX$")),
        (["brazil", "sao paulo", "rio de janeiro"], ("BRL", "R$")),
        (["south africa", "cape town", "johannesburg"], ("ZAR", "R")),
        (["south korea", "seoul", "busan"], ("KRW", "₩")),
        (["china", "beijing", "shanghai", "shenzhen", "guangzhou"], ("CNY", "¥")),
        (["new zealand", "auckland", "wellington"], ("NZD", "NZ$")),
        (["switzerland", "zurich", "geneva", "bern"], ("CHF", "CHF")),
    ]
    for keywords, currency in mappings:
        if any(kw in o for kw in keywords):
            return currency
    return ("USD", "$")
