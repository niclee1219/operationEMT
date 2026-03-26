import asyncio, pytest
from unittest.mock import AsyncMock, patch, MagicMock
from backend.pipeline import Pipeline
from backend.state import CallStore

@pytest.mark.asyncio
async def test_transcript_broadcasts_immediately():
    store = CallStore()
    await store.create_call("abc", "op-1")
    broadcasts = []
    async def mock_broadcast(op_id, msg):
        broadcasts.append(msg)

    pipeline = Pipeline(store, broadcast_fn=mock_broadcast)
    await pipeline.on_transcript_chunk("abc", "hello world", is_final=False)
    assert any(m["type"] == "transcript_delta" for m in broadcasts)

@pytest.mark.asyncio
async def test_llm_failure_does_not_stop_transcript():
    store = CallStore()
    await store.create_call("abc", "op-1")
    broadcasts = []
    async def mock_broadcast(op_id, msg):
        broadcasts.append(msg)

    with patch("backend.pipeline.extract_patient_data", side_effect=Exception("LLM down")):
        pipeline = Pipeline(store, broadcast_fn=mock_broadcast)
        await pipeline.on_transcript_chunk("abc", "help me", is_final=True)
        await asyncio.sleep(0.1)
    # Transcript delta still broadcast even though LLM failed
    assert any(m["type"] == "transcript_delta" for m in broadcasts)

@pytest.mark.asyncio
async def test_smart_hold_loop_creates_and_cancels_task():
    store = CallStore()
    await store.create_call("abc", "op-1")
    pipeline = Pipeline(store, broadcast_fn=AsyncMock())
    pipeline.start_smart_hold_loop("abc")
    assert "abc" in pipeline._smart_hold_tasks
    pipeline.stop_smart_hold_loop("abc")
    assert "abc" not in pipeline._smart_hold_tasks
