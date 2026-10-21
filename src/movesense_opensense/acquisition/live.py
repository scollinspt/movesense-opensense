from __future__ import annotations

import argparse
import asyncio
import json
import signal
import sys
from collections.abc import Sequence
from dataclasses import asdict
from typing import Any

from .gsp import (
    EcgSample,
    MovesenseEcgImuStream,
    MovesenseImu9Stream,
    discover_movesense,
)


def emit(event: str, **payload: Any) -> None:
    print(json.dumps({"event": event, **payload}, separators=(",", ":")), flush=True)


async def scan(timeout_seconds: float) -> None:
    emit("scan-started")
    sensors = await discover_movesense(timeout_seconds)
    emit("scan-complete", sensors=[asdict(sensor) for sensor in sensors])


async def stream(address: str, sample_rate_hz: int) -> None:
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for signal_name in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(signal_name, stop_event.set)
        except NotImplementedError:
            pass

    emit("connecting", address=address, sample_rate_hz=sample_rate_hz)
    source = MovesenseImu9Stream(address, sample_rate_hz)
    sample_count = 0
    try:
        async for sample in source.samples(stop_event):
            if sample_count == 0:
                emit("connected", address=address, sample_rate_hz=sample_rate_hz)
            sample_count += 1
            emit("sample", sample=sample.as_dict(), sample_count=sample_count)
    finally:
        emit("stopped", sample_count=sample_count)


async def tilt_stream(
    address: str,
    ecg_sample_rate_hz: int,
    imu_sample_rate_hz: int,
) -> None:
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for signal_name in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(signal_name, stop_event.set)
        except NotImplementedError:
            pass

    emit(
        "connecting",
        address=address,
        ecg_sample_rate_hz=ecg_sample_rate_hz,
        imu_sample_rate_hz=imu_sample_rate_hz,
    )
    source = MovesenseEcgImuStream(
        address,
        ecg_sample_rate_hz=ecg_sample_rate_hz,
        imu_sample_rate_hz=imu_sample_rate_hz,
    )
    ecg_count = 0
    imu_count = 0
    connected = False
    try:
        async for sample in source.samples(stop_event):
            if not connected:
                emit(
                    "connected",
                    address=address,
                    ecg_sample_rate_hz=ecg_sample_rate_hz,
                    imu_sample_rate_hz=imu_sample_rate_hz,
                )
                connected = True
            if isinstance(sample, EcgSample):
                ecg_count += 1
                sample_payload = sample.as_dict()
                sample_payload["host_monotonic_ns"] = str(sample.host_monotonic_ns)
                sample_payload["host_time_ns"] = str(sample.host_time_ns)
                emit("ecg-sample", sample=sample_payload, sample_count=ecg_count)
            else:
                imu_count += 1
                sample_payload = sample.as_dict()
                sample_payload["host_monotonic_ns"] = str(sample.host_monotonic_ns)
                sample_payload["host_time_ns"] = str(sample.host_time_ns)
                emit("imu-sample", sample=sample_payload, sample_count=imu_count)
    finally:
        emit("stopped", ecg_count=ecg_count, imu_count=imu_count)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Movesense live BLE acquisition bridge")
    subparsers = result.add_subparsers(dest="command", required=True)

    scan_parser = subparsers.add_parser("scan", help="Scan for nearby Movesense sensors")
    scan_parser.add_argument("--timeout", type=float, default=5.0)

    stream_parser = subparsers.add_parser("stream", help="Stream IMU9 data as JSON lines")
    stream_parser.add_argument("--address", required=True)
    stream_parser.add_argument("--sample-rate", type=int, default=52)

    tilt_parser = subparsers.add_parser(
        "tilt-stream",
        help="Stream concurrent ECG and IMU9 data as JSON lines",
    )
    tilt_parser.add_argument("--address", required=True)
    tilt_parser.add_argument("--ecg-rate", type=int, default=125)
    tilt_parser.add_argument("--imu-rate", type=int, default=52)
    return result


async def run(arguments: argparse.Namespace) -> None:
    if arguments.command == "scan":
        await scan(arguments.timeout)
    elif arguments.command == "stream":
        await stream(arguments.address, arguments.sample_rate)
    elif arguments.command == "tilt-stream":
        await tilt_stream(
            arguments.address,
            arguments.ecg_rate,
            arguments.imu_rate,
        )


def main(argv: Sequence[str] | None = None) -> int:
    arguments = parser().parse_args(argv)
    try:
        asyncio.run(run(arguments))
    except Exception as error:
        emit("error", message=str(error), error_type=type(error).__name__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
