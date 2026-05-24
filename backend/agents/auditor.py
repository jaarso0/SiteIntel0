def audit(kb: dict, pages: list[dict]) -> dict:
    # Check inconsistencies rated high
    critical = [i for i in kb.get("inconsistencies", []) if i.get("severity") == "high"]
    
    # Check high-priority gaps that have no matching KB article
    kb_articles = kb.get("kb_articles", [])
    kb_categories = {a.get("category", "").lower() for a in kb_articles if a.get("category")}
    
    missing = [
        g for g in kb.get("coverage_gaps", [])
        if g.get("priority") == "high" and g.get("topic", "").lower() not in kb_categories
    ]

    # Consolidate recrawl hints
    recrawl_hints = []
    for i in critical:
        pages_list = i.get("pages", [])
        if isinstance(pages_list, list):
            recrawl_hints.extend(pages_list)
        elif isinstance(pages_list, str):
            recrawl_hints.append(pages_list)
            
    for m in missing:
        topic = m.get("topic", "")
        if topic:
            recrawl_hints.append(topic)

    # De-duplicate hints
    recrawl_hints = list(set(recrawl_hints))

    return {
        "needs_recrawl": len(critical) > 0 or len(missing) > 0,
        "recrawl_hints": recrawl_hints,
        "flags": critical + missing,
    }
