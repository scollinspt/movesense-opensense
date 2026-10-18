from __future__ import annotations

import argparse
import asyncio
import json
import sys
from collections.abc import Sequence
from typing import Any

from bleak import BleakClient

from .gsp import (
    LEGACY_WHITEBOARD_WRITE_UUID,
    WRITE_CHARACTERISTIC_UUID,
    discover_movesense,
)

MANUFACTURER_UUID = "00002a29-0000-1000-8000-00805f9b34fb"
SERIAL_UUID = "00002a25-0000-1000-8000-00805f9b34fb"
BATTERY_UUID = "00002a19-0000-1000-8000-00805f9b34fb"


def emit(event: str, **payload: Any) -> None:
    print(json.dumps({"event": event, **payload}, separators=(",", ":")), flush=True)


def classify_services(characteristic_uuids: set[str]) -> str:
    normalized = {value.casefold() for value in characteristic_uuids}
    if WRITE_CHARACTERISTIC_UUID in normalized:
        return "gsp-ready"
    if LEGACY_WHITEBOARD_WRITE_UUID in normalized:
        return "legacy-mds"
    return "unknown"


async def read_optional(client: BleakClient, uuid: str) -> bytes | None:
    if client.services.get_characteristic(uuid) is None:
        return None
    return bytes(await client.read_gatt_char(uuid))


async def inspect(address: str, name: str) -> None:
    async with BleakClient(address) as client:
        characteristic_uuids = {
            characteristic.uuid.casefold()
            for service in client.services
            for characteristic in service.characteristics
        }
        manufacturer = await read_optional(client, MANUFACTURER_UUID)
        serial = await read_optional(client, SERIAL_UUID)
        battery = await read_optional(client, BATTERY_UUID)
        emit(
            "inventory",
            device={
                "name": name,
                "address": address,
                "manufacturer": manufacturer.decode("utf-8", errors="replace")
                if manufacturer
                else None,
                "serial": serial.decode("utf-8", errors="replace") if serial else None,
                "battery_percent": battery[0] if battery else None,
                "profile": classify_services(characteristic_uuids),
            },
        )


async def run(arguments: argparse.Namespace) -> None:
    if arguments.command == "scan":
        sensors = await discover_movesense(arguments.timeout)
        emit(
            "scan-complete",
            sensors=[
                {"name": sensor.name, "address": sensor.address, "rssi": sensor.rssi}
                for sensor in sensors
            ],
        )
    elif arguments.command == "inspect":
        await inspect(arguments.address, arguments.name)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Movesense firmware inventory bridge")
    subparsers = result.add_subparsers(dest="command", required=True)
    scan_parser = subparsers.add_parser("scan")
    scan_parser.add_argument("--timeout", type=float, default=5.0)
    inspect_parser = subparsers.add_parser("inspect")
    inspect_parser.add_argument("--address", required=True)
    inspect_parser.add_argument("--name", required=True)
    return result


def main(argv: Sequence[str] | None = None) -> int:
    try:
        asyncio.run(run(parser().parse_args(argv)))
    except Exception as error:
        emit("error", message=str(error), error_type=type(error).__name__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
