import asyncio
import json
import logging
import os
from collections.abc import Callable

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class DeepgramSTTClient:
    """
    Wraps Deepgram Nova-2 streaming WebSocket for real-time STT.

    Usage:
        client = DeepgramSTTClient(api_key="dg_...")
        await client.start_stream("call-1", "audio/webm;codecs=opus", on_transcript_cb)
        await client.send_audio("call-1", audio_bytes)
        await client.close_stream("call-1")
    """

    def __init__(self, api_key: str | None = None):
        self._api_key = api_key or os.getenv("DEEPGRAM_API_KEY", "")
        self._connections: dict = {}  # call_id → live_client
        self._callbacks: dict = {}    # call_id → callback

    async def _handle_message(self, call_id: str, raw: str, callback: Callable) -> None:
        """
        Parse a Deepgram transcript message and invoke callback if non-empty.

        Deepgram message format:
        {"channel": {"alternatives": [{"transcript": "text"}]}, "is_final": true}
        """
        try:
            msg = json.loads(raw)
            transcript = (
                msg.get("channel", {})
                   .get("alternatives", [{}])[0]
                   .get("transcript", "")
            )
            if not transcript.strip():
                return
            is_final = bool(msg.get("is_final", False))
            await callback(call_id, transcript, is_final)
        except Exception as e:
            logger.error("STT message parse error for call %s: %s", call_id, e)

    async def start_stream(
        self,
        call_id: str,
        audio_mime: str,
        on_transcript_cb: Callable,
    ) -> None:
        """
        Open a Deepgram streaming connection for a call.
        Spawns a background task to listen for transcript messages.
        """
        loop = asyncio.get_running_loop()
        try:
            from deepgram import DeepgramClient, LiveOptions, LiveTranscriptionEvents

            dg = DeepgramClient(api_key=self._api_key)
            # For WebM/Opus (browser MediaRecorder), Deepgram auto-detects
            # the container — do not specify encoding for containerised formats.
            options = LiveOptions(
                model="nova-2",
                interim_results=True,
                language="en",
            )
            connection = dg.listen.live.v("1")

            def on_message(self_inner, result, **kwargs):
                """Called by Deepgram SDK on transcript event (sync)."""
                try:
                    transcript = result.channel.alternatives[0].transcript
                    if not transcript.strip():
                        return
                    is_final = result.is_final
                    loop.create_task(
                        on_transcript_cb(call_id, transcript, is_final)
                    )
                except Exception as e:
                    logger.error("STT callback error for call %s: %s", call_id, e)

            connection.on(LiveTranscriptionEvents.Transcript, on_message)
            connection.start(options)
            self._connections[call_id] = connection
            self._callbacks[call_id] = on_transcript_cb
            logger.info("Deepgram stream started for call %s", call_id)
        except Exception as e:
            logger.error("Failed to start Deepgram stream for call %s: %s", call_id, e)
            raise

    async def send_audio(self, call_id: str, chunk: bytes) -> None:
        """Send a binary audio chunk to the active Deepgram stream."""
        connection = self._connections.get(call_id)
        if connection is None:
            logger.warning("send_audio: no active stream for call %s", call_id)
            return
        try:
            connection.send(chunk)
        except Exception as e:
            logger.error("STT send_audio error for call %s: %s", call_id, e)

    async def close_stream(self, call_id: str) -> None:
        """Gracefully close the Deepgram stream, waiting for final transcript."""
        connection = self._connections.pop(call_id, None)
        self._callbacks.pop(call_id, None)
        if connection is None:
            return
        try:
            connection.finish()
        except Exception as e:
            # Swallow — connection may be half-initialised if start() failed
            logger.debug("STT close_stream (ignored): %s", e)
        logger.info("Deepgram stream closed for call %s", call_id)
