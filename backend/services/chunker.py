import re


def clean_text(text: str) -> str:
    # Remove table of contents dot leaders e.g. "....... 12"
    text = re.sub(r'\.{4,}\s*\d+', '', text)
    # Collapse multiple spaces
    text = re.sub(r' {2,}', ' ', text)
    # Collapse more than 2 newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def split_into_bullets(text: str) -> list[str]:
    """
    Split clause content into bullet-level segments.
    Handles: (a), (b), •, -, *, \uf0b7, \uf0a7, \u2022, numbered lists like 1., 2.
    Falls back to the whole text if no bullets detected.
    """
    lines = text.split('\n')
    segments = []
    current = []

    for line in lines:
        stripped = line.strip()

        if not stripped:
            continue

        is_bullet = bool(re.match(
            r'^(\uf0b7|\uf0a7|\u2022|\u2023|\u25e6|•|-|\*|\([a-zA-Z0-9]+\)|\d+\.)\s+',
            stripped
        ))
        is_lone_bullet = stripped in ('\uf0b7', '\uf0a7', '\u2022', '•', '-', '*')

        if (is_bullet or is_lone_bullet) and current:
            joined = ' '.join(current).strip()
            if joined:
                segments.append(joined)
            current = [] if is_lone_bullet else [stripped]
        elif is_lone_bullet:
            current = []
        else:
            current.append(stripped)

    if current:
        joined = ' '.join(current).strip()
        if joined:
            segments.append(joined)

    return segments if len(segments) > 1 else [text.strip()]


def chunk_by_clauses(text: str, max_tokens: int = 400) -> list[dict]:
    text = clean_text(text)

    # Match clause headers:
    # X.X or X.X.X patterns (e.g. 1.1, 10.3, 1.1.1)
    # Also single-digit section headers at start of line (e.g. "1. Programme")
    pattern = re.compile(
        r'(?m)^(\d+\.\d+(?:\.\d+)?|\d+\.)\s+(.+)'
    )
    matches = list(pattern.finditer(text))

    # Filter out pure TOC lines
    filtered_matches = []
    for m in matches:
        title = m.group(2).strip()
        if re.search(r'\s+\d+$', title) and len(title.split()) <= 8:
            continue
        filtered_matches.append(m)
    matches = filtered_matches

    chunks = []

    for i, match in enumerate(matches):
        clause_ref = match.group(1).rstrip('.')
        clause_title = match.group(2).strip()
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()

        if len(content) < 50:
            continue

        words = content.split()

        if len(words) <= max_tokens:
            chunks.append({
                "clause_ref": clause_ref,
                "clause_title": clause_title,
                "content": content,
                "char_start": start,
                "char_end": end,
            })
            continue

        bullets = split_into_bullets(content)

        if len(bullets) > 1:
            for j, bullet in enumerate(bullets):
                bullet = bullet.strip()
                if len(bullet) < 30:
                    continue
                bullet_words = bullet.split()
                if len(bullet_words) > max_tokens:
                    step = max_tokens
                    overlap = 50
                    for k in range(0, len(bullet_words), step - overlap):
                        sub = " ".join(bullet_words[k:k + step])
                        chunks.append({
                            "clause_ref": f"{clause_ref} (bullet {j+1} part {k // (step - overlap) + 1})",
                            "clause_title": clause_title,
                            "content": sub,
                            "char_start": start,
                            "char_end": end,
                        })
                else:
                    chunks.append({
                        "clause_ref": f"{clause_ref} (bullet {j+1})",
                        "clause_title": clause_title,
                        "content": bullet,
                        "char_start": start,
                        "char_end": end,
                    })
        else:
            step = max_tokens
            overlap = 50
            for j in range(0, len(words), step - overlap):
                sub_content = " ".join(words[j:j + step])
                chunks.append({
                    "clause_ref": f"{clause_ref} (part {j // (step - overlap) + 1})",
                    "clause_title": clause_title,
                    "content": sub_content,
                    "char_start": start,
                    "char_end": end,
                })

    return chunks