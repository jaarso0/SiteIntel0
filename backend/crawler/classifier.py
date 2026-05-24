PRIORITY_MAP = {
    "pricing": ["pricing", "plans", "cost", "subscription"],
    "support": ["faq", "help", "support", "docs", "kb", "knowledgebase"],
    "product": ["features", "product", "solutions", "services"],
    "company": ["about", "team", "contact", "careers"],
}
SKIP = ["terms", "privacy", "legal", "cookie", "tos", "policy"]
DEPRIORITIZE = ["blog", "news", "press"]

def classify(url: str, title: str = "") -> str:
    path = url.lower()
    title_lower = title.lower()

    # Check for skip patterns
    if any(s in path or s in title_lower for s in SKIP):
        return "skip"

    # Check for deprioritize patterns
    if any(d in path or d in title_lower for d in DEPRIORITIZE):
        return "deprioritize"

    # Check priority maps
    for page_type, patterns in PRIORITY_MAP.items():
        if any(p in path or p in title_lower for p in patterns):
            return page_type

    return "general"
