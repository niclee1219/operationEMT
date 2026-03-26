import asyncio
import json
import logging
import os

import anthropic
from dotenv import load_dotenv

from backend.state import CallState

load_dotenv()

logger = logging.getLogger(__name__)

_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

SYSTEM_PROMPT = """You monitor callers on EMS hold for NEW condition deterioration ONLY.
The current PACS level already accounts for the original reported condition — do NOT escalate for the condition that was already triaged.

Escalate ONLY if there is a clearly NEW development beyond the current PACS:
- Caller or bystander becomes unconscious / unresponsive (not already the case)
- Breathing stops or changes dramatically for the worse
- Chest pain or symptoms suddenly worsen significantly
- New critical symptom appears that was NOT part of the original call
- Prolonged unexplained silence (>30s) with no response to prompts
- Explicit urgent request to speak to operator

Do NOT escalate for:
- Casual conversation, weather, family chat — these are normal while waiting
- Stable repetition of the original complaint
- Minor discomfort already captured in the PACS level
- Emotional upset without physical deterioration

Be conservative. A stable caller chatting while waiting does NOT need escalation."""

USER_TEMPLATE = """Current PACS: {pacs}. Recent transcript (last 60s):
<recent_transcript>{text}</recent_transcript>
Return ONLY: {{"escalate":bool,"trigger_phrase":string or null,"severity":"critical" or "warning" or "stable","recommended_pacs":string or null,"reasoning":string}}"""


def _build_recent_text(call_state: CallState) -> str:
    """Extract text from recent_window deque (last 60s of transcript)."""
    import time
    cutoff = time.time() - 60
    chunks = [text for ts, text in call_state.recent_window if ts >= cutoff]
    return " ".join(chunks) if chunks else call_state.transcript_buffer[-500:]


def _call_api(pacs: str, recent_text: str) -> dict:
    """Synchronous API call — run in thread pool."""
    response = _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": USER_TEMPLATE.format(pacs=pacs, text=recent_text)}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


async def check_escalation(call_state: CallState) -> dict:
    """
    Check if a Smart Hold call needs escalation.

    Always returns a dict. On any failure, returns stable (no escalation).
    This prevents API errors from generating false escalation alerts.
    """
    try:
        recent_text = _build_recent_text(call_state)
        pacs = call_state.pacs or "unknown"
        result = await asyncio.wait_for(
            asyncio.to_thread(_call_api, pacs, recent_text),
            timeout=25,
        )
        return result
    except Exception as e:
        logger.error("Smart hold check failed for call %s: %s", call_state.call_id, e)
        return {
            "escalate": False,
            "trigger_phrase": None,
            "severity": "stable",
            "recommended_pacs": None,
            "reasoning": f"Monitoring error: {type(e).__name__}",
        }
