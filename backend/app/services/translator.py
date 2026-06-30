"""LLM translation via any OpenAI-compatible Chat Completions endpoint.

Works with OpenAI, LM Studio, Ollama (OpenAI compat), vLLM, etc. The user
brings their own base_url + api_key + model.
"""
import httpx


class TranslationError(Exception):
    pass


async def translate(
    text: str,
    *,
    base_url: str,
    api_key: str,
    model: str,
    target_lang: str = "Japanese",
) -> str:
    base = base_url.rstrip("/")
    # allow users to pass either ".../v1" or the full chat completions URL
    if base.endswith("/chat/completions"):
        endpoint = base
    elif base.endswith("/v1"):
        endpoint = f"{base}/chat/completions"
    else:
        endpoint = f"{base}/v1/chat/completions"

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    f"You are a professional academic translator. Translate the "
                    f"user's text into {target_lang}. Preserve technical terms and "
                    f"meaning. Output only the translation, no preamble."
                ),
            },
            {"role": "user", "content": text},
        ],
        "temperature": 0.2,
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(endpoint, json=payload, headers=headers, timeout=120)
    except httpx.HTTPError as e:
        raise TranslationError(f"Request to LLM endpoint failed: {e}") from e

    if resp.status_code != 200:
        raise TranslationError(
            f"LLM endpoint returned {resp.status_code}: {resp.text[:300]}"
        )

    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as e:
        raise TranslationError(f"Unexpected LLM response shape: {data}") from e
