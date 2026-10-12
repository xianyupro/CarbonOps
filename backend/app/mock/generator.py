"""Time-series mock value generator (sinusoidal + trend + noise)."""
from __future__ import annotations
import math
import random
from datetime import datetime, timezone


class TimeSeriesGenerator:
    """Generates deterministic-ish mock values for a single data point."""

    def __init__(
        self,
        base: float = 50.0,
        amplitude: float = 10.0,
        period_s: float = 3600.0,
        noise: float = 1.0,
        trend: float = 0.0,
        data_type: str = "NUMBER",
        seed: int | None = None,
    ):
        self.base = base
        self.amplitude = amplitude
        self.period_s = max(1.0, period_s)
        self.noise = noise
        self.trend = trend
        self.data_type = data_type
        self._rng = random.Random(seed) if seed is not None else random

    def value_at(self, t: datetime) -> float | None:
        if self.data_type != "NUMBER":
            return self.base
        epoch = t.timestamp()
        v = (
            self.base
            + self.amplitude * math.sin(2 * math.pi * epoch / self.period_s)
            + self.trend * (epoch / 86400.0)
            + self._rng.gauss(0.0, self.noise)
        )
        return round(v, 3)

    @staticmethod
    def quality_at(rng: random.Random) -> str:
        """~95% GOOD, ~4% BAD, ~1% MISSING."""
        r = rng.random()
        if r < 0.01:
            return "MISSING"
        if r < 0.05:
            return "BAD"
        return "GOOD"
