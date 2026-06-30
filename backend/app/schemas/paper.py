from pydantic import BaseModel


class Paper(BaseModel):
    url: str
    title: str
    author: str | None = None
    conference: str | None = None
    pages: int | None = None
    date: str | None = None  # YYMMDD when known
    abstract: str | None = None
    cite_num: int | None = None
    submitted: bool = False
    relevant_no: int = 0
    tier: int = 99
    source: str = "arxiv"  # arxiv | acm | ieee | sciencedirect | scholar


class SearchResponse(BaseModel):
    query: str
    source: str
    count: int
    results: list[Paper]


class TranslateRequest(BaseModel):
    text: str
    target_lang: str = "Japanese"


class TranslateResponse(BaseModel):
    translated: str
    model: str
