from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

import numpy as np


STANDARD_GRAVITY = 9.80665
FRAME_NAME = "radius_l_imu"
COORDINATES = ("elbow_flex_l", "pro_sup_l")
SENSOR_TO_OPENSIM_ROTATIONS = (-math.pi / 2, 0.0, 0.0)


@dataclass(frozen=True)
class Imu9Row:
    sensor_timestamp_ms: int
    acceleration_m_s2: tuple[float, float, float]
    angular_velocity_deg_s: tuple[float, float, float]
    magnetic_field_u_t: tuple[float, float, float]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _normalize_quaternion(quaternion: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(quaternion)
    if not np.isfinite(norm) or norm == 0:
        raise ValueError("Quaternion must have a finite non-zero norm.")
    return quaternion / norm


def quaternion_conjugate(quaternion: np.ndarray) -> np.ndarray:
    result = np.array(quaternion, dtype=float, copy=True)
    result[1:] *= -1
    return result


def quaternion_multiply(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    lw, lx, ly, lz = left
    rw, rx, ry, rz = right
    return _normalize_quaternion(
        np.array(
            [
                lw * rw - lx * rx - ly * ry - lz * rz,
                lw * rx + lx * rw + ly * rz - lz * ry,
                lw * ry - lx * rz + ly * rw + lz * rx,
                lw * rz + lx * ry - ly * rx + lz * rw,
            ]
        )
    )


def quaternion_average(quaternions: np.ndarray) -> np.ndarray:
    if len(quaternions) == 0:
        raise ValueError("Cannot average an empty quaternion sequence.")
    reference = quaternions[0]
    aligned = np.array(
        [quaternion if np.dot(quaternion, reference) >= 0 else -quaternion for quaternion in quaternions]
    )
    return _normalize_quaternion(np.mean(aligned, axis=0))


def quaternion_slerp(
    start: np.ndarray,
    end: np.ndarray,
    fraction: float,
) -> np.ndarray:
    fraction = max(0.0, min(1.0, fraction))
    dot = float(np.dot(start, end))
    adjusted_end = np.array(end, copy=True)
    if dot < 0:
        adjusted_end *= -1
        dot *= -1
    if dot > 0.9995:
        return _normalize_quaternion(start + fraction * (adjusted_end - start))
    angle = math.acos(max(-1.0, min(1.0, dot)))
    scale = math.sin(angle)
    return _normalize_quaternion(
        (math.sin((1 - fraction) * angle) / scale) * start
        + (math.sin(fraction * angle) / scale) * adjusted_end
    )


def quaternion_angle_degrees(left: np.ndarray, right: np.ndarray) -> float:
    difference = quaternion_multiply(left, quaternion_conjugate(right))
    return math.degrees(2 * math.acos(min(1.0, abs(float(difference[0])))))


def load_imu9_rows(csv_path: Path) -> list[Imu9Row]:
    rows: list[Imu9Row] = []
    with csv_path.open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        required = {
            "sensor_timestamp_ms",
            *(f"acceleration_{axis}_m_s2" for axis in "xyz"),
            *(f"angular_velocity_{axis}_deg_s" for axis in "xyz"),
            *(f"magnetic_field_{axis}_uT" for axis in "xyz"),
        }
        if not required.issubset(reader.fieldnames or []):
            missing = sorted(required.difference(reader.fieldnames or []))
            raise ValueError(f"IMU CSV is missing required columns: {', '.join(missing)}")
        for line_number, row in enumerate(reader, start=2):
            try:
                rows.append(
                    Imu9Row(
                        sensor_timestamp_ms=int(row["sensor_timestamp_ms"]),
                        acceleration_m_s2=tuple(
                            float(row[f"acceleration_{axis}_m_s2"]) for axis in "xyz"
                        ),
                        angular_velocity_deg_s=tuple(
                            float(row[f"angular_velocity_{axis}_deg_s"]) for axis in "xyz"
                        ),
                        magnetic_field_u_t=tuple(
                            float(row[f"magnetic_field_{axis}_uT"]) for axis in "xyz"
                        ),
                    )
                )
            except (TypeError, ValueError) as error:
                raise ValueError(f"Invalid IMU value on CSV line {line_number}.") from error
    if len(rows) < 2:
        raise ValueError("At least two IMU rows are required.")
    if any(
        current.sensor_timestamp_ms <= previous.sensor_timestamp_ms
        for previous, current in zip(rows, rows[1:])
    ):
        raise ValueError("Sensor timestamps must be strictly increasing.")
    return rows


def write_quaternion_sto(
    path: Path,
    times_seconds: np.ndarray,
    quaternions: np.ndarray,
    *,
    frame_name: str = FRAME_NAME,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sample_rate = (len(times_seconds) - 1) / (times_seconds[-1] - times_seconds[0])
    with path.open("w", encoding="utf-8", newline="\n") as stream:
        stream.write(f"DataRate={sample_rate:.12g}\n")
        stream.write("DataType=Quaternion\n")
        stream.write("version=3\n")
        stream.write("OpenSimVersion=4.6\n")
        stream.write("endheader\n")
        stream.write(f"time\t{frame_name}\n")
        for time_seconds, quaternion in zip(times_seconds, quaternions):
            values = ",".join(f"{value:.17g}" for value in quaternion)
            stream.write(f"{time_seconds:.9f}\t{values}\n")


def run_fusion(args: argparse.Namespace) -> None:
    try:
        import imufusion
    except ImportError as error:
        raise RuntimeError("The imufusion package is required for orientation fusion.") from error

    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    data_path = Path(manifest["dataFile"]["path"]).resolve()
    rows = load_imu9_rows(data_path)
    times = np.array(
        [
            (row.sensor_timestamp_ms - rows[0].sensor_timestamp_ms) / 1000
            for row in rows
        ]
    )
    calibration_mask = (times >= args.calibration_start) & (times <= args.calibration_end)
    final_mask = (times >= args.final_neutral_start) & (times <= args.final_neutral_end)
    if np.count_nonzero(calibration_mask) < 20 or np.count_nonzero(final_mask) < 20:
        raise ValueError("Initial and final neutral intervals must each contain at least 20 samples.")

    accelerometer = np.array([row.acceleration_m_s2 for row in rows])
    gyroscope = np.array([row.angular_velocity_deg_s for row in rows])
    magnetometer = np.array([row.magnetic_field_u_t for row in rows])
    gyroscope_bias = np.mean(gyroscope[calibration_mask], axis=0)
    corrected_gyroscope = gyroscope - gyroscope_bias
    magnetic_magnitude = np.linalg.norm(magnetometer, axis=1)
    calibration_magnetic_mean = float(np.mean(magnetic_magnitude[calibration_mask]))
    magnetic_usable = 20 <= calibration_magnetic_mean <= 100

    sample_rate = (len(times) - 1) / (times[-1] - times[0])
    ahrs = imufusion.Ahrs()
    ahrs.set_settings(
        imufusion.AhrsSettings(
            sample_rate,
            imufusion.CONVENTION_NWU,
            0.5,
            2000.0,
            10.0,
            10.0,
            5.0,
        )
    )
    quaternions: list[np.ndarray] = []
    accelerometer_ignored = 0
    for index, (gyro, accel) in enumerate(zip(corrected_gyroscope, accelerometer)):
        if index > 0:
            ahrs.set_sample_period(float(times[index] - times[index - 1]))
        ahrs.update_no_magnetometer(gyro, accel / STANDARD_GRAVITY)
        quaternions.append(_normalize_quaternion(np.array(ahrs.get_quaternion())))
        accelerometer_ignored += int(ahrs.get_internal_states().accelerometer_ignored)
    quaternion_array = np.array(quaternions)

    initial_neutral = quaternion_average(quaternion_array[calibration_mask])
    final_neutral_before = quaternion_average(quaternion_array[final_mask])
    drift_error = quaternion_multiply(
        initial_neutral,
        quaternion_conjugate(final_neutral_before),
    )
    correction_start = float(np.mean(times[calibration_mask]))
    correction_end = float(np.mean(times[final_mask]))
    identity = np.array([1.0, 0.0, 0.0, 0.0])
    corrected = []
    for time_seconds, quaternion in zip(times, quaternion_array):
        fraction = (time_seconds - correction_start) / (correction_end - correction_start)
        correction = quaternion_slerp(identity, drift_error, fraction)
        corrected.append(quaternion_multiply(correction, quaternion))
    corrected_array = np.array(corrected)
    initial_neutral_corrected = quaternion_average(corrected_array[calibration_mask])
    final_neutral_corrected = quaternion_average(corrected_array[final_mask])

    output_directory = Path(args.output_directory).resolve()
    output_directory.mkdir(parents=True, exist_ok=True)
    orientations_path = output_directory / "radius_l_orientations.sto"
    calibration_path = output_directory / "radius_l_calibration.sto"
    write_quaternion_sto(orientations_path, times, corrected_array)
    write_quaternion_sto(
        calibration_path,
        np.array([0.0, 0.02]),
        np.array([initial_neutral_corrected, initial_neutral_corrected]),
    )
    diagnostics = {
        "format": "movesense-opensense-two-dof-fusion",
        "version": 1,
        "sourceManifest": str(manifest_path),
        "sourceData": str(data_path),
        "sourceDataSha256": _sha256(data_path),
        "sampleCount": len(rows),
        "startTimeSeconds": float(times[0]),
        "endTimeSeconds": float(times[-1]),
        "effectiveRateHz": sample_rate,
        "calibrationInterval": [args.calibration_start, args.calibration_end],
        "finalNeutralInterval": [args.final_neutral_start, args.final_neutral_end],
        "gyroscopeBiasDegS": gyroscope_bias.tolist(),
        "fusion": {
            "algorithm": "x-io Fusion AHRS",
            "package": "imufusion",
            "mode": "gyroscope plus accelerometer",
            "convention": "NWU",
            "gain": 0.5,
            "accelerationRejectionDegrees": 10.0,
            "magnetometerUsed": False,
            "magnetometerUsableByMagnitude": magnetic_usable,
            "calibrationMagneticMagnitudeMicrotesla": calibration_magnetic_mean,
            "magnetometerExclusionReason":
                "Neutral magnitude is outside the 20-100 microtesla Earth-field range."
                if not magnetic_usable
                else "Magnetometer calibration was not collected for this session.",
            "accelerometerIgnoredFraction": accelerometer_ignored / len(rows),
            "nativeQuaternionConvention": "imufusion wxyz output, not conjugated",
            "quaternionNormMaximumError": float(
                np.max(np.abs(np.linalg.norm(corrected_array, axis=1) - 1))
            ),
        },
        "driftCorrection": {
            "type": "endpoint neutral quaternion closure",
            "initialToFinalErrorBeforeDegrees": quaternion_angle_degrees(
                final_neutral_before,
                initial_neutral,
            ),
            "initialToFinalErrorAfterDegrees": quaternion_angle_degrees(
                final_neutral_corrected,
                initial_neutral_corrected,
            ),
        },
        "outputs": {
            "orientationsSto": str(orientations_path),
            "calibrationSto": str(calibration_path),
        },
    }
    diagnostics_path = output_directory / "fusion-diagnostics.json"
    diagnostics_path.write_text(
        f"{json.dumps(diagnostics, indent=2)}\n",
        encoding="utf-8",
    )
    print(json.dumps(diagnostics))


def _table_rows(path: Path) -> list[dict[str, str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    try:
        header_end = lines.index("endheader")
    except ValueError as error:
        raise ValueError(f"{path.name} has no endheader marker.") from error
    return list(csv.DictReader(lines[header_end + 1 :], delimiter="\t"))


def _phase_diagnostics(
    motion_path: Path,
    manifest: dict[str, Any],
    *,
    combined_start: float,
) -> list[dict[str, Any]]:
    rows = _table_rows(motion_path)
    events = manifest.get("events", [])
    first_sensor_ms = manifest["acquisition"]["firstSensorTimestampMs"]
    phases = [
        {
            "label": event["label"],
            "start": (event["nearestSensorTimestampMs"] - first_sensor_ms) / 1000,
        }
        for event in events
    ]
    for phase in phases:
        if phase["label"] == "combined_elbow_forearm":
            phase["start"] = combined_start
    phases.sort(key=lambda phase: phase["start"])
    diagnostics = []
    for index, phase in enumerate(phases):
        end = phases[index + 1]["start"] if index + 1 < len(phases) else float(rows[-1]["time"])
        selected = [
            row for row in rows if phase["start"] <= float(row["time"]) < end
        ]
        if not selected:
            continue
        coordinate_ranges = {}
        for coordinate in COORDINATES:
            values = [float(row[coordinate]) for row in selected]
            coordinate_ranges[coordinate] = {
                "minimumDegrees": min(values),
                "maximumDegrees": max(values),
                "rangeDegrees": max(values) - min(values),
            }
        diagnostics.append(
            {
                "label": phase["label"],
                "startTimeSeconds": phase["start"],
                "endTimeSeconds": end,
                "sampleCount": len(selected),
                "coordinates": coordinate_ranges,
            }
        )
    return diagnostics


def _point(frame: Any, state: Any, location: Any) -> list[float]:
    point = frame.findStationLocationInGround(state, location)
    return [point.get(index) for index in range(3)]


def _write_simulation(
    path: Path,
    model: Any,
    motion_rows: Sequence[dict[str, str]],
    orientation_errors_degrees: Sequence[float],
    opensim: Any,
) -> None:
    state = model.initSystem()
    coordinate_set = model.updCoordinateSet()
    humerus = model.getBodySet().get("humerus_l")
    ulna = model.getBodySet().get("ulna_l")
    hand = model.getBodySet().get("hand_l")
    imu_frame = opensim.PhysicalFrame.safeDownCast(
        model.getComponent("/bodyset/radius_l/radius_l_imu")
    )
    frame_count = min(700, len(motion_rows))
    indices = sorted(
        {
            round(index * (len(motion_rows) - 1) / (frame_count - 1))
            for index in range(frame_count)
        }
    )
    frames = []
    for index in indices:
        row = motion_rows[index]
        for coordinate_name in COORDINATES:
            coordinate_set.get(coordinate_name).setValue(
                state,
                math.radians(float(row[coordinate_name])),
                False,
            )
        model.realizePosition(state)
        imu_origin = _point(imu_frame, state, opensim.Vec3(0))
        axis_length = 0.08
        frames.append(
            {
                "timeSeconds": float(row["time"]),
                "elbowFlexionDegrees": float(row["elbow_flex_l"]),
                "pronationSupinationDegrees": float(row["pro_sup_l"]),
                "orientationErrorDegrees": orientation_errors_degrees[index],
                "points": {
                    "shoulder": _point(humerus, state, opensim.Vec3(0)),
                    "elbow": _point(ulna, state, opensim.Vec3(0)),
                    "wrist": _point(hand, state, opensim.Vec3(0)),
                    "imu": imu_origin,
                    "imuX": _point(
                        imu_frame,
                        state,
                        opensim.Vec3(axis_length, 0, 0),
                    ),
                    "imuY": _point(
                        imu_frame,
                        state,
                        opensim.Vec3(0, axis_length, 0),
                    ),
                    "imuZ": _point(
                        imu_frame,
                        state,
                        opensim.Vec3(0, 0, axis_length),
                    ),
                },
            }
        )
    payload = {
        "format": "movesense-opensense-two-dof-simulation",
        "version": 1,
        "model": "Rajagopal2015_left_arm_two_dof.osim",
        "description": (
            "Downsampled Rajagopal body and calibrated IMU-frame positions "
            "driven by the OpenSense inverse-kinematics motion."
        ),
        "frames": frames,
    }
    path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def run_opensim(args: argparse.Namespace) -> None:
    try:
        import opensim
    except ImportError as error:
        raise RuntimeError("OpenSim Python bindings are required.") from error

    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    source_model = Path(args.model).resolve()
    output_directory = Path(args.output_directory).resolve()
    orientations_path = output_directory / "radius_l_orientations.sto"
    calibration_path = output_directory / "radius_l_calibration.sto"
    calibration_model_path = output_directory / "Rajagopal2015_locked_calibration.osim"
    model_path = output_directory / "Rajagopal2015_left_arm_two_dof.osim"
    motion_path = output_directory / "left_arm_two_dof_ik.mot"
    orientation_errors_path = output_directory / "left_arm_two_dof_ik.mot_orientationErrors.sto"
    simulation_path = output_directory / "left_arm_two_dof_simulation.json"

    calibration_model = opensim.Model(str(source_model))
    coordinates = calibration_model.updCoordinateSet()
    for index in range(coordinates.getSize()):
        coordinates.get(index).setDefaultLocked(True)
    for coordinate_name in (
        "arm_flex_l",
        "arm_add_l",
        "arm_rot_l",
        "elbow_flex_l",
        "pro_sup_l",
        "wrist_flex_l",
        "wrist_dev_l",
    ):
        coordinates.get(coordinate_name).setDefaultValue(0)
    calibration_model.finalizeConnections()
    calibration_model.initSystem()
    calibration_model.printToXML(str(calibration_model_path))

    placer = opensim.IMUPlacer()
    placer.set_model_file(str(calibration_model_path))
    placer.set_orientation_file_for_calibration(str(calibration_path))
    placer.set_sensor_to_opensim_rotations(
        opensim.Vec3(*SENSOR_TO_OPENSIM_ROTATIONS)
    )
    placer.set_output_model_file(str(model_path))
    placer.run(False)
    model = placer.getCalibratedModel()
    for coordinate_name in COORDINATES:
        coordinate = model.updCoordinateSet().get(coordinate_name)
        coordinate.setDefaultLocked(False)
        coordinate.setDefaultClamped(True)
    model.finalizeConnections()
    model.initSystem()
    model.printToXML(str(model_path))

    orientation_rows = _table_rows(orientations_path)
    tool = opensim.IMUInverseKinematicsTool()
    tool.set_model_file(str(model_path))
    tool.set_orientations_file(str(orientations_path))
    tool.set_sensor_to_opensim_rotations(
        opensim.Vec3(*SENSOR_TO_OPENSIM_ROTATIONS)
    )
    tool.set_results_directory(str(output_directory))
    tool.set_output_motion_file(motion_path.name)
    tool.set_time_range(0, args.calibration_start)
    tool.set_time_range(1, args.final_neutral_end)
    tool.runInverseKinematicsWithOrientationsFromFile(
        model,
        str(orientations_path),
        False,
    )

    motion_rows = _table_rows(motion_path)
    expected_orientation_rows = [
        row
        for row in orientation_rows
        if args.calibration_start <= float(row["time"]) <= args.final_neutral_end
    ]
    if len(motion_rows) != len(expected_orientation_rows):
        raise RuntimeError(
            "OpenSense IK output does not match the selected orientation sample count."
        )
    locked_coordinate_ranges = {}
    for coordinate_name in motion_rows[0]:
        if coordinate_name == "time" or coordinate_name in COORDINATES:
            continue
        values = [float(row[coordinate_name]) for row in motion_rows]
        locked_coordinate_ranges[coordinate_name] = max(values) - min(values)
    moving_locked_coordinates = {
        name: value
        for name, value in locked_coordinate_ranges.items()
        if value > 1e-3
    }
    if moving_locked_coordinates:
        raise RuntimeError(
            "Coordinates outside the two-DOF model changed during IK: "
            + ", ".join(sorted(moving_locked_coordinates))
        )
    orientation_error_rows = _table_rows(orientation_errors_path)
    orientation_errors_radians = [
        float(row[FRAME_NAME]) for row in orientation_error_rows
    ]
    if len(orientation_errors_radians) != len(motion_rows):
        raise RuntimeError("OpenSense orientation errors do not match the IK sample count.")
    orientation_errors_degrees = [
        math.degrees(value) for value in orientation_errors_radians
    ]
    maximum_orientation_error = max(orientation_errors_degrees)
    rms_orientation_error = math.sqrt(
        sum(value * value for value in orientation_errors_degrees)
        / len(orientation_errors_degrees)
    )
    orientation_error_tolerance = 15.0
    _write_simulation(
        simulation_path,
        model,
        motion_rows,
        orientation_errors_degrees,
        opensim,
    )
    coordinate_bounds = {
        "elbow_flex_l": (0.0, 150.0),
        "pro_sup_l": (0.0, 90.0),
    }
    coordinate_limit_fractions = {}
    for coordinate_name, (minimum, maximum) in coordinate_bounds.items():
        values = [float(row[coordinate_name]) for row in motion_rows]
        coordinate_limit_fractions[coordinate_name] = {
            "minimumDegrees": minimum,
            "maximumDegrees": maximum,
            "nearMinimumFraction": sum(value <= minimum + 0.1 for value in values)
            / len(values),
            "nearMaximumFraction": sum(value >= maximum - 0.1 for value in values)
            / len(values),
        }
    phase_diagnostics = _phase_diagnostics(
        motion_path,
        manifest,
        combined_start=args.combined_start,
    )
    fusion_diagnostics_path = output_directory / "fusion-diagnostics.json"
    fusion_diagnostics = json.loads(
        fusion_diagnostics_path.read_text(encoding="utf-8")
    )
    processing_manifest = {
        "format": "movesense-opensense-two-dof-processing",
        "version": 1,
        "source": {
            "manifest": str(manifest_path),
            "data": manifest["dataFile"]["path"],
            "dataSha256": manifest["dataFile"]["sha256"],
            "model": str(source_model),
        },
        "estimator": {
            "type": "full-orientation-six-axis-ahrs",
            "side": "left",
            "frameName": FRAME_NAME,
            "coordinates": list(COORDINATES),
            "sensorToOpenSimRotationsRadians": list(SENSOR_TO_OPENSIM_ROTATIONS),
            "magnetometerUsed": False,
            "driftCorrection": "endpoint neutral quaternion closure",
        },
        "intervals": {
            "calibrationStartSeconds": args.calibration_start,
            "calibrationEndSeconds": args.calibration_end,
            "combinedStartSeconds": args.combined_start,
            "finalNeutralStartSeconds": args.final_neutral_start,
            "finalNeutralEndSeconds": args.final_neutral_end,
        },
        "outputs": {
            "orientationsSto": {
                "path": str(orientations_path),
                "sha256": _sha256(orientations_path),
            },
            "calibrationSto": {
                "path": str(calibration_path),
                "sha256": _sha256(calibration_path),
            },
            "model": {
                "path": str(model_path),
                "sha256": _sha256(model_path),
            },
            "lockedCalibrationModel": {
                "path": str(calibration_model_path),
                "sha256": _sha256(calibration_model_path),
            },
            "inverseKinematicsMotion": {
                "path": str(motion_path),
                "sha256": _sha256(motion_path),
            },
            "fusionDiagnostics": {
                "path": str(fusion_diagnostics_path),
                "sha256": _sha256(fusion_diagnostics_path),
            },
            "orientationErrors": {
                "path": str(orientation_errors_path),
                "sha256": _sha256(orientation_errors_path),
            },
            "simulation": {
                "path": str(simulation_path),
                "sha256": _sha256(simulation_path),
            },
        },
        "validation": {
            "passed": maximum_orientation_error <= orientation_error_tolerance,
            "sampleCount": len(motion_rows),
            "startTimeSeconds": float(motion_rows[0]["time"]),
            "endTimeSeconds": float(motion_rows[-1]["time"]),
            "quaternionNormMaximumError":
                fusion_diagnostics["fusion"]["quaternionNormMaximumError"],
            "neutralClosureErrorDegrees":
                fusion_diagnostics["driftCorrection"][
                    "initialToFinalErrorAfterDegrees"
                ],
            "lockedCoordinateMaximumRangeDegrees": max(
                locked_coordinate_ranges.values(),
                default=0.0,
            ),
            "maximumOrientationErrorDegrees": maximum_orientation_error,
            "rmsOrientationErrorDegrees": rms_orientation_error,
            "orientationErrorToleranceDegrees": orientation_error_tolerance,
            "coordinateLimitFractions": coordinate_limit_fractions,
            "phaseDiagnostics": phase_diagnostics,
            "limitations": [
                "No independent optical or encoded joint-angle reference was recorded.",
                "Magnetometer was excluded because this session lacks usable magnetic calibration.",
                "Endpoint neutral closure is an offline protocol constraint.",
            ],
        },
    }
    processing_path = output_directory / "processing-manifest.json"
    processing_path.write_text(
        f"{json.dumps(processing_manifest, indent=2)}\n",
        encoding="utf-8",
    )
    print(json.dumps(processing_manifest))


def parser() -> argparse.ArgumentParser:
    argument_parser = argparse.ArgumentParser()
    subparsers = argument_parser.add_subparsers(dest="command", required=True)
    for name in ("fuse", "opensim"):
        subparser = subparsers.add_parser(name)
        subparser.add_argument("--manifest", required=True)
        subparser.add_argument("--output-directory", required=True)
        subparser.add_argument("--calibration-start", type=float, required=True)
        subparser.add_argument("--calibration-end", type=float, required=True)
        subparser.add_argument("--final-neutral-start", type=float, required=True)
        subparser.add_argument("--final-neutral-end", type=float, required=True)
        subparser.add_argument("--combined-start", type=float, required=True)
    opensim_parser = subparsers.choices["opensim"]
    opensim_parser.add_argument("--model", required=True)
    return argument_parser


def main() -> None:
    arguments = parser().parse_args()
    if arguments.command == "fuse":
        run_fusion(arguments)
    else:
        run_opensim(arguments)


if __name__ == "__main__":
    main()
