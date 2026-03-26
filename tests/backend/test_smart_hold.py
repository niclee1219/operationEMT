import pytest
from unittest.mock import patch, MagicMock
from backend.services.smart_hold import check_escalation
from backend.state import CallState


@pytest.fixture(autouse=True)
def isolate_tests():
    """Keep tests isolated — no shared state between runs."""
    yield


def make_state(transcript=""):
    s = CallState(call_id="abc", operator_id="op-1")
    s.transcript_buffer = transcript
    s.pacs = "P1"
    from collections import deque
    import time
    s.recent_window = deque([(time.time(), transcript)])
    return s

@pytest.mark.asyncio
async def test_stable_no_escalation():
    mock_resp = MagicMock()
    mock_resp.content[0].text = '{"escalate":false,"trigger_phrase":null,"severity":"stable","recommended_pacs":null,"reasoning":"ok"}'
    with patch("backend.services.smart_hold._client") as m:
        m.messages.create.return_value = mock_resp
        result = await check_escalation(make_state("ok staying calm ambulance coming"))
    assert result["escalate"] == False

@pytest.mark.asyncio
async def test_unresponsive_triggers_escalation():
    mock_resp = MagicMock()
    mock_resp.content[0].text = '{"escalate":true,"trigger_phrase":"he is not responding","severity":"critical","recommended_pacs":"P1+","reasoning":"unresponsive"}'
    with patch("backend.services.smart_hold._client") as m:
        m.messages.create.return_value = mock_resp
        result = await check_escalation(make_state("hello? he is not responding anymore"))
    assert result["escalate"] == True
    assert result["severity"] == "critical"

@pytest.mark.asyncio
async def test_api_failure_returns_stable():
    with patch("backend.services.smart_hold._client") as m:
        m.messages.create.side_effect = Exception("timeout")
        result = await check_escalation(make_state("some transcript"))
    assert result["escalate"] == False
    assert result["severity"] == "stable"
