"""Fuzzy-match a paper's venue/conference against the ranked conference list
to attach a quality ``tier`` (lower is better; 99 = unknown).

The CSV (``conf_n_journal_list.csv``) is loaded once into memory.
"""
import csv
from functools import lru_cache
from pathlib import Path

from rapidfuzz import fuzz, process

CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "conf_n_journal_list.csv"

_SCORE_CUTOFF = 90


@lru_cache(maxsize=1)
def _load_conferences() -> tuple[list[str], dict[str, tuple[str, int]]]:
    """Return (choices, lookup) where choices is a flat list of titles+acronyms
    and lookup maps each choice string -> (canonical_title, tier)."""
    choices: list[str] = []
    lookup: dict[str, tuple[str, int]] = {}
    if not CSV_PATH.exists():
        return choices, lookup

    with CSV_PATH.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            title = (row.get("title") or "").strip()
            acronym = (row.get("acronym") or "").strip()
            try:
                tier = int(row.get("tier") or 99)
            except ValueError:
                tier = 99
            if title:
                choices.append(title)
                lookup[title] = (title, tier)
            if acronym:
                choices.append(acronym)
                lookup.setdefault(acronym, (title or acronym, tier))
    return choices, lookup


def match_tier(venue: str | None) -> tuple[str | None, int]:
    """Return (canonical_conference_name_or_original, tier)."""
    if not venue:
        return venue, 99

    choices, lookup = _load_conferences()
    if not choices:
        return venue, 99

    best = process.extractOne(
        venue, choices, scorer=fuzz.WRatio, score_cutoff=_SCORE_CUTOFF
    )
    if best is None:
        return venue, 99

    matched_str = best[0]
    canonical, tier = lookup[matched_str]
    return canonical, tier


def annotate(papers: list[dict]) -> list[dict]:
    for p in papers:
        canonical, tier = match_tier(p.get("conference"))
        if canonical:
            p["conference"] = canonical
        p["tier"] = tier
    return papers
