import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(APP_DIRECTORY, "../../..");

function gaussian(x, center, width, amplitude) {
  const normalized = (x - center) / width;
  return amplitude * Math.exp(-0.5 * normalized * normalized);
}

function syntheticEcg(timeSeconds, heartRateBpm) {
  const period = 60 / heartRateBpm;
  const phase = ((timeSeconds % period) + period) % period;
  return (
    gaussian(phase, period * 0.18, 0.025, 0.08)
    + gaussian(phase, period * 0.4, 0.008, -0.18)
    + gaussian(phase, period * 0.42, 0.012, 1.4)
    + gaussian(phase, period * 0.45, 0.012, -0.3)
    + gaussian(phase, period * 0.7, 0.05, 0.24)
    + 0.018 * Math.sin(2 * Math.PI * 0.3 * timeSeconds)
    + 0.006 * Math.sin(2 * Math.PI * 17 * timeSeconds)
  );
}

function syntheticTiltDegrees(timeSeconds) {
  if (timeSeconds < 20) return 0;
  if (timeSeconds < 32) return (timeSeconds - 20) * 70 / 12;
  if (timeSeconds < 75) return 70;
  if (timeSeconds < 87) return 70 - (timeSeconds - 75) * 70 / 12;
  return 0;
}

function mapBridgeEcg(sample) {
  return {
    sensorTimestampMs: sample.sensor_timestamp_ms,
    hostMonotonicNs: sample.host_monotonic_ns,
    hostTimeNs: sample.host_time_ns,
    rawValue: sample.raw_value,
    packetSequence: sample.packet_sequence ?? null,
    sampleIndex: sample.sample_index ?? null,
  };
}

function mapBridgeImu(sample) {
  return {
    sensorTimestampMs: sample.sensor_timestamp_ms,
    hostMonotonicNs: sample.host_monotonic_ns,
    hostTimeNs: sample.host_time_ns,
    accelerationX: sample.acceleration_x,
    accelerationY: sample.acceleration_y,
    accelerationZ: sample.acceleration_z,
    angularVelocityX: sample.angular_velocity_x,
    angularVelocityY: sample.angular_velocity_y,
    angularVelocityZ: sample.angular_velocity_z,
    magneticFieldX: sample.magnetic_field_x,
    magneticFieldY: sample.magnetic_field_y,
    magneticFieldZ: sample.magnetic_field_z,
    packetSequence: sample.packet_sequence ?? null,
    sampleIndex: sample.sample_index ?? null,
  };
}

export class SyntheticSource extends EventEmitter {
  constructor({ ecgRateHz = 250, imuRateHz = 50, heartRateBpm = 72 } = {}) {
    super();
    this.ecgRateHz = ecgRateHz;
    this.imuRateHz = imuRateHz;
    this.heartRateBpm = heartRateBpm;
    this.timer = null;
    this.startMonotonicMs = null;
    this.ecgIndex = 0;
    this.imuIndex = 0;
    this.info = {
      mode: "synthetic",
      name: "HMS deterministic simulator",
      address: "synthetic",
      ecgRateHz,
      imuRateHz,
      firmware: "synthetic-v1",
    };
  }

  start() {
    if (this.timer) throw new Error("Synthetic source is already running.");
    this.startMonotonicMs = performance.now();
    this.emit("status", { state: "connected", sensor: this.info });
    this.timer = setInterval(() => this.#tick(), 20);
    this.#tick();
    return this.info;
  }

  #tick() {
    const elapsedMs = performance.now() - this.startMonotonicMs;
    const ecgTarget = Math.floor(elapsedMs * this.ecgRateHz / 1000);
    while (this.ecgIndex <= ecgTarget) {
      const timeMs = this.ecgIndex * 1000 / this.ecgRateHz;
      const timeSeconds = timeMs / 1000;
      this.emit("ecg", {
        sensorTimestampMs: timeMs,
        rawValue: syntheticEcg(timeSeconds, this.heartRateBpm),
        packetSequence: Math.floor(this.ecgIndex / 16),
        sampleIndex: this.ecgIndex,
      });
      this.ecgIndex += 1;
    }
    const imuTarget = Math.floor(elapsedMs * this.imuRateHz / 1000);
    while (this.imuIndex <= imuTarget) {
      const timeMs = this.imuIndex * 1000 / this.imuRateHz;
      const timeSeconds = timeMs / 1000;
      const tiltRadians = syntheticTiltDegrees(timeSeconds) * Math.PI / 180;
      const transition =
        (timeSeconds >= 20 && timeSeconds < 32)
        || (timeSeconds >= 75 && timeSeconds < 87);
      this.emit("imu", {
        sensorTimestampMs: timeMs,
        accelerationX: 0.01 * Math.sin(timeSeconds),
        accelerationY: 9.80665 * Math.sin(tiltRadians),
        accelerationZ: 9.80665 * Math.cos(tiltRadians),
        angularVelocityX: transition ? 5.833 : 0,
        angularVelocityY: 0,
        angularVelocityZ: 0,
        packetSequence: Math.floor(this.imuIndex / 4),
        sampleIndex: this.imuIndex,
      });
      this.imuIndex += 1;
    }
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.emit("status", { state: "disconnected" });
  }
}

export class MovesenseBridgeSource extends EventEmitter {
  constructor({ address, pythonExecutable = null, ecgRateHz = 125, imuRateHz = 52 }) {
    super();
    this.address = address;
    this.pythonExecutable =
      pythonExecutable
      ?? path.join(REPOSITORY_ROOT, ".venv", "bin", "python");
    this.ecgRateHz = ecgRateHz;
    this.imuRateHz = imuRateHz;
    this.child = null;
    this.stderr = "";
    this.info = {
      mode: "hardware",
      name: "Movesense",
      address,
      ecgRateHz,
      imuRateHz,
      firmware: null,
    };
  }

  start() {
    if (this.child) throw new Error("Movesense source is already running.");
    this.child = spawn(
      this.pythonExecutable,
      [
        "-m",
        "movesense_opensense.acquisition.live",
        "tilt-stream",
        "--address",
        this.address,
        "--ecg-rate",
        String(this.ecgRateHz),
        "--imu-rate",
        String(this.imuRateHz),
      ],
      {
        cwd: REPOSITORY_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdoutBuffer = "";
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.event === "ecg-sample") {
            this.emit("ecg", mapBridgeEcg(event.sample));
          } else if (event.event === "imu-sample") {
            this.emit("imu", mapBridgeImu(event.sample));
          } else if (event.event === "connected") {
            this.emit("status", { state: "connected", sensor: this.info });
          } else if (event.event === "connecting") {
            this.emit("status", { state: "connecting", sensor: this.info });
          } else if (event.event === "error") {
            this.emit("error", new Error(event.message));
          }
        } catch (error) {
          this.emit("error", new Error(`Invalid bridge output: ${error.message}`));
        }
      }
    });
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => {
      this.stderr = `${this.stderr}${chunk}`.slice(-4000);
    });
    this.child.once("error", (error) => this.emit("error", error));
    this.child.once("exit", (code, signal) => {
      const expected = this.child === null;
      this.child = null;
      if (!expected && code !== 0) {
        this.emit(
          "error",
          new Error(
            `Movesense bridge exited (${signal ?? code}). ${this.stderr.trim()}`,
          ),
        );
      }
      this.emit("status", { state: "disconnected" });
    });
    return this.info;
  }

  async stop() {
    const child = this.child;
    if (!child) return;
    this.child = null;
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        resolve();
      }, 3000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}

export async function scanMovesense({ pythonExecutable = null } = {}) {
  const executable =
    pythonExecutable ?? path.join(REPOSITORY_ROOT, ".venv", "bin", "python");
  return new Promise((resolve, reject) => {
    const child = spawn(
      executable,
      ["-m", "movesense_opensense.acquisition.live", "scan"],
      { cwd: REPOSITORY_ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Movesense scan exited with code ${code}.`));
        return;
      }
      try {
        const events = stdout
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        const result = events.find((event) => event.event === "scan-complete");
        resolve(result?.sensors ?? []);
      } catch (error) {
        reject(new Error(`Could not parse the Movesense scan: ${error.message}`));
      }
    });
  });
}
