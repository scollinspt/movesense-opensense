import { execFile } from "node:child_process";
import { access, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { CanvasError } from "@github/copilot-sdk/extension";

const execFileAsync = promisify(execFile);

function recordingPaths(state) {
  const date = state.recordingId.slice(0, 8);
  if (!/^\d{8}$/.test(date)) {
    throw new CanvasError("INVALID_RECORDING_ID", "Recording ID must begin with YYYYMMDD.");
  }
  const dateFolder = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  return {
    manifest: path.join(
      state.governedRoot,
      "manifests",
      dateFolder,
      `${state.recordingId}.json`,
    ),
    outputDirectory: path.join(
      state.governedRoot,
      "derived",
      dateFolder,
      state.recordingId,
      "opensense-one-dof",
    ),
    twoDofOutputDirectory: path.join(
      state.governedRoot,
      "derived",
      dateFolder,
      state.recordingId,
      "opensense-two-dof",
    ),
  };
}

async function runTwoDofPipeline(workspaceRoot, state, paths, manifest) {
  const { pythonExecutable, sdkPythonPath, modelPath } = state.opensimRuntime;
  if (!modelPath) {
    throw new CanvasError(
      "OPENSIM_MODEL_NOT_CONFIGURED",
      "Configure the Rajagopal OpenSense model path before running two-DOF processing.",
    );
  }
  const fusionPython = path.join(
    workspaceRoot,
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  try {
    await Promise.all([
      access(fusionPython),
      access(pythonExecutable),
      access(sdkPythonPath),
      access(modelPath),
    ]);
  } catch (error) {
    throw new CanvasError(
      "TWO_DOF_RUNTIME_NOT_FOUND",
      `The fusion or OpenSim runtime is unavailable: ${error.message}`,
    );
  }
  const firstSensorMs = manifest.acquisition.firstSensorTimestampMs;
  const eventTime = (label) => {
    const event = manifest.events?.find((candidate) => candidate.label === label);
    if (!event) {
      throw new CanvasError(
        "PHASE_MARKER_NOT_FOUND",
        `The recording has no ${label} phase marker.`,
      );
    }
    return (event.nearestSensorTimestampMs - firstSensorMs) / 1000;
  };
  const combinedCorrection = state.annotations.find(
    (annotation) => annotation.label === "phase correction: combined_elbow_forearm",
  );
  const combinedStart = combinedCorrection?.startSeconds
    ?? eventTime("combined_elbow_forearm");
  const finalNeutralStart = eventTime("return_to_neutral");
  const finalNeutralEnd =
    (manifest.acquisition.lastSensorTimestampMs - firstSensorMs) / 1000;
  const commonArgs = [
    "--manifest", paths.manifest,
    "--output-directory", paths.twoDofOutputDirectory,
    "--calibration-start", String(state.calibration.startSeconds),
    "--calibration-end", String(state.calibration.endSeconds),
    "--combined-start", String(combinedStart),
    "--final-neutral-start", String(finalNeutralStart),
    "--final-neutral-end", String(finalNeutralEnd),
  ];
  await unlink(
    path.join(paths.twoDofOutputDirectory, "processing-manifest.json"),
  ).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  try {
    await execFileAsync(
      fusionPython,
      ["-m", "movesense_opensense.opensense.two_dof", "fuse", ...commonArgs],
      {
        cwd: workspaceRoot,
        env: {
          ...process.env,
          PYTHONPATH: [path.join(workspaceRoot, "src"), process.env.PYTHONPATH]
            .filter(Boolean)
            .join(path.delimiter),
        },
        maxBuffer: 16 * 1024 * 1024,
        timeout: 5 * 60 * 1000,
      },
    );
    const { stdout, stderr } = await execFileAsync(
      pythonExecutable,
      [
        "-m", "movesense_opensense.opensense.two_dof", "opensim",
        ...commonArgs,
        "--model", modelPath,
      ],
      {
        cwd: workspaceRoot,
        env: {
          ...process.env,
          PYTHONPATH: [
            path.join(workspaceRoot, "src"),
            sdkPythonPath,
            process.env.PYTHONPATH,
          ].filter(Boolean).join(path.delimiter),
        },
        maxBuffer: 16 * 1024 * 1024,
        timeout: 10 * 60 * 1000,
      },
    );
    return {
      outputDirectory: paths.twoDofOutputDirectory,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error) {
    const detail = error.stderr?.trim() || error.stdout?.trim() || error.message;
    throw new CanvasError(
      "TWO_DOF_OPENSENSE_RUN_FAILED",
      `Two-DOF OpenSense processing failed: ${detail}`,
    );
  }
}

export async function runOpenSensePipeline(workspaceRoot, state) {
  const { pythonExecutable, sdkPythonPath } = state.opensimRuntime;
  if (!pythonExecutable || !sdkPythonPath) {
    throw new CanvasError(
      "OPENSIM_NOT_CONFIGURED",
      "Configure the private OpenSim Python runtime before running the pipeline.",
    );
  }
  const paths = recordingPaths(state);
  const manifest = JSON.parse(await readFile(paths.manifest, "utf8"));
  if (manifest.protocol?.movement === "combined_elbow_forearm") {
    return runTwoDofPipeline(workspaceRoot, state, paths, manifest);
  }
  if (state.oneDofMapping.firstMovement === "unassigned") {
    throw new CanvasError(
      "MAPPING_NOT_CONFIGURED",
      "Assign the first movement direction before running OpenSense.",
    );
  }
  const movement = state.annotations[0];
  if (!movement) {
    throw new CanvasError(
      "MOVEMENT_NOT_ANNOTATED",
      "Add a movement interval before running OpenSense.",
    );
  }
  try {
    await Promise.all([access(pythonExecutable), access(sdkPythonPath)]);
  } catch (error) {
    throw new CanvasError(
      "OPENSIM_RUNTIME_NOT_FOUND",
      `The configured OpenSim runtime is unavailable: ${error.message}`,
    );
  }
  const args = [
    "-m",
    "movesense_opensense.opensense.one_dof",
    "--manifest",
    paths.manifest,
    "--output-directory",
    paths.outputDirectory,
    "--calibration-start",
    String(state.calibration.startSeconds),
    "--calibration-end",
    String(state.calibration.endSeconds),
    "--movement-start",
    String(movement.startSeconds),
    "--movement-end",
    String(movement.endSeconds),
    "--first-movement",
    state.oneDofMapping.firstMovement,
    "--motion-type",
    state.oneDofMapping.positiveDirection === "flexion"
      ? "elbow_flexion"
      : "forearm_rotation",
  ];
  const pythonPath = [
    path.join(workspaceRoot, "src"),
    sdkPythonPath,
    process.env.PYTHONPATH,
  ].filter(Boolean).join(path.delimiter);
  try {
    const { stdout, stderr } = await execFileAsync(pythonExecutable, args, {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PYTHONPATH: pythonPath,
      },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 5 * 60 * 1000,
    });
    return {
      outputDirectory: paths.outputDirectory,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error) {
    const detail = error.stderr?.trim() || error.stdout?.trim() || error.message;
    throw new CanvasError("OPENSENSE_RUN_FAILED", `OpenSense processing failed: ${detail}`);
  }
}
