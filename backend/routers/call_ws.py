import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.state import CallStore

logger = logging.getLogger(__name__)
router = APIRouter()

_store: CallStore | None = None
_stt = None
_pipeline = None
_dashboard_router = None  # for broadcasting call_started / call_ended

# Active caller WebSockets — allows dashboard to force-end a call
_caller_ws: dict[str, WebSocket] = {}


async def force_end_call(call_id: str) -> None:
    """Close the caller's WebSocket from the operator side (End Call button)."""
    ws = _caller_ws.get(call_id)
    if ws:
        try:
            await ws.close(code=1000)
        except Exception:
            pass


def setup(store: CallStore, stt_client, pipeline, dashboard_router) -> None:
    global _store, _stt, _pipeline, _dashboard_router
    _store = store
    _stt = stt_client
    _pipeline = pipeline
    _dashboard_router = dashboard_router


@router.websocket("/ws/call/{call_id}/audio")
async def call_audio_ws(websocket: WebSocket, call_id: str):
    await websocket.accept()
    logger.info("Caller connected: call_id=%s", call_id)
    operator_id = None
    stream_started = False  # guard for unconditional close_stream in finally

    try:
        # First frame must be call_init JSON
        raw = await websocket.receive_text()
        msg = json.loads(raw)
        if msg.get("type") != "call_init":
            await websocket.close(code=4001)
            return

        operator_id = msg.get("operator_id", "unknown")
        audio_mime = msg.get("audio_mime", "audio/webm;codecs=opus")

        # Create call state
        await _store.create_call(call_id, operator_id)
        _caller_ws[call_id] = websocket

        # Notify dashboard
        await _dashboard_router.broadcast_to_operator(operator_id, {
            "type": "call_started",
            "call_id": call_id,
        })

        # Start STT stream
        await _stt.start_stream(call_id, audio_mime, _pipeline.on_transcript_chunk)
        stream_started = True

        # Stream audio chunks
        while True:
            data = await websocket.receive()
            if data.get("type") == "websocket.disconnect":
                break  # clean exit — hits finally for proper cleanup
            if "bytes" in data:
                await _stt.send_audio(call_id, data["bytes"])
            elif "text" in data:
                # Control message (e.g., ping)
                pass

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("Call WS error call_id=%s: %s", call_id, e)
    finally:
        # Cleanup
        _caller_ws.pop(call_id, None)
        if stream_started:
            await _stt.close_stream(call_id)
        if _store is not None:
            try:
                await _store.update_call(call_id, status="ended")
            except KeyError:
                pass  # call was never created (e.g., close before call_init)
        if operator_id:
            await _dashboard_router.broadcast_to_operator(operator_id, {
                "type": "call_ended",
                "call_id": call_id,
            })
        logger.info("Call ended: call_id=%s", call_id)
