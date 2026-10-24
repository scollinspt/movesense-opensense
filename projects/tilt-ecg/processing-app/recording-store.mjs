import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  analyzeRecording,
  defaultReviewSettings,
  loadRecordingData,
} from "./analysis.mjs";

const REVIEW_SCHEMA_VERSION = "tilt-ecg-review-v3";
const CLINIC_APPROVAL_FIELDS = [
  "studentName",
  "reviewerName",
  "reviewerCredentials",
  "supervisingClinicianName",
  "supervisingClinicianCredentials",
  "approvalDate",
];

async function sha256(filePath) {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
}

async function atomicJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

function resolveManifestFile(dataRoot, manifestPath, relativePath) {
  if (typeof relativePath !== "string" || !relativePath) {
    throw new Error(`Manifest ${manifestPath} has an invalid artifact path.`);
  }
  const resolved = path.resolve(path.dirname(manifestPath), relativePath);
  const relativeToRoot = path.relative(dataRoot, resolved);
  if (
    relativeToRoot === ".."
    || relativeToRoot.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativeToRoot)
  ) {
    throw new Error(`Manifest ${manifestPath} references an artifact outside the governed root.`);
  }
  return resolved;
}

export function validateClinicApproval(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Clinic report approval is required.");
  }
  const approval = {};
  for (const field of CLINIC_APPROVAL_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === "") {
      throw new Error("Complete all clinic report approval fields.");
    }
    if (typeof input[field] !== "string") {
      throw new Error("Clinic report approval fields must be text.");
    }
    approval[field] = input[field].trim();
    if (!approval[field]) {
      throw new Error("Complete all clinic report approval fields.");
    }
    if (approval[field].length > 200) {
      throw new Error("Clinic report approval fields must not exceed 200 characters.");
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(approval.approvalDate)) {
    throw new Error("Clinic report approval date must use YYYY-MM-DD.");
  }
  if (input.attestationAccepted !== true) {
    throw new Error("The licensed reviewer must accept the clinic report attestation.");
  }
  approval.attestationAccepted = true;
  return approval;
}

export class RecordingStore {
  constructor(dataRoot) {
    this.dataRoot = path.resolve(dataRoot);
    this.manifestRoot = path.join(this.dataRoot, "manifests", "tilt-ecg");
    this.index = new Map();
    this.cache = new Map();
  }

  async refresh() {
    this.index.clear();
    let dates = [];
    try {
      dates = await readdir(this.manifestRoot, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
    for (const dateEntry of dates.filter((entry) => entry.isDirectory())) {
      const dateDirectory = path.join(this.manifestRoot, dateEntry.name);
      const entries = await readdir(dateDirectory, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const manifestPath = path.join(dateDirectory, entry.name);
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        if (
          manifest.projectId !== "hms-lab-tilt-ecg"
          || typeof manifest.recordingId !== "string"
        ) continue;
        if (!["tilt-ecg-recording-v1", "tilt-ecg-recording-v2"].includes(
          manifest.schemaVersion,
        )) {
          throw new Error(
            `Recording ${manifest.recordingId} uses unsupported schema ${manifest.schemaVersion}.`,
          );
        }
        this.index.set(manifest.recordingId, {
          manifest,
          manifestPath,
          date: dateEntry.name,
        });
      }
    }
    return [...this.index.values()]
      .sort((left, right) => (
        right.manifest.startedAt.localeCompare(left.manifest.startedAt)
      ))
      .map(({ manifest, date }) => ({
        recordingId: manifest.recordingId,
        date,
        startedAt: manifest.startedAt,
        durationSeconds: manifest.durationSeconds,
        finalized: manifest.finalized,
        schemaVersion: manifest.schemaVersion,
        sampleCounts: manifest.sampleCounts,
        sensor: {
          name: manifest.sensor?.name ?? "Unknown",
          ecgRateHz: manifest.sensor?.ecgRateHz ?? null,
          imuRateHz: manifest.sensor?.imuRateHz ?? null,
        },
      }));
  }

  async #entry(recordingId) {
    if (!this.index.size) await this.refresh();
    const entry = this.index.get(recordingId);
    if (!entry) throw new Error("Recording was not found.");
    return entry;
  }

  async load(recordingId) {
    if (this.cache.has(recordingId)) return this.cache.get(recordingId);
    const entry = await this.#entry(recordingId);
    const databasePath = resolveManifestFile(
      this.dataRoot,
      entry.manifestPath,
      entry.manifest.files?.signals?.path,
    );
    const summaryPath = resolveManifestFile(
      this.dataRoot,
      entry.manifestPath,
      entry.manifest.files?.fiveSecondSummary?.path,
    );
    const [databaseStats, summaryStats] = await Promise.all([
      stat(databasePath),
      stat(summaryPath),
    ]);
    if (!databaseStats.isFile() || !summaryStats.isFile()) {
      throw new Error("A recording artifact is missing.");
    }
    const [databaseSha256, summarySha256] = await Promise.all([
      sha256(databasePath),
      sha256(summaryPath),
    ]);
    const integrity = {
      finalized: entry.manifest.finalized === true,
      databaseChecksumValid:
        databaseSha256 === entry.manifest.files.signals.sha256,
      summaryChecksumValid:
        summarySha256 === entry.manifest.files.fiveSecondSummary.sha256,
      databaseSha256,
      summarySha256,
    };
    const recording = {
      ...loadRecordingData({ databasePath, manifest: entry.manifest }),
      integrity,
      manifestPath: entry.manifestPath,
      databasePath,
      summaryPath,
      date: entry.date,
    };
    this.cache.set(recordingId, recording);
    return recording;
  }

  async describe(recordingId) {
    const recording = await this.load(recordingId);
    return {
      recordingId,
      date: recording.date,
      startedAt: recording.manifest.startedAt,
      durationSeconds: recording.durationSeconds,
      schemaVersion: recording.manifest.schemaVersion,
      sensor: recording.manifest.sensor,
      sampleCounts: {
        ecg: recording.ecgSampleCount,
        imu: recording.imuSampleCount,
      },
      integrity: recording.integrity,
      defaults: defaultReviewSettings(recording),
      events: recording.events,
    };
  }

  async analyze(recordingId, settings) {
    const recording = await this.load(recordingId);
    return {
      recording: await this.describe(recordingId),
      analysis: analyzeRecording(recording, settings),
    };
  }

  async saveReview(
    recordingId,
    settings,
    reviewerConclusion = "",
    clinicApprovalInput,
  ) {
    const recording = await this.load(recordingId);
    if (
      !recording.integrity.finalized
      || !recording.integrity.databaseChecksumValid
      || !recording.integrity.summaryChecksumValid
    ) {
      throw new Error("The recording must pass integrity verification before review approval.");
    }
    const analysis = analyzeRecording(recording, settings);
    if (analysis.calibration.source === "reviewer_confirmation_required") {
      throw new Error("Confirm the achieved table angle before approving the review.");
    }
    if (!analysis.calibration.valid || !analysis.regression.equation) {
      throw new Error("Calibration and regression must be valid before review approval.");
    }
    if (typeof reviewerConclusion !== "string" || reviewerConclusion.length > 4_000) {
      throw new Error("Reviewer conclusion must be text no longer than 4000 characters.");
    }
    const clinicApproval = validateClinicApproval(clinicApprovalInput);
    const reviewId = `${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}`;
    const review = {
      schemaVersion: REVIEW_SCHEMA_VERSION,
      reviewId,
      recordingId,
      createdAt: new Date().toISOString(),
      deidentified: true,
      rawArtifactsModified: false,
      reviewerConclusion: reviewerConclusion.trim(),
      clinicApproval: {
        ...clinicApproval,
        attestation: analysis.clinicReport.reportMethod.attestation,
      },
      sourceChecksums: {
        signalsSha256: recording.integrity.databaseSha256,
        fiveSecondSummarySha256: recording.integrity.summarySha256,
      },
      settings: analysis.settings,
      calibration: analysis.calibration,
      regression: analysis.regression,
      heartRateRegression: analysis.heartRateRegression,
      clinical: analysis.clinical,
      clinicReport: analysis.clinicReport,
      hrv: analysis.hrv,
      quality: analysis.quality,
      summary: analysis.summary,
      provenance: {
        processingApplication: "tilt-ecg-processing-v0.3.0",
        clinicReportMethod:
          analysis.clinicReport.reportMethod.reportMethodVersion,
        evidenceSet:
          analysis.clinicReport.reportMethod.evidenceSetVersion,
        detector: "pan-tompkins-streaming-v1",
        rrSource: "consecutive accepted native-timestamp R waves",
        angleAttribution: "linearly interpolated corrected angle at RR midpoint",
        regression: "ordinary least squares; ascending tilt only",
        frequencyDomain:
          "4 Hz interpolated NN tachogram; mean detrending; Hann-window Welch periodogram",
      },
    };
    const reviewPath = path.join(
      this.dataRoot,
      "derived",
      "tilt-ecg",
      recording.date,
      recordingId,
      "reviews",
      `${reviewId}.json`,
    );
    await atomicJson(reviewPath, review);
    return { review, reviewPath };
  }
}
