from dataclasses import dataclass, field
from collections import deque
import asyncio
import time


@dataclass
class CallState:
    call_id: str
    operator_id: str
    status: str = "active"          # "active" | "smart_hold" | "ended"
    transcript_buffer: str = ""     # Full accumulation
    recent_window: deque = field(default_factory=lambda: deque(maxlen=500))  # (timestamp, text) last 60s
    patient: dict = field(default_factory=lambda: {"name": None, "age": None, "location": None})
    condition: str | None = None
    differentials: list = field(default_factory=list)
    pacs: str | None = None
    confirmed: bool = False
    operator_overrides: set = field(default_factory=set)  # fields manually edited
    created_at: float = field(default_factory=time.time)


class CallStore:
    def __init__(self):
        self._calls: dict[str, CallState] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._global_lock: asyncio.Lock = asyncio.Lock()

    async def create_call(self, call_id: str, operator_id: str) -> CallState:
        async with self._global_lock:
            if call_id in self._calls:
                return self._calls[call_id]
            state = CallState(call_id=call_id, operator_id=operator_id)
            self._calls[call_id] = state
            self._locks[call_id] = asyncio.Lock()
            return state

    async def get_call(self, call_id: str) -> CallState | None:
        return self._calls.get(call_id)

    async def update_call(self, call_id: str, **kwargs) -> None:
        async with self._global_lock:
            lock = self._locks.get(call_id)
            if lock is None:
                raise KeyError(f"No call found with id: {call_id}")
        async with lock:
            state = self._calls.get(call_id)
            if state is None:
                raise KeyError(f"No call found with id: {call_id}")
            for key, value in kwargs.items():
                setattr(state, key, value)

    async def delete_call(self, call_id: str) -> None:
        async with self._global_lock:
            lock = self._locks.get(call_id)
            if lock is None:
                return
            async with lock:
                self._calls.pop(call_id, None)
                self._locks.pop(call_id, None)

    def get_calls_for_operator(self, operator_id: str) -> list[CallState]:
        return [state for state in self._calls.values() if state.operator_id == operator_id]
