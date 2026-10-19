import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { CanvasError } from "@github/copilot-sdk/extension";

import { RecordingSession } from "./recording.mjs";

function pythonCommand(workspaceRoot) {
  const configured = process.env.PYTHON?.trim();
  if (configured) return configured;
  const virtualEnvironmentPython = process.platform === "win32"
    ? path.join(workspaceRoot, ".venv", "Scripts", "python.exe")
    : path.join(workspaceRoot, ".venv", "bin", "python");
  return existsSync(virtualEnvironmentPython) ? virtualEnvironmentPython : "python3";
}

export class AcquisitionManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.streamProcess = null;
    this.listeners = new Set();
    this.lastEvent = { event: "idle" };
    this.recording = null;
    this.streamInfo = null;
  }

  broadcast(value) {
    this.lastEvent = value;
    const payload = `data: ${JSON.stringify(value)}\n\n`;
    for (const response of this.listeners) {
      response.write(payload);
    }
  }

  addListener(response) {
    this.listeners.add(response);
    response.write(`data: ${JSON.stringify(this.lastEvent)}\n\n`);
    return () => this.listeners.delete(response);
  }

  spawnBridge(bridgeArguments) {
    const sourceRoot = path.join(this.workspaceRoot, "src");
    const pythonPath = process.env.PYTHONPATH
      ? `${sourceRoot}${path.delimiter}${process.env.PYTHONPATH}`
      : sourceRoot;
    return spawn(
      pythonCommand(this.workspaceRoot),
      ["-m", "movesense_opensense.acquisition.live", ...bridgeArguments],
      {
        cwd: this.workspaceRoot,
        env: { ...process.env, PYTHONPATH: pythonPath, PYTHONUNBUFFERED: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  }

  attachOutput(child, onEvent) {
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      try {
        onEvent(JSON.parse(line));
      } catch {
        onEvent({ event: "error", message: "The acquisition bridge returned invalid data." });
      }
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    return () => stderr.trim();
  }

  async scan() {
    if (this.streamProcess) {
      throw new CanvasError("STREAM_ACTIVE", "Disconnect before scanning for another sensor.");
    }
    const child = this.spawnBridge(["scan", "--timeout", "5"]);
    const events = [];
    const getStderr = this.attachOutput(child, (event) => {
      events.push(event);
      this.broadcast(event);
    });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, 12000);
    const exitCode = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    }).catch((error) => {
      throw new CanvasError(
        "PYTHON_START_FAILED",
        `Could not start ${pythonCommand(this.workspaceRoot)}: ${error.message}`,
      );
    }).finally(() => {
      clearTimeout(timeout);
    });
    if (timedOut) {
      throw new CanvasError(
        "SCAN_TIMEOUT",
        "Bluetooth scan timed out. Wake the sensor, enable Bluetooth, and allow VS Code or Python under System Settings > Privacy & Security > Bluetooth.",
      );
    }
    const result = events.findLast((event) => event.event === "scan-complete");
    if (exitCode !== 0 || !result) {
      const detail = events.findLast((event) => event.event === "error")?.message || getStderr();
      throw new CanvasError("SCAN_FAILED", detail || "Movesense scan failed.");
    }
    return result;
  }

  start(address, sampleRateHz, sensorName = "") {
    if (this.streamProcess) {
      throw new CanvasError("STREAM_ACTIVE", "A Movesense stream is already active.");
    }
    const child = this.spawnBridge([
      "stream",
      "--address",
      address,
      "--sample-rate",
      String(sampleRateHz),
    ]);
    this.streamProcess = child;
    this.streamInfo = { address, sampleRateHz, sensorName };
    const getStderr = this.attachOutput(child, (event) => {
      if (event.event === "sample" && this.recording) {
        try {
          this.recording.append(event.sample);
        } catch (error) {
          this.broadcast({ event: "recording-error", message: error.message });
        }
      }
      this.broadcast(event);
    });
    child.once("error", (error) => {
      this.broadcast({ event: "error", message: error.message });
      this.streamProcess = null;
    });
    child.once("exit", (code) => {
      if (this.recording) {
        const recording = this.recording;
        this.recording = null;
        recording.stop("interrupted")
          .then((result) => this.broadcast({ event: "recording-stopped", ...result }))
          .catch((error) => this.broadcast({ event: "recording-error", message: error.message }));
      }
      if (code && this.lastEvent.event !== "error") {
        this.broadcast({
          event: "error",
          message: getStderr() || `Acquisition bridge exited with status ${code}.`,
        });
      }
      this.streamProcess = null;
      this.streamInfo = null;
    });
    return { status: "starting" };
  }

  async stop() {
    const child = this.streamProcess;
    if (!child) {
      return { status: "idle" };
    }
    if (this.recording) {
      await this.stopRecording();
    }
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
    this.streamProcess = null;
    this.broadcast({ event: "idle" });
    return { status: "stopped" };
  }

  async startRecording(input) {
    if (!this.streamProcess || !this.streamInfo) {
      throw new CanvasError("STREAM_INACTIVE", "Connect to a sensor before recording.");
    }
    if (this.recording) {
      throw new CanvasError("RECORDING_ACTIVE", "A recording is already active.");
    }
    try {
      this.recording = await RecordingSession.create({
        dataRoot: input.dataRoot,
        sensorAddress: this.streamInfo.address,
        sensorName: this.streamInfo.sensorName,
        sampleRateHz: this.streamInfo.sampleRateHz,
        movement: input.movement,
        placement: input.placement,
        orientation: input.orientation,
        orientationNotes: input.orientationNotes,
        anatomicalStartConfirmed: input.anatomicalStartConfirmed,
        proximalControlConfirmed: input.proximalControlConfirmed,
      });
      const result = { status: "recording", recordingId: this.recording.id };
      this.broadcast({ event: "recording-started", ...result });
      return result;
    } catch (error) {
      throw new CanvasError("RECORDING_START_FAILED", error.message);
    }
  }

  async stopRecording() {
    if (!this.recording) {
      return { status: "idle" };
    }
    const recording = this.recording;
    this.recording = null;
    try {
      const result = await recording.stop("complete");
      this.broadcast({ event: "recording-stopped", ...result });
      return result;
    } catch (error) {
      throw new CanvasError("RECORDING_STOP_FAILED", error.message);
    }
  }

  markRecordingEvent(input) {
    if (!this.recording) {
      throw new CanvasError("RECORDING_INACTIVE", "Start a recording before marking a phase.");
    }
    try {
      const marker = this.recording.markEvent(input?.label);
      this.broadcast({ event: "recording-marker", marker });
      return marker;
    } catch (error) {
      throw new CanvasError("RECORDING_MARKER_FAILED", error.message);
    }
  }
}
