from __future__ import annotations

from movesense_opensense.acquisition.live import parser


def test_tilt_stream_defaults_to_hrv_ecg_and_low_rate_imu() -> None:
    arguments = parser().parse_args(
        ["tilt-stream", "--address", "test-sensor"]
    )

    assert arguments.ecg_rate == 512
    assert arguments.imu_rate == 26
