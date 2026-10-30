from __future__ import annotations

import asyncio
from typing import Any

from movesense_opensense.acquisition import live
from movesense_opensense.acquisition.live import parser


def test_tilt_stream_defaults_to_hrv_ecg_and_low_rate_imu() -> None:
    arguments = parser().parse_args(
        ["tilt-stream", "--address", "test-sensor"]
    )

    assert arguments.ecg_rate == 512
    assert arguments.imu_rate == 26


def test_dual_stream_accepts_two_addresses_and_one_rate() -> None:
    arguments = parser().parse_args(
        [
            "dual-stream",
            "--left-address",
            "left-sensor",
            "--right-address",
            "right-sensor",
            "--sample-rate",
            "104",
        ]
    )

    assert arguments.left_address == "left-sensor"
    assert arguments.right_address == "right-sensor"
    assert arguments.sample_rate == 104


def test_dual_stream_emits_role_tagged_samples(monkeypatch: Any) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    resolved_addresses: list[str] = []

    class Sample:
        @staticmethod
        def as_dict() -> dict[str, int]:
            return {"sensor_timestamp_ms": 1}

    class Stream:
        def __init__(self, device: str, sample_rate_hz: int) -> None:
            self.device = device
            self.sample_rate_hz = sample_rate_hz

        async def samples(self, _stop_event: asyncio.Event):
            yield Sample()

    async def resolve(addresses: list[str]) -> dict[str, str]:
        resolved_addresses.extend(addresses)
        return {address: f"device:{address}" for address in addresses}

    def capture(event: str, **payload: object) -> None:
        events.append((event, payload))

    monkeypatch.setattr(live, "resolve_ble_devices", resolve)
    monkeypatch.setattr(live, "MovesenseImu9Stream", Stream)
    monkeypatch.setattr(live, "emit", capture)

    asyncio.run(live.dual_stream("left", "right", 52))

    assert resolved_addresses == ["left", "right"]
    assert {
        (event, payload.get("role"))
        for event, payload in events
        if event in {"connected", "sample", "stopped"}
    } == {
        ("connected", "left_distal_shank"),
        ("sample", "left_distal_shank"),
        ("stopped", "left_distal_shank"),
        ("connected", "right_distal_shank"),
        ("sample", "right_distal_shank"),
        ("stopped", "right_distal_shank"),
    }
