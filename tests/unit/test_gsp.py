from __future__ import annotations

import asyncio
import struct

import pytest

from movesense_opensense.acquisition.gsp import (
    ECG_REFERENCE,
    EcgDecoder,
    GspPacketError,
    IMU9_REFERENCE,
    Imu9Decoder,
    MovesenseEcgImuStream,
    PACKET_TYPE_DATA,
    PACKET_TYPE_DATA_PART2,
)


def imu9_packet_pair(
    timestamp: int,
    acceleration: list[tuple[float, float, float]],
    angular_velocity: list[tuple[float, float, float]],
    magnetic_field: list[tuple[float, float, float]],
) -> tuple[bytes, bytes]:
    values = [*acceleration, *angular_velocity, *magnetic_field]
    payload = struct.pack("<I", timestamp) + b"".join(
        struct.pack("<fff", *vector) for vector in values
    )
    split = 34
    first = bytes((PACKET_TYPE_DATA, IMU9_REFERENCE)) + payload[:split]
    second = bytes((PACKET_TYPE_DATA_PART2, IMU9_REFERENCE)) + payload[split:]
    return first, second


def test_decodes_two_part_imu9_packet() -> None:
    first, second = imu9_packet_pair(
        1000,
        [(1.0, 2.0, 3.0), (4.0, 5.0, 6.0)],
        [(7.0, 8.0, 9.0), (10.0, 11.0, 12.0)],
        [(13.0, 14.0, 15.0), (16.0, 17.0, 18.0)],
    )
    decoder = Imu9Decoder(sample_rate_hz=52)

    assert decoder.decode(first, host_monotonic_ns=10, host_time_ns=20) == []
    samples = decoder.decode(second, host_monotonic_ns=30, host_time_ns=40)

    assert [sample.sensor_timestamp_ms for sample in samples] == [1000, 1019]
    assert samples[0].host_monotonic_ns == 30
    assert samples[0].host_time_ns == 40
    assert (
        samples[0].acceleration_x,
        samples[0].angular_velocity_y,
        samples[0].magnetic_field_z,
    ) == (1.0, 8.0, 15.0)
    assert (
        samples[1].acceleration_z,
        samples[1].angular_velocity_x,
        samples[1].magnetic_field_y,
    ) == (6.0, 10.0, 17.0)


def test_rejects_continuation_without_first_part() -> None:
    decoder = Imu9Decoder(sample_rate_hz=52)

    with pytest.raises(GspPacketError, match="without a first packet"):
        decoder.decode(
            bytes((PACKET_TYPE_DATA_PART2, IMU9_REFERENCE, 0)),
            host_monotonic_ns=1,
            host_time_ns=2,
        )


def test_decodes_complete_type_two_packet() -> None:
    first, second = imu9_packet_pair(
        2000,
        [(1.0, 2.0, 3.0), (4.0, 5.0, 6.0)],
        [(7.0, 8.0, 9.0), (10.0, 11.0, 12.0)],
        [(13.0, 14.0, 15.0), (16.0, 17.0, 18.0)],
    )
    complete = first + second[2:]
    decoder = Imu9Decoder(sample_rate_hz=52)

    samples = decoder.decode(
        complete,
        host_monotonic_ns=30,
        host_time_ns=40,
    )

    assert [sample.sensor_timestamp_ms for sample in samples] == [2000, 2019]
    assert samples[1].magnetic_field_z == 18.0


def test_ignores_other_subscription_references() -> None:
    decoder = Imu9Decoder(sample_rate_hz=52)

    assert (
        decoder.decode(
            bytes((PACKET_TYPE_DATA, 100, 0)),
            host_monotonic_ns=1,
            host_time_ns=2,
        )
        == []
    )


def test_decodes_complete_ecg_packet() -> None:
    payload = struct.pack("<Iiii", 5000, 100, -200, 300)
    packet = bytes((PACKET_TYPE_DATA, ECG_REFERENCE)) + payload
    decoder = EcgDecoder(sample_rate_hz=125)

    samples = decoder.decode(
        packet,
        host_monotonic_ns=10,
        host_time_ns=20,
    )

    assert [sample.sensor_timestamp_ms for sample in samples] == [5000, 5008, 5016]
    assert [sample.raw_value for sample in samples] == [100, -200, 300]
    assert samples[0].host_monotonic_ns == 10
    assert samples[0].host_time_ns == 20


def test_reassembles_interleaved_ecg_and_imu_references() -> None:
    ecg_payload = struct.pack("<Iii", 1000, 123, 456)
    ecg_first = bytes((PACKET_TYPE_DATA, ECG_REFERENCE)) + ecg_payload[:7]
    ecg_second = bytes((PACKET_TYPE_DATA_PART2, ECG_REFERENCE)) + ecg_payload[7:]
    imu_first, imu_second = imu9_packet_pair(
        2000,
        [(1.0, 2.0, 3.0), (4.0, 5.0, 6.0)],
        [(7.0, 8.0, 9.0), (10.0, 11.0, 12.0)],
        [(13.0, 14.0, 15.0), (16.0, 17.0, 18.0)],
    )
    ecg_decoder = EcgDecoder(sample_rate_hz=125)
    imu_decoder = Imu9Decoder(sample_rate_hz=52)

    assert ecg_decoder.decode(
        ecg_first,
        host_monotonic_ns=1,
        host_time_ns=2,
    ) == []
    assert imu_decoder.decode(
        imu_first,
        host_monotonic_ns=3,
        host_time_ns=4,
    ) == []
    ecg_samples = ecg_decoder.decode(
        ecg_second,
        host_monotonic_ns=5,
        host_time_ns=6,
    )
    imu_samples = imu_decoder.decode(
        imu_second,
        host_monotonic_ns=7,
        host_time_ns=8,
    )

    assert [sample.raw_value for sample in ecg_samples] == [123, 456]
    assert len(imu_samples) == 2


class _Services:
    @staticmethod
    def get_characteristic(_uuid: str) -> object:
        return object()


class _FakeClient:
    instances: list[_FakeClient] = []

    def __init__(self, _device: object, disconnected_callback: object) -> None:
        self.disconnected_callback = disconnected_callback
        self.services = _Services()
        self.is_connected = False
        self.writes: list[bytes] = []
        self.__class__.instances.append(self)

    async def connect(self) -> None:
        self.is_connected = True

    async def start_notify(self, _uuid: str, _handler: object) -> None:
        return None

    async def write_gatt_char(
        self,
        _uuid: str,
        value: bytes,
        *,
        response: bool,
    ) -> None:
        assert response is True
        self.writes.append(value)

    async def stop_notify(self, _uuid: str) -> None:
        return None

    async def disconnect(self) -> None:
        self.is_connected = False


def test_subscribes_and_unsubscribes_with_distinct_references() -> None:
    async def exercise() -> list[bytes]:
        stop_event = asyncio.Event()
        stop_event.set()
        stream = MovesenseEcgImuStream(
            "sensor",
            ecg_sample_rate_hz=125,
            imu_sample_rate_hz=52,
            client_factory=_FakeClient,
        )
        async for _sample in stream.samples(stop_event):
            raise AssertionError("No samples expected when stop is already set")
        return _FakeClient.instances[-1].writes

    writes = asyncio.run(exercise())

    assert writes == [
        bytes((1, ECG_REFERENCE)) + b"/Meas/ECG/125",
        bytes((1, IMU9_REFERENCE)) + b"/Meas/IMU9/52",
        bytes((2, IMU9_REFERENCE)),
        bytes((2, ECG_REFERENCE)),
    ]
