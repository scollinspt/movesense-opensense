from __future__ import annotations

import math
from pathlib import Path

import pytest

from movesense_opensense.opensense.one_dof import (
    ImuRow,
    angle_to_quaternion,
    angle_to_quaternion_x,
    estimate_one_dof_orientation,
    validate_inverse_kinematics,
    write_quaternion_sto,
)


def test_builds_pronation_positive_orientation_from_sensor_x() -> None:
    rows = [
        ImuRow(0, (1.0, 0.0, 0.0)),
        ImuRow(20, (1.0, 0.0, 0.0)),
        ImuRow(40, (1.0, 0.0, 0.0)),
        ImuRow(60, (101.0, 2.0, 1.0)),
        ImuRow(80, (101.0, 2.0, 1.0)),
        ImuRow(100, (101.0, 2.0, 1.0)),
    ]

    estimate = estimate_one_dof_orientation(
        rows,
        calibration_start_seconds=0.0,
        calibration_end_seconds=0.04,
        movement_start_seconds=0.06,
        movement_end_seconds=0.1,
        first_movement="pronation",
    )

    assert estimate.dominant_axis == "x"
    assert estimate.initial_sensor_sign == 1
    assert estimate.sign_multiplier == 1
    assert estimate.samples[-1].angle_degrees == pytest.approx(4.0)
    assert all(
        sum(value * value for value in sample.quaternion_wxyz)
        == pytest.approx(1.0)
        for sample in estimate.samples
    )


def test_maps_negative_sensor_excursion_to_positive_pronation() -> None:
    rows = [
        ImuRow(0, (2.0, 0.0, 0.0)),
        ImuRow(20, (2.0, 0.0, 0.0)),
        ImuRow(40, (2.0, 0.0, 0.0)),
        ImuRow(60, (-98.0, 1.0, 0.0)),
        ImuRow(80, (-98.0, 1.0, 0.0)),
    ]

    estimate = estimate_one_dof_orientation(
        rows,
        calibration_start_seconds=0.0,
        calibration_end_seconds=0.04,
        movement_start_seconds=0.06,
        movement_end_seconds=0.08,
        first_movement="pronation",
    )

    assert estimate.initial_sensor_sign == -1
    assert estimate.sign_multiplier == -1
    assert estimate.samples[-1].angle_degrees == pytest.approx(2.0)


def test_maps_sensor_y_elbow_motion_to_model_z_quaternion() -> None:
    rows = [
        ImuRow(0, (0.0, 2.0, 0.0)),
        ImuRow(20, (0.0, 2.0, 0.0)),
        ImuRow(40, (0.0, 2.0, 0.0)),
        ImuRow(60, (1.0, 102.0, 2.0)),
        ImuRow(80, (1.0, 102.0, 2.0)),
    ]

    estimate = estimate_one_dof_orientation(
        rows,
        calibration_start_seconds=0.0,
        calibration_end_seconds=0.04,
        movement_start_seconds=0.06,
        movement_end_seconds=0.08,
        first_movement="flexion",
        quaternion_axis="z",
    )

    assert estimate.dominant_axis == "y"
    assert estimate.samples[-1].angle_degrees == pytest.approx(2.0)
    assert estimate.samples[-1].quaternion_wxyz == pytest.approx(
        angle_to_quaternion(2.0, "z")
    )


def test_writes_opensim_quaternion_sto(tmp_path: Path) -> None:
    samples = (
        (0.0, 0.0),
        (0.02, 90.0),
    )
    output = tmp_path / "orientations.sto"

    write_quaternion_sto(
        output,
        [
            type(
                "Sample",
                (),
                {
                    "time_seconds": time,
                    "quaternion_wxyz": angle_to_quaternion_x(angle),
                },
            )()
            for time, angle in samples
        ],
    )

    text = output.read_text(encoding="utf-8")
    assert "DataType=Quaternion" in text
    assert "time\tforearm_r_imu" in text
    assert f"{math.sqrt(0.5):.17g}" in text


def test_validates_inverse_kinematics_coordinate(tmp_path: Path) -> None:
    orientations = tmp_path / "orientations.sto"
    motion = tmp_path / "motion.mot"
    write_quaternion_sto(
        orientations,
        [
            type(
                "Sample",
                (),
                {
                    "time_seconds": time,
                    "quaternion_wxyz": angle_to_quaternion_x(angle),
                },
            )()
            for time, angle in ((0.0, 0.0), (0.02, 30.0))
        ],
    )
    motion.write_text(
        "inDegrees=yes\nendheader\ntime\tpro_sup_r\n0\t0\n0.02\t30\n",
        encoding="utf-8",
    )

    result = validate_inverse_kinematics(
        orientations,
        motion,
        frame_name="forearm_r_imu",
        coordinate_name="pro_sup_r",
        quaternion_axis="x",
    )

    assert result["passed"] is True
    assert result["sampleCount"] == 2
    assert result["maximumAbsoluteCoordinateErrorDegrees"] == pytest.approx(0)
