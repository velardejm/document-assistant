import re


def clean_text(text: str) -> str:
    # Remove table of contents dot leaders e.g. "....... 12"
    text = re.sub(r'\.{4,}\s*\d+', '', text)
    # Collapse multiple spaces
    text = re.sub(r' {2,}', ' ', text)
    # Collapse more than 2 newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def chunk_by_clauses(text: str, max_tokens: int = 1500) -> list[dict]:
    text = clean_text(text)

    # Match clause headers like "1.1", "2.3", "12.4" at start of line
    pattern = re.compile(r'(?m)^(\d+\.\d+(?:\.\d+)?)\s+(.+)')
    matches = list(pattern.finditer(text))
    chunks = []

    for i, match in enumerate(matches):
        clause_ref = match.group(1)
        clause_title = match.group(2).strip()
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()

        # Skip very short content (TOC remnants)
        if len(content) < 50:
            continue

        # Sub-chunk if too long
        words = content.split()
        if len(words) > max_tokens:
            step = max_tokens
            overlap = 100
            for j in range(0, len(words), step - overlap):
                sub_content = " ".join(words[j:j + step])
                chunks.append({
                    "clause_ref": f"{clause_ref} (part {j // (step - overlap) + 1})",
                    "clause_title": clause_title,
                    "content": sub_content,
                    "char_start": start,
                    "char_end": end,
                })
        else:
            chunks.append({
                "clause_ref": clause_ref,
                "clause_title": clause_title,
                "content": content,
                "char_start": start,
                "char_end": end,
            })

    return chunks