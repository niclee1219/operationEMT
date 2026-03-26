import asyncio
import logging
import time

from backend.services.llm import extract_patient_data
from backend.services.smart_hold import check_escalation
from backend.state import CallStore

logger = logging.getLogger(__name__)


class Pipeline:
    """
    Orchestrates the three async paths for each active call:
    1. STT transcript → immediate broadcast
    2. LLM extraction → extraction_update broadcast (background)
    3. Smart Hold monitoring loop → escalation_alert broadcast
    """

    def __init__(self, store: CallStore, broadcast_fn):
        """
        Args:
            store: The shared CallStore instance.
            broadcast_fn: async callable(operator_id, message_dict) to push
                         messages to the operator's dashboard WebSocket.
        """
        self._store = store
        self._broadcast = broadcast_fn
        self._smart_hold_tasks: dict[str, asyncio.Task] = {}
        self._extraction_tasks: dict[str, asyncio.Task] = {}

    async def on_transcript_chunk(
        self, call_id: str, text: str, is_final: bool
    ) -> None:
        """
        Called by the STT service for every transcript chunk.

        Broadcasts transcript_delta immediately (latency-critical path).
        If is_final=True, schedules LLM extraction in the background.
        """
        call_state = await self._store.get_call(call_id)
        if call_state is None:
            logger.warning("on_transcript_chunk: unknown call %s", call_id)
            return

        ts = time.time()

        # Only commit final chunks to the buffer — interim results are superseded
        # by the final for the same utterance and would duplicate the transcript.
        if is_final:
            await self._store.update_call(
                call_id,
                transcript_buffer=call_state.transcript_buffer + " " + text,
            )
            call_state.recent_window.append((ts, text))

        # Broadcast all chunks immediately (latency-critical).
        # is_final lets the dashboard replace the interim preview with confirmed text.
        await self._broadcast(
            call_state.operator_id,
            {
                "type": "transcript_delta",
                "call_id": call_id,
                "text": text,
                "is_final": is_final,
                "timestamp": ts,
            },
        )

        # Schedule extraction in background (does not block transcript broadcast)
        if is_final:
            # Cancel any in-progress extraction (debounce — only keep the latest)
            existing = self._extraction_tasks.pop(call_id, None)
            if existing and not existing.done():
                existing.cancel()
            task = asyncio.create_task(self._trigger_extraction(call_id))
            self._extraction_tasks[call_id] = task

    async def _trigger_extraction(self, call_id: str) -> None:
        """
        Run LLM extraction on the current transcript buffer.
        Broadcasts extraction_update on success. Logs and returns on failure.
        """
        try:
            call_state = await self._store.get_call(call_id)
            if call_state is None:
                return
            result = await extract_patient_data(
                call_state.transcript_buffer.strip(), call_id
            )
            if result is None:
                return

            # Determine which fields changed vs operator overrides
            fields_updated = []
            patient_update = {}
            for field in ("name", "age", "location"):
                new_val = result.get(field)
                old_val = call_state.patient.get(field)
                if new_val != old_val and field not in call_state.operator_overrides:
                    patient_update[field] = new_val
                    fields_updated.append(field)

            for field in ("pacs", "condition"):
                new_val = result.get(field)
                old_val = getattr(call_state, field)
                if new_val != old_val and field not in call_state.operator_overrides:
                    fields_updated.append(field)

            # Update state
            update_kwargs = {}
            if patient_update:
                merged_patient = {**call_state.patient, **patient_update}
                update_kwargs["patient"] = merged_patient
            if result.get("pacs") and "pacs" not in call_state.operator_overrides:
                update_kwargs["pacs"] = result["pacs"]
            if result.get("condition") and "condition" not in call_state.operator_overrides:
                update_kwargs["condition"] = result["condition"]
            if result.get("differentials"):
                update_kwargs["differentials"] = result["differentials"]
            # New extended fields — only update if not operator-overridden
            if result.get("allergies") and "allergies" not in call_state.operator_overrides:
                update_kwargs["allergies"] = result["allergies"]
                fields_updated.append("allergies")
            if result.get("past_conditions") and "past_conditions" not in call_state.operator_overrides:
                update_kwargs["past_conditions"] = result["past_conditions"]
                fields_updated.append("past_conditions")
            if result.get("additional_notes") and "additional_notes" not in call_state.operator_overrides:
                update_kwargs["additional_notes"] = result["additional_notes"]
                fields_updated.append("additional_notes")
            if update_kwargs:
                await self._store.update_call(call_id, **update_kwargs)

            # Broadcast extraction_update
            updated_state = await self._store.get_call(call_id)
            await self._broadcast(
                call_state.operator_id,
                {
                    "type": "extraction_update",
                    "call_id": call_id,
                    "patient": updated_state.patient if updated_state else call_state.patient,
                    "condition": result.get("condition"),
                    "differentials": result.get("differentials", []),
                    "pacs": result.get("pacs"),
                    "confirmed": call_state.confirmed,
                    "allergies": result.get("allergies", []),
                    "past_conditions": result.get("past_conditions", []),
                    "additional_notes": result.get("additional_notes"),
                    "fields_updated": fields_updated,
                    "timestamp": time.time(),
                },
            )
        except Exception as e:
            logger.error("Extraction pipeline error for call %s: %s", call_id, e)
        finally:
            # Only remove if this task is still the stored task (guards against
            # rapid debounce where a newer task replaced us in _extraction_tasks)
            if self._extraction_tasks.get(call_id) is asyncio.current_task():
                self._extraction_tasks.pop(call_id, None)

    def start_smart_hold_loop(self, call_id: str) -> None:
        """Start the Smart Hold monitoring loop for a call."""
        if call_id in self._smart_hold_tasks:
            return  # Already running
        task = asyncio.create_task(self._smart_hold_loop(call_id))
        self._smart_hold_tasks[call_id] = task
        logger.info("Smart Hold loop started for call %s", call_id)

    def stop_smart_hold_loop(self, call_id: str) -> None:
        """Cancel and remove the Smart Hold monitoring task."""
        task = self._smart_hold_tasks.pop(call_id, None)
        if task:
            task.cancel()
            logger.info("Smart Hold loop stopped for call %s", call_id)

    async def _smart_hold_loop(self, call_id: str) -> None:
        """
        Polls every 8 seconds for condition escalation.
        Only runs while call status is 'smart_hold'.
        """
        try:
            while True:
                await asyncio.sleep(8)
                call_state = await self._store.get_call(call_id)
                if call_state is None or call_state.status != "smart_hold":
                    break
                result = await check_escalation(call_state)
                if result.get("escalate"):
                    await self._broadcast(
                        call_state.operator_id,
                        {
                            "type": "escalation_alert",
                            "call_id": call_id,
                            "trigger_phrase": result.get("trigger_phrase"),
                            "severity": result.get("severity"),
                            "recommended_pacs": result.get("recommended_pacs"),
                            "timestamp": time.time(),
                        },
                    )
        except asyncio.CancelledError:
            pass  # Normal cancellation from stop_smart_hold_loop
        except Exception as e:
            logger.error("Smart Hold loop error for call %s: %s", call_id, e)
