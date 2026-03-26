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

        # Append to buffers
        await self._store.update_call(
            call_id,
            transcript_buffer=call_state.transcript_buffer + " " + text,
        )
        # call_state is the live object (CallStore returns references, not copies)
        # so appending to recent_window directly mutates the stored deque safely
        call_state.recent_window.append((ts, text))

        # Broadcast immediately (latency-critical)
        await self._broadcast(
            call_state.operator_id,
            {
                "type": "transcript_delta",
                "call_id": call_id,
                "text": text,
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
                # Differentials bypass operator_overrides intentionally:
                # operators cannot override AI-generated differential diagnoses in this MVP
                update_kwargs["differentials"] = result["differentials"]
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
                    "fields_updated": fields_updated,
                    "timestamp": time.time(),
                },
            )
        except Exception as e:
            logger.error("Extraction pipeline error for call %s: %s", call_id, e)
        finally:
            # Clean up the task reference once this extraction run is complete
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
