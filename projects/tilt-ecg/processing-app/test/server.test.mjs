import assert from "node:assert/strict";
import test from "node:test";

import { createProcessingServer } from "../server.mjs";
import { validateClinicApproval } from "../recording-store.mjs";

test("requires complete licensed clinic report approval", () => {
  assert.throws(
    () => validateClinicApproval({}),
    /Complete all clinic report approval fields/,
  );
  assert.throws(
    () => validateClinicApproval({
      studentName: "DPT Student",
      reviewerName: "Reviewer",
      reviewerCredentials: "PT, DPT",
      supervisingClinicianName: "Supervisor",
      supervisingClinicianCredentials: "PT, DPT",
      approvalDate: "2026-10-24",
      attestationAccepted: false,
    }),
    /must accept/,
  );
  assert.deepEqual(
    validateClinicApproval({
      studentName: " DPT Student ",
      reviewerName: " Reviewer ",
      reviewerCredentials: " PT, DPT ",
      supervisingClinicianName: " Supervisor ",
      supervisingClinicianCredentials: " PT, DPT ",
      approvalDate: "2026-10-24",
      attestationAccepted: true,
    }),
    {
      studentName: "DPT Student",
      reviewerName: "Reviewer",
      reviewerCredentials: "PT, DPT",
      supervisingClinicianName: "Supervisor",
      supervisingClinicianCredentials: "PT, DPT",
      approvalDate: "2026-10-24",
      attestationAccepted: true,
    },
  );
});

test("serves the review interface and recording API", async (context) => {
  const store = {
    async refresh() {
      return [{
        recordingId: "test-recording",
        date: "2026-10-23",
        startedAt: "2026-10-23T00:00:00.000Z",
        durationSeconds: 60,
        finalized: true,
        sampleCounts: { ecg: 30_720, imu: 1_560 },
        sensor: { name: "Movesense", ecgRateHz: 512, imuRateHz: 26 },
      }];
    },
    async describe(recordingId) {
      return { recordingId };
    },
  };
  const application = await createProcessingServer({
    port: 0,
    dataRoot: "/tmp",
    store,
  });
  context.after(() => application.close());

  const page = await fetch(application.url);
  assert.equal(page.status, 200);
  const pageText = await page.text();
  assert.match(pageText, /Tilt ECG Review and Report/);
  assert.match(pageText, /Corrected angle versus raw R–R interval/);
  assert.match(pageText, /Corrected angle versus beat-to-beat HR/);
  assert.match(pageText, /Poincaré plot/);
  assert.match(pageText, /Frequency-domain HRV eligibility/);
  assert.match(pageText, /Blood pressure, end-tidal CO₂, and symptoms/);
  assert.match(pageText, /PSU DPT Panther PT Pro Bono Clinic/);
  assert.match(pageText, /Passive Head-Up Tilt Physiological Response Report/);
  assert.match(pageText, /Results by test stage/);
  assert.match(pageText, /Blood pressure/);
  assert.match(pageText, /End-tidal CO₂/);
  assert.match(pageText, /Consensus criteria/);
  assert.match(pageText, /Limitations/);
  assert.doesNotMatch(pageText, /Structured impression/);
  assert.doesNotMatch(pageText, /Licensed reviewer conclusion and recommendations/);
  assert.match(pageText, /Licensed reviewer/);
  assert.match(pageText, /Print Panther PT PDF/);
  assert.match(pageText, /Print detailed HMS PDF/);
  assert.doesNotMatch(
    pageText,
    /Research analysis only\. Not a diagnostic interpretation or clinical alarm\./,
  );
  const styles = await fetch(new URL("/styles.css", application.url));
  assert.match(await styles.text(), /size:\s*portrait/);

  const listing = await fetch(new URL("/api/recordings", application.url));
  assert.deepEqual(await listing.json(), {
    recordings: [{
      recordingId: "test-recording",
      date: "2026-10-23",
      startedAt: "2026-10-23T00:00:00.000Z",
      durationSeconds: 60,
      finalized: true,
      sampleCounts: { ecg: 30_720, imu: 1_560 },
      sensor: { name: "Movesense", ecgRateHz: 512, imuRateHz: 26 },
    }],
  });
});
