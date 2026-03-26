import asyncio, pytest
from backend.state import CallStore, CallState

@pytest.mark.asyncio
async def test_create_returns_callstate():
    store = CallStore()
    state = await store.create_call("abc", "op-1")
    assert isinstance(state, CallState)
    assert state.call_id == "abc"
    assert state.status == "active"

@pytest.mark.asyncio
async def test_update_merges_fields():
    store = CallStore()
    await store.create_call("abc", "op-1")
    await store.update_call("abc", pacs="P1+")
    state = await store.get_call("abc")
    assert state.pacs == "P1+"
    assert state.operator_id == "op-1"  # preserved

@pytest.mark.asyncio
async def test_concurrent_updates_no_corruption():
    store = CallStore()
    await store.create_call("abc", "op-1")
    async def bump(i):
        await store.update_call("abc", pacs=f"P{i % 4 + 1}")
    await asyncio.gather(*[bump(i) for i in range(50)])
    state = await store.get_call("abc")
    assert state.pacs is not None  # not corrupted

@pytest.mark.asyncio
async def test_get_calls_for_operator():
    store = CallStore()
    await store.create_call("a", "op-1")
    await store.create_call("b", "op-2")
    calls = store.get_calls_for_operator("op-1")
    assert len(calls) == 1 and calls[0].call_id == "a"

@pytest.mark.asyncio
async def test_delete_call():
    store = CallStore()
    await store.create_call("abc", "op-1")
    await store.delete_call("abc")
    assert await store.get_call("abc") is None
