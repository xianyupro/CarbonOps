"""Industrial protocol mock + preset loader + runtime value registry."""
from __future__ import annotations
import os
import random
import threading
from datetime import datetime
from pathlib import Path
from typing import Any
import yaml

from app.mock.generator import TimeSeriesGenerator

PRESETS_DIR = Path(__file__).resolve().parent / "presets"


def load_presets() -> list[dict]:
    """Load all preset YAML files as plain dicts."""
    presets: list[dict] = []
    if not PRESETS_DIR.exists():
        return presets
    for fp in sorted(PRESETS_DIR.glob("*.yaml")):
        with open(fp, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if data:
            presets.append(data)
    return presets


def fake_connect_latency_ms(protocol: str) -> int:
    """Simulated connection latency for /test endpoint."""
    base = {"OPC_UA": 80, "MODBUS": 45, "MQTT": 30, "HTTP": 120}.get(protocol, 60)
    return base + random.randint(0, 40)


class _RuntimeRegistry:
    """Thread-safe registry mapping point_id -> TimeSeriesGenerator for live push."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._gens: dict[int, TimeSeriesGenerator] = {}

    def register(self, point_id: int, gen: TimeSeriesGenerator) -> None:
        with self._lock:
            self._gens[point_id] = gen

    def get(self, point_id: int) -> TimeSeriesGenerator | None:
        with self._lock:
            return self._gens.get(point_id)

    def snapshot(self) -> dict[int, TimeSeriesGenerator]:
        with self._lock:
            return dict(self._gens)

    def clear(self) -> None:
        with self._lock:
            self._gens.clear()


# Module-level singleton shared with the WebSocket loop
runtime = _RuntimeRegistry()


def build_generator(point: dict | Any) -> TimeSeriesGenerator:
    """Build a generator from a data_point dict (preset) or ORM model."""
    get = lambda k, d=None: (point.get(k, d) if isinstance(point, dict) else getattr(point, k, d))
    seed = None
    pid = get("id") if not isinstance(point, dict) else None
    if pid:
        seed = int(pid)
    return TimeSeriesGenerator(
        base=float(get("gen_base", get("genBase", 50.0)) or 50.0),
        amplitude=float(get("gen_amplitude", get("genAmplitude", 10.0)) or 10.0),
        period_s=float(get("gen_period_s", get("genPeriodS", 3600.0)) or 3600.0),
        noise=float(get("gen_noise", get("genNoise", 1.0)) or 1.0),
        trend=float(get("gen_trend", get("genTrend", 0.0)) or 0.0),
        data_type=get("data_type", get("dataType", "NUMBER")) or "NUMBER",
        seed=seed,
    )
