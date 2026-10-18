from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence


@dataclass(frozen=True)
class ImuRow:
    sensor_timestamp_ms: int
    angular_velocity_deg_s: tuple[float, float, float]


@dataclass(frozen=True)
class OrientationSample:
    time_seconds: float
    angle_degrees: float
    quaternion_wxyz: tuple[float, float, float, float]


@dataclass(frozen=True)
class OneDofEstimate:
    dominant_axis: str
    axis_energy_fraction: float
    gyroscope_bias_deg_s: tuple[float, float, float]
    initial_sensor_sign: int
    sign_multiplier: int
    samples: tuple[OrientationSample, ...]


def _mean(values: Sequence[float]) -> float:
    if not values:
        raise ValueError("Cannot calculate a mean from an empty sequence.")
    return sum(values) / len(values)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_imu_rows(csv_path: Path) -> list[ImuRow]:
    rows: list[ImuRow] = []
    with csv_path.open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        required = {
            "sensor_timestamp_ms",
            "angular_velocity_x_deg_s",
            "angular_velocity_y_deg_s",
            "angular_velocity_z_deg_s",
        }
        if not required.issubset(reader.fieldnames or []):
            missing = sorted(required.difference(reader.fieldnames or []))
            raise ValueError(f"IMU CSV is missing required columns: {', '.join(missing)}")
        for line_number, row in enumerate(reader, start=2):
            try:
                rows.append(
                    ImuRow(
                        sensor_timestamp_ms=int(row["sensor_timestamp_ms"]),
                        angular_velocity_deg_s=(
                            float(row["angular_velocity_x_deg_s"]),
                            float(row["angular_velocity_y_deg_s"]),
                            float(row["angular_velocity_z_deg_s"]),
                        ),
                    )
                )
            except (TypeError, ValueError) as error:
                raise ValueError(f"Invalid IMU value on CSV line {line_number}.") from error
    if len(rows) < 2:
        raise ValueError("At least two IMU rows are required.")
    return rows


def angle_to_quaternion(
    angle_degrees: float,
    axis: str,
) -> tuple[float, float, float, float]:
    if axis not in {"x", "y", "z"}:
        raise ValueError("Quaternion axis must be x, y, or z.")
    half_angle = math.radians(angle_degrees) / 2
    vector = {
        "x": (math.sin(half_angle), 0.0, 0.0),
        "y": (0.0, math.sin(half_angle), 0.0),
        "z": (0.0, 0.0, math.sin(half_angle)),
    }[axis]
    quaternion = (math.cos(half_angle), *vector)
    norm = math.sqrt(sum(component * component for component in quaternion))
    return tuple(component / norm for component in quaternion)  # type: ignore[return-value]


def angle_to_quaternion_x(angle_degrees: float) -> tuple[float, float, float, float]:
    return angle_to_quaternion(angle_degrees, "x")


def estimate_one_dof_orientation(
    rows: Sequence[ImuRow],
    *,
    calibration_start_seconds: float,
    calibration_end_seconds: float,
    movement_start_seconds: float,
    movement_end_seconds: float,
    first_movement: str,
    quaternion_axis: str = "x",
) -> OneDofEstimate:
    if len(rows) < 2:
        raise ValueError("At least two IMU rows are required.")
    if not 0 <= calibration_start_seconds < calibration_end_seconds:
        raise ValueError("Calibration interval must be non-empty and non-negative.")
    if not calibration_end_seconds <= movement_start_seconds < movement_end_seconds:
        raise ValueError("Movement must begin at or after calibration and have non-zero duration.")
    if first_movement not in {"pronation", "supination", "flexion", "extension"}:
        raise ValueError("First movement is not supported.")

    first_timestamp_ms = rows[0].sensor_timestamp_ms

    def elapsed_seconds(row: ImuRow) -> float:
        return (row.sensor_timestamp_ms - first_timestamp_ms) / 1000

    calibration_rows = [
        row
        for row in rows
        if calibration_start_seconds <= elapsed_seconds(row) <= calibration_end_seconds
    ]
    movement_rows = [
        row
        for row in rows
        if movement_start_seconds <= elapsed_seconds(row) <= movement_end_seconds
    ]
    if len(calibration_rows) < 2:
        raise ValueError("Calibration interval contains fewer than two samples.")
    if len(movement_rows) < 2:
        raise ValueError("Movement interval contains fewer than two samples.")

    biases = tuple(
        _mean([row.angular_velocity_deg_s[axis] for row in calibration_rows])
        for axis in range(3)
    )
    rms = tuple(
        math.sqrt(
            _mean(
                [
                    (row.angular_velocity_deg_s[axis] - biases[axis]) ** 2
                    for row in movement_rows
                ]
            )
        )
        for axis in range(3)
    )
    energy = tuple(value * value for value in rms)
    dominant_axis_index = max(range(3), key=energy.__getitem__)
    dominant_axis = ("x", "y", "z")[dominant_axis_index]
    total_energy = sum(energy)
    if total_energy == 0:
        raise ValueError("Movement interval contains no angular-velocity energy.")

    calibration_axis = [
        row.angular_velocity_deg_s[dominant_axis_index] for row in calibration_rows
    ]
    calibration_axis_mean = biases[dominant_axis_index]
    calibration_axis_sd = math.sqrt(
        _mean([(value - calibration_axis_mean) ** 2 for value in calibration_axis])
    )
    excursion_threshold = max(10.0, 3 * calibration_axis_sd)
    first_excursion = next(
        (
            row.angular_velocity_deg_s[dominant_axis_index] - calibration_axis_mean
            for row in movement_rows
            if abs(row.angular_velocity_deg_s[dominant_axis_index] - calibration_axis_mean)
            >= excursion_threshold
        ),
        None,
    )
    if first_excursion is None:
        raise ValueError("Could not identify an intentional movement after calibration.")
    initial_sensor_sign = 1 if first_excursion > 0 else -1
    intended_sign = 1 if first_movement in {"pronation", "flexion"} else -1
    sign_multiplier = intended_sign * initial_sensor_sign

    angle_degrees = 0.0
    samples = [
        OrientationSample(
            time_seconds=0.0,
            angle_degrees=0.0,
            quaternion_wxyz=angle_to_quaternion(0.0, quaternion_axis),
        )
    ]
    for previous, current in zip(movement_rows, movement_rows[1:]):
        delta_seconds = (
            current.sensor_timestamp_ms - previous.sensor_timestamp_ms
        ) / 1000
        if delta_seconds <= 0:
            raise ValueError("Sensor timestamps must be strictly increasing.")
        previous_rate = (
            previous.angular_velocity_deg_s[dominant_axis_index]
            - calibration_axis_mean
        )
        current_rate = (
            current.angular_velocity_deg_s[dominant_axis_index]
            - calibration_axis_mean
        )
        sensor_angle_increment = ((previous_rate + current_rate) / 2) * delta_seconds
        angle_degrees += sensor_angle_increment * sign_multiplier
        samples.append(
            OrientationSample(
                time_seconds=(
                    current.sensor_timestamp_ms
                    - movement_rows[0].sensor_timestamp_ms
                )
                / 1000,
                angle_degrees=angle_degrees,
                quaternion_wxyz=angle_to_quaternion(
                    angle_degrees,
                    quaternion_axis,
                ),
            )
        )

    return OneDofEstimate(
        dominant_axis=dominant_axis,
        axis_energy_fraction=energy[dominant_axis_index] / total_energy,
        gyroscope_bias_deg_s=biases,
        initial_sensor_sign=initial_sensor_sign,
        sign_multiplier=sign_multiplier,
        samples=tuple(samples),
    )


def write_quaternion_sto(
    output_path: Path,
    samples: Iterable[OrientationSample],
    *,
    frame_name: str = "forearm_r_imu",
) -> None:
    materialized = tuple(samples)
    if len(materialized) < 2:
        raise ValueError("At least two orientation samples are required.")
    duration = materialized[-1].time_seconds - materialized[0].time_seconds
    data_rate = (len(materialized) - 1) / duration
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="\n") as stream:
        stream.write(f"DataRate={data_rate:.12g}\n")
        stream.write("DataType=Quaternion\n")
        stream.write("version=3\n")
        stream.write("OpenSimVersion=4.6\n")
        stream.write("endheader\n")
        stream.write(f"time\t{frame_name}\n")
        for sample in materialized:
            quaternion = ",".join(
                f"{component:.17g}" for component in sample.quaternion_wxyz
            )
            stream.write(f"{sample.time_seconds:.9f}\t{quaternion}\n")


def build_one_dof_model(
    output_path: Path,
    *,
    motion_type: str,
    side: str,
) -> None:
    try:
        import opensim
    except ImportError as error:
        raise RuntimeError(
            "OpenSim Python bindings are required to build the model."
        ) from error

    if motion_type not in {"forearm_rotation", "elbow_flexion"}:
        raise ValueError("Motion type must be forearm_rotation or elbow_flexion.")
    if side not in {"left", "right"}:
        raise ValueError("Side must be left or right.")
    is_elbow = motion_type == "elbow_flexion"
    suffix = "l" if side == "left" else "r"
    model = opensim.Model()
    model.setName(
        f"movesense_{side}_elbow_1dof"
        if is_elbow
        else f"movesense_{side}_forearm_1dof"
    )
    humerus = opensim.Body(
        f"humerus_{suffix}",
        1.5,
        opensim.Vec3(0, -0.15, 0),
        opensim.Inertia(0.01),
    )
    forearm = opensim.Body(
        f"forearm_{suffix}",
        1.0,
        opensim.Vec3(0.12, 0, 0),
        opensim.Inertia(0.005),
    )
    humerus_joint = opensim.WeldJoint(
        "humerus_to_ground",
        model.getGround(),
        opensim.Vec3(0),
        opensim.Vec3(0),
        humerus,
        opensim.Vec3(0),
        opensim.Vec3(0),
    )
    joint_orientation = opensim.Vec3(0) if is_elbow else opensim.Vec3(0, math.pi / 2, 0)
    radioulnar_joint = opensim.PinJoint(
        f"elbow_{suffix}" if is_elbow else f"radioulnar_{suffix}",
        humerus,
        opensim.Vec3(0),
        joint_orientation,
        forearm,
        opensim.Vec3(0),
        joint_orientation,
    )
    coordinate = radioulnar_joint.updCoordinate()
    coordinate.setName(
        f"elbow_flex_{suffix}" if is_elbow else f"pro_sup_{suffix}"
    )
    coordinate.setDefaultValue(0)
    coordinate.setRangeMin(math.radians(-10 if is_elbow else -30))
    coordinate.setRangeMax(math.radians(160 if is_elbow else 180))

    humerus_geometry = opensim.Brick(opensim.Vec3(0.035, 0.16, 0.035))
    humerus_geometry.setColor(opensim.Vec3(0.35, 0.55, 0.85))
    humerus.attachGeometry(humerus_geometry)
    forearm_geometry = opensim.Brick(
        opensim.Vec3(0.035, 0.17, 0.05)
        if is_elbow
        else opensim.Vec3(0.17, 0.028, 0.05)
    )
    forearm_geometry.setColor(opensim.Vec3(0.82, 0.62, 0.30))
    forearm.attachGeometry(forearm_geometry)

    model.addBody(humerus)
    model.addJoint(humerus_joint)
    model.addBody(forearm)
    model.addJoint(radioulnar_joint)
    imu_frame = opensim.PhysicalOffsetFrame(
        f"forearm_{suffix}_imu",
        forearm,
        opensim.Transform(),
    )
    forearm.addComponent(imu_frame)
    dorsal_marker_frame = opensim.PhysicalOffsetFrame(
        "dorsal_visual_marker_frame",
        forearm,
        opensim.Transform(
            opensim.Vec3(0, -0.12, 0.06)
            if is_elbow
            else opensim.Vec3(0.12, 0.055, 0)
        ),
    )
    dorsal_marker = opensim.Sphere(0.018)
    dorsal_marker.setColor(opensim.Vec3(0.9, 0.15, 0.12))
    dorsal_marker_frame.attachGeometry(dorsal_marker)
    forearm.addComponent(dorsal_marker_frame)
    model.finalizeConnections()
    model.initSystem()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    model.printToXML(str(output_path))


def run_inverse_kinematics(
    model_path: Path,
    orientations_path: Path,
    output_motion_path: Path,
    *,
    start_time_seconds: float,
    end_time_seconds: float,
) -> None:
    try:
        import opensim
    except ImportError as error:
        raise RuntimeError(
            "OpenSim Python bindings are required to run inverse kinematics."
        ) from error

    model = opensim.Model(str(model_path))
    tool = opensim.IMUInverseKinematicsTool()
    tool.set_model_file(str(model_path))
    tool.set_orientations_file(str(orientations_path))
    tool.set_sensor_to_opensim_rotations(opensim.Vec3(0))
    tool.set_results_directory(str(output_motion_path.parent))
    tool.set_output_motion_file(output_motion_path.name)
    tool.set_time_range(0, start_time_seconds)
    tool.set_time_range(1, end_time_seconds)
    tool.runInverseKinematicsWithOrientationsFromFile(
        model,
        str(orientations_path),
        False,
    )


def validate_inverse_kinematics(
    orientations_path: Path,
    motion_path: Path,
    *,
    frame_name: str,
    coordinate_name: str,
    quaternion_axis: str,
) -> dict[str, float | int | bool]:
    def table_rows(path: Path) -> list[dict[str, str]]:
        lines = path.read_text(encoding="utf-8").splitlines()
        try:
            header_end = lines.index("endheader")
        except ValueError as error:
            raise ValueError(f"{path.name} has no endheader marker.") from error
        return list(csv.DictReader(lines[header_end + 1 :], delimiter="\t"))

    orientation_rows = table_rows(orientations_path)
    motion_rows = table_rows(motion_path)
    if len(orientation_rows) != len(motion_rows):
        raise ValueError(
            "OpenSense output row count does not match the quaternion input."
        )
    differences: list[float] = []
    quaternion_axis_index = {"x": 1, "y": 2, "z": 3}[quaternion_axis]
    for orientation, motion in zip(orientation_rows, motion_rows):
        quaternion = tuple(
            float(value) for value in orientation[frame_name].split(",")
        )
        source_angle = math.degrees(
            2 * math.atan2(quaternion[quaternion_axis_index], quaternion[0])
        )
        differences.append(float(motion[coordinate_name]) - source_angle)
    maximum_error = max(abs(value) for value in differences)
    rms_error = math.sqrt(_mean([value * value for value in differences]))
    return {
        "passed": maximum_error <= 0.05,
        "sampleCount": len(motion_rows),
        "startTimeSeconds": float(motion_rows[0]["time"]),
        "endTimeSeconds": float(motion_rows[-1]["time"]),
        "maximumAbsoluteCoordinateErrorDegrees": maximum_error,
        "rmsCoordinateErrorDegrees": rms_error,
        "toleranceDegrees": 0.05,
    }


def _write_processing_manifest(
    output_path: Path,
    *,
    source_manifest: Path,
    source_data: Path,
    estimate: OneDofEstimate,
    orientations_path: Path,
    model_path: Path,
    motion_path: Path,
    intervals: dict[str, float],
    validation: dict[str, float | int | bool],
    motion_type: str,
    quaternion_axis: str,
    coordinate_name: str,
    side: str,
) -> None:
    payload: dict[str, Any] = {
        "format": "movesense-opensense-one-dof-processing",
        "version": 1,
        "source": {
            "manifest": str(source_manifest),
            "data": str(source_data),
            "dataSha256": _sha256(source_data),
        },
        "intervals": intervals,
        "estimator": {
            "type": "bias-corrected-one-axis-gyroscope-integration",
            "dominantAxis": estimate.dominant_axis,
            "axisEnergyFraction": estimate.axis_energy_fraction,
            "gyroscopeBiasDegS": estimate.gyroscope_bias_deg_s,
            "initialSensorSign": estimate.initial_sensor_sign,
            "signMultiplier": estimate.sign_multiplier,
            "anatomicalPositiveDirection":
                "flexion" if motion_type == "elbow_flexion" else "pronation",
            "driftCorrection": "none",
            "motionType": motion_type,
            "modelQuaternionAxis": quaternion_axis,
            "coordinateName": coordinate_name,
            "side": side,
        },
        "outputs": {
            "orientationsSto": {
                "path": str(orientations_path),
                "sha256": _sha256(orientations_path),
            },
            "model": {
                "path": str(model_path),
                "sha256": _sha256(model_path),
            },
            "inverseKinematicsMotion": {
                "path": str(motion_path),
                "sha256": _sha256(motion_path),
            },
        },
        "validation": validation,
    }
    output_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def process_recording(args: argparse.Namespace) -> None:
    manifest_path = args.manifest.resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("format") != "movesense-opensense-raw-recording":
        raise ValueError("Input manifest is not a Movesense raw-recording manifest.")
    data_path = Path(manifest["dataFile"]["path"]).resolve()
    if _sha256(data_path) != manifest["dataFile"]["sha256"]:
        raise ValueError("Input CSV checksum does not match the raw-recording manifest.")

    placement = manifest.get("protocol", {}).get("placement")
    side = "left" if placement == "left_wrist" else "right" if placement == "right_wrist" else None
    if side is None:
        raise ValueError("Recording placement must identify the left or right wrist.")
    suffix = "l" if side == "left" else "r"
    estimate = estimate_one_dof_orientation(
        load_imu_rows(data_path),
        calibration_start_seconds=args.calibration_start,
        calibration_end_seconds=args.calibration_end,
        movement_start_seconds=args.movement_start,
        movement_end_seconds=args.movement_end,
        first_movement=args.first_movement,
        quaternion_axis="z" if args.motion_type == "elbow_flexion" else "x",
    )
    output_directory = args.output_directory.resolve()
    output_directory.mkdir(parents=True, exist_ok=True)
    is_elbow = args.motion_type == "elbow_flexion"
    orientations_path = output_directory / (
        "elbow_orientations.sto" if is_elbow else "forearm_orientations.sto"
    )
    model_path = output_directory / (
        f"{side}_elbow_1dof.osim" if is_elbow else f"{side}_forearm_1dof.osim"
    )
    motion_path = output_directory / (
        "elbow_ik.mot" if is_elbow else "forearm_ik.mot"
    )
    quaternion_axis = "z" if is_elbow else "x"
    coordinate_name = f"elbow_flex_{suffix}" if is_elbow else f"pro_sup_{suffix}"
    frame_name = f"forearm_{suffix}_imu"
    write_quaternion_sto(
        orientations_path,
        estimate.samples,
        frame_name=frame_name,
    )
    build_one_dof_model(
        model_path,
        motion_type=args.motion_type,
        side=side,
    )
    run_inverse_kinematics(
        model_path,
        orientations_path,
        motion_path,
        start_time_seconds=estimate.samples[0].time_seconds,
        end_time_seconds=estimate.samples[-1].time_seconds,
    )
    validation = validate_inverse_kinematics(
        orientations_path,
        motion_path,
        frame_name=frame_name,
        coordinate_name=coordinate_name,
        quaternion_axis=quaternion_axis,
    )
    if not validation["passed"]:
        raise RuntimeError(
            "OpenSense inverse kinematics did not reproduce the source one-DOF angle."
        )
    _write_processing_manifest(
        output_directory / "processing-manifest.json",
        source_manifest=manifest_path,
        source_data=data_path,
        estimate=estimate,
        orientations_path=orientations_path,
        model_path=model_path,
        motion_path=motion_path,
        intervals={
            "calibrationStartSeconds": args.calibration_start,
            "calibrationEndSeconds": args.calibration_end,
            "movementStartSeconds": args.movement_start,
            "movementEndSeconds": args.movement_end,
        },
        validation=validation,
        motion_type=args.motion_type,
        quaternion_axis=quaternion_axis,
        coordinate_name=coordinate_name,
        side=side,
    )


def parser() -> argparse.ArgumentParser:
    argument_parser = argparse.ArgumentParser(
        description="Create a constrained one-DOF OpenSense trial from governed IMU data."
    )
    argument_parser.add_argument("--manifest", type=Path, required=True)
    argument_parser.add_argument("--output-directory", type=Path, required=True)
    argument_parser.add_argument("--calibration-start", type=float, required=True)
    argument_parser.add_argument("--calibration-end", type=float, required=True)
    argument_parser.add_argument("--movement-start", type=float, required=True)
    argument_parser.add_argument("--movement-end", type=float, required=True)
    argument_parser.add_argument(
        "--first-movement",
        choices=("pronation", "supination", "flexion", "extension"),
        required=True,
    )
    argument_parser.add_argument(
        "--motion-type",
        choices=("forearm_rotation", "elbow_flexion"),
        required=True,
    )
    return argument_parser


def main() -> None:
    process_recording(parser().parse_args())


if __name__ == "__main__":
    main()
