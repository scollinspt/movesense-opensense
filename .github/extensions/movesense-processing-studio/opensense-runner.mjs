import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
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
  };
}

export async function runOpenSensePipeline(workspaceRoot, state) {
  const { pythonExecutable, sdkPythonPath } = state.opensimRuntime;
  if (!pythonExecutable || !sdkPythonPath) {
    throw new CanvasError(
      "OPENSIM_NOT_CONFIGURED",
      "Configure the private OpenSim Python runtime before running the pipeline.",
    );
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
  const paths = recordingPaths(state);
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
