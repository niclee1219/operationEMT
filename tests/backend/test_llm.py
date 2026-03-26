import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import backend.services.llm as llm_module
from backend.services.llm import extract_patient_data


@pytest.fixture(autouse=True)
def clear_cache():
    """Ensure _cache is empty before every test to prevent cross-test pollution."""
    llm_module._cache.clear()
    yield
    llm_module._cache.clear()


@pytest.mark.asyncio
async def test_returns_typed_result():
    mock_response = MagicMock()
    mock_response.content[0].text = '{"name":"Ahmad","age":52,"location":"Blk 44","condition":"Chest pain","differentials":[{"condition":"STEMI","probability":0.7},{"condition":"NSTEMI","probability":0.3}],"pacs":"P1","reasoning":"chest pain with age"}'
    with patch("backend.services.llm._client") as mock_client:
        mock_client.messages.create.return_value = mock_response
        result = await extract_patient_data("chest pain transcript", "call-1")
    assert result["name"] == "Ahmad"
    assert result["pacs"] == "P1"

@pytest.mark.asyncio
async def test_cardiac_arrest_gets_p1plus():
    mock_response = MagicMock()
    mock_response.content[0].text = '{"name":null,"age":null,"location":null,"condition":"Cardiac arrest","differentials":[{"condition":"VF","probability":1.0}],"pacs":"P1+","reasoning":"not breathing no pulse"}'
    with patch("backend.services.llm._client") as mock_client:
        mock_client.messages.create.return_value = mock_response
        result = await extract_patient_data("he's not breathing, no pulse", "call-2")
    assert result["pacs"] == "P1+"

@pytest.mark.asyncio
async def test_returns_cached_on_api_error():
    from backend.services.llm import _cache
    _cache["call-3"] = {"name": "Last Good", "pacs": "P2", "differentials": [], "condition": "Abdominal pain", "age": None, "location": None, "reasoning": "cached"}
    with patch("backend.services.llm._client") as mock_client:
        mock_client.messages.create.side_effect = Exception("API down")
        result = await extract_patient_data("some transcript", "call-3")
    assert result["name"] == "Last Good"

@pytest.mark.asyncio
async def test_returns_none_on_first_failure_no_cache():
    with patch("backend.services.llm._client") as mock_client:
        mock_client.messages.create.side_effect = Exception("API down")
        result = await extract_patient_data("some transcript", "call-99")
    assert result is None


@pytest.mark.asyncio
async def test_returns_none_on_malformed_json():
    """extract_patient_data must return None (not raise) when the API returns non-JSON."""
    mock_response = MagicMock()
    mock_response.content[0].text = "Sorry, I cannot help with that."
    with patch("backend.services.llm._client") as mock_client:
        mock_client.messages.create.return_value = mock_response
        result = await extract_patient_data("some transcript", "call-bad-json")
    assert result is None
    assert "call-bad-json" not in llm_module._cache
