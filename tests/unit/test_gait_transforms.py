from __future__ import annotations

import numpy as np

from movesense_opensense.gait.transforms import (
    STANDARD_GRAVITY_M_S2,
    apply_shank_transform,
    calibrate_shank_frame,
    estimate_orientation_and_linear_acceleration,
)


def _calibration_inputs(
    sensor_to_shank: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    gravity_shank = np.tile([0.0, 0.0, STANDARD_GRAVITY_M_S2], (100, 1))
    bias_shank = np.array([0.4, -0.3, 0.2])
    static_gyroscope_shank = np.tile(bias_shank, (100, 1))
    excursion = np.concatenate(
        (
            -60 * np.sin(np.linspace(0, np.pi, 60)),
            55 * np.sin(np.linspace(0, np.pi, 60)),
        )
    )
    knee_gyroscope_shank = np.column_stack(
        (
            np.zeros_like(excursion),
            excursion,
            np.zeros_like(excursion),
        )
    ) + bias_shank
    return (
        gravity_shank @ sensor_to_shank,
        static_gyroscope_shank @ sensor_to_shank,
        knee_gyroscope_shank @ sensor_to_shank,
    )


def test_functional_calibration_resolves_mirrored_sensor_axes() -> None:
    left_true = np.eye(3)
    right_true = np.diag([-1.0, -1.0, 1.0])
    left = calibrate_shank_frame(
        "left_distal_shank",
        *_calibration_inputs(left_true),
    )
    right = calibrate_shank_frame(
        "right_distal_shank",
        *_calibration_inputs(right_true),
    )
    shank_vectors = np.array([[2.0, -30.0, 1.0], [-1.0, 20.0, 0.5]])
    left_sensor = shank_vectors @ left_true
    right_sensor = shank_vectors @ right_true

    assert np.allclose(apply_shank_transform(left_sensor, left), shank_vectors)
    assert np.allclose(apply_shank_transform(right_sensor, right), shank_vectors)
    assert np.isclose(np.linalg.det(left.sensor_to_shank), 1.0)
    assert np.isclose(np.linalg.det(right.sensor_to_shank), 1.0)
    assert left.functional_axis_explained_variance > 0.99
    assert right.functional_axis_explained_variance > 0.99


def test_gravity_compensation_removes_stationary_one_g() -> None:
    calibration = calibrate_shank_frame(
        "left_distal_shank",
        *_calibration_inputs(np.eye(3)),
    )
    time_seconds = np.arange(0, 4, 0.02)
    acceleration = np.tile([0.0, 0.0, STANDARD_GRAVITY_M_S2], (len(time_seconds), 1))
    acceleration[150, 0] += 3.0
    gyroscope = np.tile(calibration.gyroscope_bias_deg_s, (len(time_seconds), 1))

    result = estimate_orientation_and_linear_acceleration(
        time_seconds,
        acceleration,
        gyroscope,
        calibration,
    )

    stationary = np.delete(result.linear_acceleration_shank_m_s2[100:], 50, axis=0)
    assert np.max(np.linalg.norm(stationary, axis=1)) < 0.05
    assert result.linear_acceleration_shank_m_s2[150, 0] > 2.5
    assert np.allclose(np.linalg.norm(result.orientation_wxyz, axis=1), 1.0)
    assert result.heading_observable is False
