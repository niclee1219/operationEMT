import asyncio
import json
import logging
import os

import anthropic
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

SYSTEM_PROMPT = """You are an EMS dispatch AI. Extract structured patient info and assign PACS triage.
PACS levels:
  P1+ = cardiac arrest / no breathing / no pulse
  P1  = chest pain / head injury / stroke / severe trauma
  P2  = abdominal pain / moderate injury / semi-conscious
  P3  = minor pain / dizziness / diarrhoea
  P4  = cough / minor ailment / stable
  False Alarm = situation resolved, patient confirmed fine, or caller confirms it was a mistake
Rules:
- Extract ONLY explicitly stated information. Use null for unknown.
- If ANY P1+ indicator is present → P1+, regardless of other factors.
- Consider Singapore context (HDB blocks, void decks, Singlish).
- allergies: list of stated allergies, empty list if none mentioned.
- past_conditions: list of stated medical history / past illnesses, empty list if none mentioned.
- additional_notes: any extra details like clothing description, room location, how long unconscious, bystander info. Null if nothing extra."""

USER_TEMPLATE = """Transcript: <transcript>{text}</transcript>
Return ONLY this JSON:
{{"name":null or string,"age":null or int,"location":null or string,"condition":null or string,"allergies":[],"past_conditions":[],"additional_notes":null or string,"differentials":[{{"condition":string,"probability":float}}],"pacs":null or "P1+" or "P1" or "P2" or "P3" or "P4" or "False Alarm","reasoning":string}}"""

_cache: dict = {}


def _call_api(transcript: str) -> dict:
    """Synchronous API call — run in thread pool via asyncio.to_thread."""
    response = _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": USER_TEMPLATE.format(text=transcript)}],
    )
    raw = response.content[0].text.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("JSON parse error from LLM response: %s — raw: %.200s", exc, raw)
        raise


async def extract_patient_data(transcript: str, call_id: str) -> dict | None:
    """Extract patient data from transcript. Returns cached result on failure."""
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_call_api, transcript),
            timeout=30,
        )
        _cache[call_id] = result
        return result
    except json.JSONDecodeError:
        # Already logged inside _call_api; do not populate cache with bad data.
        return None
    except Exception as e:
        logger.error("LLM extraction failed for call %s: %s", call_id, e)
        return _cache.get(call_id)
