from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator, Callable
from dataclasses import asdict, dataclass
from struct import Struct
from typing import Any

from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice

WRITE_CHARACTERISTIC_UUID = "34800001-7185-4d5d-b431-630e7050e8f0"
NOTIFY_CHARACTERISTIC_UUID = "34800002-7185-4d5d-b431-630e7050e8f0"
IMU9_REFERENCE = 99
PACKET_TYPE_DATA = 2
PACKET_TYPE_DATA_PART2 = 3
LEGACY_WHITEBOARD_WRITE_UUID = "6b200001-ff4e-4979-8186-fb7ba486fcd7"

_UINT32 = Struct("<I")
_FLOAT32 = Struct("<f")
_VECTOR3_FLOAT32 = Struct("<fff")


@dataclass(frozen=True, slots=True)
class DiscoveredSensor:
    name: str
    address: str
    rssi: int | None


@dataclass(frozen=True, slots=True)
class Imu9Sample:
    sensor_timestamp_ms: int
    host_monotonic_ns: int
    host_time_ns: int
    acceleration_x: float
    acceleration_y: float
    acceleration_z: float
    angular_velocity_x: float
    angular_velocity_y: float
    angular_velocity_z: float
    magnetic_field_x: float
    magnetic_field_y: float
    magnetic_field_z: float

    def as_dict(self) -> dict[str, int | float]:
        return asdict(self)


class GspPacketError(ValueError):
    pass


class Imu9Decoder:
    def __init__(self, sample_rate_hz: int) -> None:
        if sample_rate_hz <= 0:
            raise ValueError("sample_rate_hz must be positive")
        self._sample_rate_hz = sample_rate_hz
        self._first_part: bytes | None = None

    def decode(
        self,
        packet: bytes | bytearray,
        *,
        host_monotonic_ns: int,
        host_time_ns: int,
    ) -> list[Imu9Sample]:
        data = bytes(packet)
        if len(data) < 2:
            raise GspPacketError("GSP notification is shorter than its two-byte header")

        packet_type, reference = data[0], data[1]
        if reference != IMU9_REFERENCE:
            return []
        if packet_type == PACKET_TYPE_DATA:
            if self._has_complete_payload(data):
                return self._decode_complete(
                    data,
                    host_monotonic_ns=host_monotonic_ns,
                    host_time_ns=host_time_ns,
                )
            self._first_part = data
            return []
        if packet_type != PACKET_TYPE_DATA_PART2:
            return []
        if self._first_part is None:
            raise GspPacketError("Received IMU9 continuation without a first packet")

        combined = self._first_part + data[2:]
        self._first_part = None
        return self._decode_complete(
            combined,
            host_monotonic_ns=host_monotonic_ns,
            host_time_ns=host_time_ns,
        )

    @staticmethod
    def _has_complete_payload(data: bytes) -> bool:
        payload_bytes = len(data) - 6
        bytes_per_sample = 9 * _FLOAT32.size
        return payload_bytes > 0 and payload_bytes % bytes_per_sample == 0

    def _decode_complete(
        self,
        combined: bytes,
        *,
        host_monotonic_ns: int,
        host_time_ns: int,
    ) -> list[Imu9Sample]:
        if len(combined) < 6:
            raise GspPacketError("Combined IMU9 packet has no timestamp")

        payload_bytes = len(combined) - 6
        bytes_per_sample = 9 * _FLOAT32.size
        if payload_bytes == 0 or payload_bytes % bytes_per_sample != 0:
            raise GspPacketError(
                f"IMU9 payload length {payload_bytes} is not divisible by {bytes_per_sample}"
            )

        sample_count = payload_bytes // bytes_per_sample
        timestamp = _UINT32.unpack_from(combined, 2)[0]
        signal_block_bytes = sample_count * 3 * _FLOAT32.size
        samples: list[Imu9Sample] = []
        for index in range(sample_count):
            vector_offset = 6 + index * 3 * _FLOAT32.size
            acceleration = _VECTOR3_FLOAT32.unpack_from(combined, vector_offset)
            angular_velocity = _VECTOR3_FLOAT32.unpack_from(
                combined, vector_offset + signal_block_bytes
            )
            magnetic_field = _VECTOR3_FLOAT32.unpack_from(
                combined, vector_offset + 2 * signal_block_bytes
            )
            samples.append(
                Imu9Sample(
                    sensor_timestamp_ms=timestamp
                    + round(index * 1000 / self._sample_rate_hz),
                    host_monotonic_ns=host_monotonic_ns,
                    host_time_ns=host_time_ns,
                    acceleration_x=acceleration[0],
                    acceleration_y=acceleration[1],
                    acceleration_z=acceleration[2],
                    angular_velocity_x=angular_velocity[0],
                    angular_velocity_y=angular_velocity[1],
                    angular_velocity_z=angular_velocity[2],
                    magnetic_field_x=magnetic_field[0],
                    magnetic_field_y=magnetic_field[1],
                    magnetic_field_z=magnetic_field[2],
                )
            )
        return samples


async def discover_movesense(timeout_seconds: float = 5.0) -> list[DiscoveredSensor]:
    discovered = await BleakScanner.discover(
        timeout=timeout_seconds,
        return_adv=True,
    )
    sensors: list[DiscoveredSensor] = []
    for device, advertisement in discovered.values():
        name = device.name or advertisement.local_name or ""
        if "movesense" not in name.casefold():
            continue
        sensors.append(
            DiscoveredSensor(
                name=name,
                address=device.address,
                rssi=advertisement.rssi,
            )
        )
    return sorted(sensors, key=lambda sensor: sensor.name)


class MovesenseImu9Stream:
    def __init__(
        self,
        device: BLEDevice | str,
        sample_rate_hz: int = 52,
        *,
        client_factory: Callable[..., BleakClient] = BleakClient,
    ) -> None:
        if sample_rate_hz <= 0:
            raise ValueError("sample_rate_hz must be positive")
        self._device = device
        self._sample_rate_hz = sample_rate_hz
        self._client_factory = client_factory

    async def samples(self, stop_event: asyncio.Event) -> AsyncIterator[Imu9Sample]:
        queue: asyncio.Queue[Imu9Sample | Exception] = asyncio.Queue()
        decoder = Imu9Decoder(self._sample_rate_hz)

        def disconnected(client: BleakClient) -> None:
            del client
            if not stop_event.is_set():
                queue.put_nowait(ConnectionError("Movesense sensor disconnected"))

        def notification_handler(sender: Any, packet: bytearray) -> None:
            del sender
            host_monotonic_ns = time.monotonic_ns()
            host_time_ns = time.time_ns()
            try:
                decoded = decoder.decode(
                    packet,
                    host_monotonic_ns=host_monotonic_ns,
                    host_time_ns=host_time_ns,
                )
                for sample in decoded:
                    queue.put_nowait(sample)
            except GspPacketError as error:
                if not stop_event.is_set():
                    queue.put_nowait(error)

        client = self._client_factory(
            self._device,
            disconnected_callback=disconnected,
        )
        notifications_started = False
        subscription_started = False
        try:
            await client.connect()
            if client.services.get_characteristic(WRITE_CHARACTERISTIC_UUID) is None:
                if (
                    client.services.get_characteristic(LEGACY_WHITEBOARD_WRITE_UUID)
                    is not None
                ):
                    raise ConnectionError(
                        "Sensor connected, but its installed application exposes the "
                        "legacy Whiteboard/MDS service instead of GSP. Record the "
                        "installed firmware/application before updating it to default "
                        "firmware 2.3.0 or later or loading the GATT SensorData app."
                    )
                raise ConnectionError(
                    "Sensor connected, but the GSP write characteristic is unavailable."
                )
            await client.start_notify(
                NOTIFY_CHARACTERISTIC_UUID,
                notification_handler,
            )
            notifications_started = True
            resource = f"/Meas/IMU9/{self._sample_rate_hz}"
            request = bytes((1, IMU9_REFERENCE)) + resource.encode("utf-8")
            await client.write_gatt_char(
                WRITE_CHARACTERISTIC_UUID,
                request,
                response=True,
            )
            subscription_started = True
            while not stop_event.is_set():
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=0.5)
                except TimeoutError:
                    continue
                if isinstance(item, Exception):
                    raise item
                yield item
        finally:
            if client.is_connected:
                if subscription_started:
                    await client.write_gatt_char(
                        WRITE_CHARACTERISTIC_UUID,
                        bytes((2, IMU9_REFERENCE)),
                        response=True,
                    )
                if notifications_started:
                    await client.stop_notify(NOTIFY_CHARACTERISTIC_UUID)
                await client.disconnect()
