from __future__ import annotations

import struct

import pytest

from movesense_opensense.acquisition.gsp import (
    GspPacketError,
    IMU9_REFERENCE,
    Imu9Decoder,
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
