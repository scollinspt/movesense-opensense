"""Side-aware shank frames and gravity compensation for bilateral gait IMUs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
from numpy.typing import NDArray


STANDARD_GRAVITY_M_S2 = 9.80665
Role = Literal["left_distal_shank", "right_distal_shank"]
FirstMovement = Literal["extension", "flexion"]
FloatArray = NDArray[np.float64]


@dataclass(frozen=True)
class ShankFrameCalibration:
    """A proper rotation from one sensor frame into a functional shank frame.

    Shank coordinates are right-handed: +x anterior, +y flexion-positive
    rotation axis, and +z proximal. The functional calibration resolves the
    mirrored raw sensor axes independently for each limb.
    """

    role: Role
    sensor_to_shank: FloatArray
    gyroscope_bias_deg_s: FloatArray
    proximal_axis_sensor: FloatArray
    flexion_axis_sensor: FloatArray
    anterior_axis_sensor: FloatArray
    gravity_magnitude_m_s2: float
    static_acceleration_rms_m_s2: float
    functional_axis_explained_variance: float
    functional_motion_rms_deg_s: float
    sign_convention: str
    proximal_axis_source: str


@dataclass(frozen=True)
class GravityCompensationResult:
    """Orientation and gravity-compensated acceleration derived from one IMU."""

    time_seconds: FloatArray
    orientation_wxyz: FloatArray
    corrected_angular_velocity_shank_deg_s: FloatArray
    gravity_shank_m_s2: FloatArray
    linear_acceleration_shank_m_s2: FloatArray
    linear_acceleration_earth_m_s2: FloatArray
    accelerometer_ignored_fraction: float
    convention: str
    heading_observable: bool


def _vectors(name: str, values: FloatArray, *, minimum_rows: int) -> FloatArray:
    array = np.asarray(values, dtype=float)
    if array.ndim != 2 or array.shape[1] != 3 or len(array) < minimum_rows:
        raise ValueError(f"{name} must contain at least {minimum_rows} finite 3D samples.")
    if not np.all(np.isfinite(array)):
        raise ValueError(f"{name} contains non-finite values.")
    return array


def _unit(name: str, vector: FloatArray) -> FloatArray:
    norm = float(np.linalg.norm(vector))
    if not np.isfinite(norm) or norm <= 1e-9:
        raise ValueError(f"{name} does not define a usable direction.")
    return vector / norm


def calibrate_shank_frame(
    role: Role,
    static_acceleration_m_s2: FloatArray,
    static_angular_velocity_deg_s: FloatArray,
    knee_angular_velocity_deg_s: FloatArray,
    *,
    first_movement: FirstMovement = "extension",
    minimum_axis_explained_variance: float = 0.7,
    minimum_motion_rms_deg_s: float = 10.0,
) -> ShankFrameCalibration:
    """Estimate a side-specific sensor-to-shank rotation.

    The static interval estimates proximal direction under the protocol's
    near-vertical-shank assumption and estimates gyroscope bias. The
    knee interval estimates the functional sagittal rotation axis using a
    through-origin principal axis. Its sign is resolved from the first
    substantial excursion in the protocol-defined movement direction.
    """

    if role not in ("left_distal_shank", "right_distal_shank"):
        raise ValueError("role must identify the left or right distal shank.")
    if first_movement not in ("extension", "flexion"):
        raise ValueError("first_movement must be extension or flexion.")
    if not 0.5 <= minimum_axis_explained_variance <= 1:
        raise ValueError("minimum_axis_explained_variance must be between 0.5 and 1.")
    if minimum_motion_rms_deg_s <= 0:
        raise ValueError("minimum_motion_rms_deg_s must be positive.")

    static_acceleration = _vectors(
        "static_acceleration_m_s2",
        static_acceleration_m_s2,
        minimum_rows=20,
    )
    static_gyroscope = _vectors(
        "static_angular_velocity_deg_s",
        static_angular_velocity_deg_s,
        minimum_rows=20,
    )
    knee_gyroscope = _vectors(
        "knee_angular_velocity_deg_s",
        knee_angular_velocity_deg_s,
        minimum_rows=20,
    )

    mean_static_acceleration = np.mean(static_acceleration, axis=0)
    gravity_magnitude = float(np.linalg.norm(mean_static_acceleration))
    if not 0.7 * STANDARD_GRAVITY_M_S2 <= gravity_magnitude <= 1.3 * STANDARD_GRAVITY_M_S2:
        raise ValueError(
            "The static acceleration magnitude is inconsistent with a stationary 1 g reference."
        )
    proximal = _unit("static proximal axis", mean_static_acceleration)
    gyroscope_bias = np.mean(static_gyroscope, axis=0)

    corrected_motion = knee_gyroscope - gyroscope_bias
    corrected_motion -= np.outer(corrected_motion @ proximal, proximal)
    covariance = corrected_motion.T @ corrected_motion
    eigenvalues, eigenvectors = np.linalg.eigh(covariance)
    total_variance = float(np.sum(eigenvalues))
    if total_variance <= 1e-9:
        raise ValueError("The knee calibration contains no usable rotational motion.")
    unsigned_axis = _unit("functional sagittal axis", eigenvectors[:, -1])
    explained_variance = float(eigenvalues[-1] / total_variance)
    projections = corrected_motion @ unsigned_axis
    motion_rms = float(np.sqrt(np.mean(np.square(projections))))
    if explained_variance < minimum_axis_explained_variance:
        raise ValueError(
            "The knee calibration does not contain a sufficiently dominant rotation axis."
        )
    if motion_rms < minimum_motion_rms_deg_s:
        raise ValueError("The knee calibration rotational speed is too small.")

    threshold = max(5.0, 0.15 * float(np.max(np.abs(projections))))
    substantial = np.flatnonzero(np.abs(projections) >= threshold)
    if not len(substantial):
        raise ValueError("The knee calibration has no excursion suitable for sign resolution.")
    first_excursion_axis = unsigned_axis
    if projections[substantial[0]] < 0:
        first_excursion_axis = -first_excursion_axis

    flexion = (
        -first_excursion_axis
        if first_movement == "extension"
        else first_excursion_axis
    )
    flexion = _unit(
        "flexion axis",
        flexion - float(np.dot(flexion, proximal)) * proximal,
    )
    anterior = _unit("anterior axis", np.cross(flexion, proximal))
    flexion = _unit("orthogonalized flexion axis", np.cross(proximal, anterior))
    sensor_to_shank = np.vstack((anterior, flexion, proximal))
    determinant = float(np.linalg.det(sensor_to_shank))
    if not np.isclose(determinant, 1.0, atol=1e-6):
        raise ValueError("The calibrated shank frame is not a proper right-handed rotation.")

    static_residual = static_acceleration - mean_static_acceleration
    static_acceleration_rms = float(
        np.sqrt(np.mean(np.sum(np.square(static_residual), axis=1)))
    )
    return ShankFrameCalibration(
        role=role,
        sensor_to_shank=sensor_to_shank,
        gyroscope_bias_deg_s=gyroscope_bias,
        proximal_axis_sensor=proximal,
        flexion_axis_sensor=flexion,
        anterior_axis_sensor=anterior,
        gravity_magnitude_m_s2=gravity_magnitude,
        static_acceleration_rms_m_s2=static_acceleration_rms,
        functional_axis_explained_variance=explained_variance,
        functional_motion_rms_deg_s=motion_rms,
        sign_convention=f"first_{first_movement}_excursion",
        proximal_axis_source="static_specific_force_assuming_near_vertical_shank",
    )


def apply_shank_transform(
    vectors_sensor: FloatArray,
    calibration: ShankFrameCalibration,
) -> FloatArray:
    """Rotate row-vector samples from sensor axes to functional shank axes."""

    vectors = _vectors("vectors_sensor", vectors_sensor, minimum_rows=1)
    return vectors @ calibration.sensor_to_shank.T


def estimate_orientation_and_linear_acceleration(
    time_seconds: FloatArray,
    acceleration_sensor_m_s2: FloatArray,
    angular_velocity_sensor_deg_s: FloatArray,
    calibration: ShankFrameCalibration,
    *,
    gain: float = 0.5,
    acceleration_rejection_degrees: float = 10.0,
    recovery_trigger_period_seconds: float = 5.0,
) -> GravityCompensationResult:
    """Estimate tilt and remove gravity using gyroscope–accelerometer fusion.

    Magnetometer data are deliberately excluded because this protocol does not
    yet include magnetic calibration. Consequently, heading is unobservable.
    Linear acceleration in the shank frame is the primary output; Earth-frame
    acceleration is retained for engineering review but has drifting heading.
    """

    try:
        import imufusion
    except ImportError as error:
        raise RuntimeError(
            "The imufusion package is required for orientation and gravity compensation."
        ) from error

    times = np.asarray(time_seconds, dtype=float)
    if times.ndim != 1 or len(times) < 2 or not np.all(np.isfinite(times)):
        raise ValueError("time_seconds must contain at least two finite samples.")
    periods = np.diff(times)
    if np.any(periods <= 0):
        raise ValueError("time_seconds must be strictly increasing.")
    acceleration_sensor = _vectors(
        "acceleration_sensor_m_s2",
        acceleration_sensor_m_s2,
        minimum_rows=2,
    )
    gyroscope_sensor = _vectors(
        "angular_velocity_sensor_deg_s",
        angular_velocity_sensor_deg_s,
        minimum_rows=2,
    )
    if len(acceleration_sensor) != len(times) or len(gyroscope_sensor) != len(times):
        raise ValueError("Time, acceleration, and angular velocity lengths must match.")
    if gain <= 0:
        raise ValueError("gain must be positive.")
    if acceleration_rejection_degrees <= 0:
        raise ValueError("acceleration_rejection_degrees must be positive.")
    if recovery_trigger_period_seconds <= 0:
        raise ValueError("recovery_trigger_period_seconds must be positive.")

    acceleration_shank = apply_shank_transform(acceleration_sensor, calibration)
    corrected_gyroscope_sensor = (
        gyroscope_sensor - calibration.gyroscope_bias_deg_s
    )
    corrected_gyroscope_shank = apply_shank_transform(
        corrected_gyroscope_sensor,
        calibration,
    )
    sample_rate = 1.0 / float(np.median(periods))
    ahrs = imufusion.Ahrs()
    ahrs.set_settings(
        imufusion.AhrsSettings(
            sample_rate,
            imufusion.CONVENTION_NWU,
            gain,
            2000.0,
            acceleration_rejection_degrees,
            10.0,
            recovery_trigger_period_seconds,
        )
    )

    quaternions = []
    gravity = []
    linear_shank = []
    linear_earth = []
    accelerometer_ignored = 0
    for index, (gyroscope, acceleration) in enumerate(
        zip(corrected_gyroscope_shank, acceleration_shank)
    ):
        if index:
            ahrs.set_sample_period(float(periods[index - 1]))
        ahrs.update_no_magnetometer(
            gyroscope,
            acceleration / STANDARD_GRAVITY_M_S2,
        )
        quaternions.append(np.asarray(ahrs.get_quaternion(), dtype=float))
        gravity.append(
            np.asarray(ahrs.get_gravity(), dtype=float) * STANDARD_GRAVITY_M_S2
        )
        linear_shank.append(
            np.asarray(ahrs.get_linear_acceleration(), dtype=float)
            * STANDARD_GRAVITY_M_S2
        )
        linear_earth.append(
            np.asarray(ahrs.get_earth_acceleration(), dtype=float)
            * STANDARD_GRAVITY_M_S2
        )
        accelerometer_ignored += int(
            ahrs.get_internal_states().accelerometer_ignored
        )

    quaternion_array = np.asarray(quaternions)
    quaternion_norm_error = np.max(
        np.abs(np.linalg.norm(quaternion_array, axis=1) - 1)
    )
    if quaternion_norm_error > 1e-6:
        raise RuntimeError("Orientation fusion returned non-unit quaternions.")
    return GravityCompensationResult(
        time_seconds=times,
        orientation_wxyz=quaternion_array,
        corrected_angular_velocity_shank_deg_s=corrected_gyroscope_shank,
        gravity_shank_m_s2=np.asarray(gravity),
        linear_acceleration_shank_m_s2=np.asarray(linear_shank),
        linear_acceleration_earth_m_s2=np.asarray(linear_earth),
        accelerometer_ignored_fraction=accelerometer_ignored / len(times),
        convention="NWU; +x anterior, +y flexion axis, +z proximal",
        heading_observable=False,
    )
