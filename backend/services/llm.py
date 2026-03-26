import asyncio
import json
import logging
import os
from typing import TypedDict

import anthropic
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
_cache: dict = {}

SYSTEM_PROMPT = """You are an EMS dispatch AI. Extract structured patient info and assign PACS triage.
PACS: P1+ (cardiac arrest/no breathing/no pulse), P1 (chest pain/head injury/stroke),
P2 (abdominal pain/moderate injury), P3 (minor pain/diarrhea), P4 (cough/minor ailment).
Rules: Extract only explicitly stated info. Null for unknown. If ANY P1+ indicator present → P1+.
Consider Singapore context (HDB blocks, Singlish)."""

USER_TEMPLATE = """Transcript: <transcript>{text}</transcript>
Return ONLY this JSON:
{{"name":null or string,"age":null or int,"location":null or string,"condition":null or string,"differentials":[{{"condition":string,"probability":float}}],"pacs":null or "P1+" or "P1" or "P2" or "P3" or "P4","reasoning":string}}"""


def _call_api(transcript: str) -> dict:
    """Synchronous API call — run in thread pool via asyncio.to_thread."""
    response = _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": USER_TEMPLATE.format(text=transcript)}],
        system=SYSTEM_PROMPT,
    )
    return json.loads(response.content[0].text)


async def extract_patient_data(transcript: str, call_id: str) -> dict | None:
    """Extract patient data from transcript. Returns cached result on failure."""
    try:
        result = await asyncio.to_thread(_call_api, transcript)
        _cache[call_id] = result
        return result
    except Exception as e:
        logger.error("LLM extraction failed for call %s: %s", call_id, e)
        return _cache.get(call_id)
