import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(APP_DIRECTORY, "../../..");

function mapBridgeSample(sample) {
  return {
    sensorTimestampMs: Number(sample.sensor_timestamp_ms),
    hostMonotonicNs: sample.host_monotonic_ns,
    hostTimeNs: sample.host_time_ns,
    accelerationX: Number(sample.acceleration_x),
    accelerationY: Number(sample.acceleration_y),
    accelerationZ: Number(sample.acceleration_z),
    angularVelocityX: Number(sample.angular_velocity_x),
    angularVelocityY: Number(sample.angular_velocity_y),
    angularVelocityZ: Number(sample.angular_velocity_z),
    magneticFieldX: Number(sample.magnetic_field_x),
    magneticFieldY: Number(sample.magnetic_field_y),
    magneticFieldZ: Number(sample.magnetic_field_z),
    packetSequence: sample.packet_sequence ?? null,
    sampleIndex: sample.sample_index ?? null,
  };
}

export class SyntheticImuSource extends EventEmitter {
  constructor({ role, phaseOffset = 0, rateHz = 52 }) {
    super();
    this.role = role;
    this.phaseOffset = phaseOffset;
    this.rateHz = rateHz;
    this.timer = null;
    this.startedAtMs = null;
    this.index = 0;
    this.info = {
      mode: "synthetic",
      name: role === "left_distal_shank"
        ? "Simulated left shank"
        : "Simulated right shank",
      address: `synthetic-${role}`,
      hardwareId: `SIM-${role === "left_distal_shank" ? "LEFT" : "RIGHT"}`,
      imuRateHz: rateHz,
      firmware: "synthetic-v1",
    };
  }

  start() {
    if (this.timer) throw new Error("Synthetic source is already running.");
    this.startedAtMs = performance.now();
    this.emit("status", { state: "connected", sensor: this.info });
    this.timer = setInterval(() => this.#tick(), 20);
    this.#tick();
    return this.info;
  }

  #tick() {
    const elapsedMs = performance.now() - this.startedAtMs;
    const target = Math.floor(elapsedMs * this.rateHz / 1000);
    while (this.index <= target) {
      const sensorTimestampMs = this.index * 1000 / this.rateHz;
      const timeSeconds = sensorTimestampMs / 1000;
      const gaitPhase = 2 * Math.PI * 0.9 * timeSeconds + this.phaseOffset;
      const quiet = timeSeconds < 3;
      const sagittalVelocity = quiet ? 0 : 115 * Math.sin(gaitPhase);
      const foreAft = quiet ? 0 : 2.1 * Math.sin(gaitPhase);
      const vertical = 9.80665 + (quiet ? 0 : 1.3 * Math.sin(2 * gaitPhase));
      this.emit("sample", {
        sensorTimestampMs,
        hostMonotonicNs: process.hrtime.bigint().toString(),
        hostTimeNs: (BigInt(Date.now()) * 1_000_000n).toString(),
        accelerationX: 0.08 * Math.sin(timeSeconds),
        accelerationY: foreAft,
        accelerationZ: vertical,
        angularVelocityX: sagittalVelocity,
        angularVelocityY: quiet ? 0 : 8 * Math.sin(gaitPhase * 0.5),
        angularVelocityZ: quiet ? 0 : 5 * Math.cos(gaitPhase),
        magneticFieldX: 18,
        magneticFieldY: -7,
        magneticFieldZ: 42,
        packetSequence: Math.floor(this.index / 4),
        sampleIndex: this.index,
      });
      this.index += 1;
    }
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.emit("status", { state: "disconnected" });
  }
}

export class MovesenseImuSource extends EventEmitter {
  constructor({ role, address, rateHz = 52, pythonExecutable = null }) {
    super();
    this.role = role;
    this.address = address;
    this.rateHz = rateHz;
    this.pythonExecutable =
      pythonExecutable ?? path.join(REPOSITORY_ROOT, ".venv", "bin", "python");
    this.child = null;
    this.stderr = "";
    this.info = {
      mode: "hardware",
      name: "Movesense",
      address,
      hardwareId: address,
      imuRateHz: rateHz,
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
        "stream",
        "--address",
        this.address,
        "--sample-rate",
        String(this.rateHz),
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
          if (event.event === "sample") {
            this.emit("sample", mapBridgeSample(event.sample));
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
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
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
        reject(new Error(stderr.trim() || "Movesense scan failed."));
        return;
      }
      try {
        const events = stdout
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        resolve(events.find((event) => event.event === "scan-complete")?.sensors ?? []);
      } catch (error) {
        reject(new Error(`Invalid scan output: ${error.message}`));
      }
    });
  });
}

