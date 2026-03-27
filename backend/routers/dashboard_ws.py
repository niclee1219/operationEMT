import json
import logging
from collections import defaultdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.state import CallStore
from backend.routers import call_ws as call_ws_module

logger = logging.getLogger(__name__)
router = APIRouter()

# Hub: operator_id → set of active WebSocket connections
_hub: dict[str, set[WebSocket]] = defaultdict(set)

_store: CallStore | None = None
_pipeline = None


async def broadcast_to_operator(operator_id: str, message: dict) -> None:
    """Send a JSON message to all dashboard connections for an operator."""
    dead = set()
    for ws in list(_hub.get(operator_id, set())):
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    for ws in dead:
        _hub[operator_id].discard(ws)


def setup(store: CallStore, pipeline) -> None:
    """Wire the store and pipeline into this router (called from main.py)."""
    global _store, _pipeline
    _store = store
    _pipeline = pipeline


@router.websocket("/ws/dashboard/{operator_id}")
async def dashboard_ws(websocket: WebSocket, operator_id: str):
    await websocket.accept()
    _hub[operator_id].add(websocket)
    logger.info("Dashboard connected: operator=%s", operator_id)

    # Send state snapshot for all calls (reconnect recovery)
    for call_state in _store.get_calls_for_operator(operator_id):
        await websocket.send_json({
            "type": "call_started",
            "call_id": call_state.call_id,
            "timestamp": call_state.created_at,
        })
        if call_state.pacs or call_state.condition:
            await websocket.send_json({
                "type": "extraction_update",
                "call_id": call_state.call_id,
                "patient": call_state.patient,
                "condition": call_state.condition,
                "differentials": call_state.differentials,
                "pacs": call_state.pacs,
                "confirmed": call_state.confirmed,
                "allergies": call_state.allergies,
                "past_conditions": call_state.past_conditions,
                "additional_notes": call_state.additional_notes,
                "fields_updated": [],
                "timestamp": call_state.created_at,
            })
        # Restore correct status — frontend defaults new calls to 'ringing'
        if call_state.status == "ended":
            await websocket.send_json({
                "type": "call_ended",
                "call_id": call_state.call_id,
                "timestamp": call_state.created_at,
            })
        elif call_state.status == "smart_hold":
            await websocket.send_json({
                "type": "call_status_changed",
                "call_id": call_state.call_id,
                "status": "smart_hold",
                "timestamp": call_state.created_at,
            })
        elif call_state.status == "active":
            await websocket.send_json({
                "type": "call_status_changed",
                "call_id": call_state.call_id,
                "status": "active",
                "timestamp": call_state.created_at,
            })

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg_type = msg.get("type")
            call_id = msg.get("call_id")

            if msg_type == "field_edit":
                field = msg.get("field")
                value = msg.get("value")
                call_state = await _store.get_call(call_id)
                if call_state:
                    call_state.operator_overrides.add(field)
                    if field in ("name", "age", "location"):
                        new_patient = {**call_state.patient, field: value}
                        await _store.update_call(call_id, patient=new_patient)
                    else:
                        await _store.update_call(call_id, **{field: value})

            elif msg_type == "confirm_triage":
                await _store.update_call(call_id, confirmed=True)

            elif msg_type == "set_smart_hold":
                await _store.update_call(call_id, status="smart_hold")
                _pipeline.start_smart_hold_loop(call_id)
                await broadcast_to_operator(operator_id, {
                    "type": "call_status_changed",
                    "call_id": call_id,
                    "status": "smart_hold",
                })

            elif msg_type == "resume_call":
                await _store.update_call(call_id, status="active")
                _pipeline.stop_smart_hold_loop(call_id)
                await broadcast_to_operator(operator_id, {
                    "type": "call_status_changed",
                    "call_id": call_id,
                    "status": "active",
                })

            elif msg_type == "end_call":
                # Operator-initiated end: close the caller's WebSocket.
                # call_ws.finally will handle cleanup and broadcast call_ended.
                await call_ws_module.force_end_call(call_id)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("Dashboard WS error operator=%s: %s", operator_id, e)
    finally:
        _hub[operator_id].discard(websocket)
        logger.info("Dashboard disconnected: operator=%s", operator_id)
