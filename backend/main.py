import os
import logging

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.state import CallStore
from backend.services.stt import DeepgramSTTClient
from backend.pipeline import Pipeline
from backend.routers import dashboard_ws as dashboard_router_module
from backend.routers import call_ws as call_ws_module

load_dotenv()
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="OperationEMT")

# CORS — allow all origins for MVP
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared singletons
call_store = CallStore()
stt_client = DeepgramSTTClient()
pipeline = Pipeline(
    store=call_store,
    broadcast_fn=dashboard_router_module.broadcast_to_operator,
)

# Wire routers
dashboard_router_module.setup(store=call_store, pipeline=pipeline)
call_ws_module.setup(
    store=call_store,
    stt_client=stt_client,
    pipeline=pipeline,
    dashboard_router=dashboard_router_module,
)

# Mount routers
app.include_router(dashboard_router_module.router)
app.include_router(call_ws_module.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# Serve static files (caller HTML, greeting audio)
static_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "caller")
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
