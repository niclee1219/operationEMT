import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from backend.services.stt import DeepgramSTTClient


@pytest.mark.asyncio
async def test_callback_called_on_transcript():
    received = []

    async def cb(call_id, text, is_final):
        received.append((call_id, text, is_final))

    client = DeepgramSTTClient(api_key="test-key")
    await client._handle_message(
        "call-1",
        '{"channel":{"alternatives":[{"transcript":"hello"}]},"is_final":true}',
        cb,
    )
    assert received == [("call-1", "hello", True)]


@pytest.mark.asyncio
async def test_ignores_empty_transcript():
    received = []

    async def cb(call_id, text, is_final):
        received.append(text)

    client = DeepgramSTTClient(api_key="test-key")
    await client._handle_message(
        "call-1",
        '{"channel":{"alternatives":[{"transcript":""}]},"is_final":false}',
        cb,
    )
    assert received == []
