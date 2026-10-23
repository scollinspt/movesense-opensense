import assert from "node:assert/strict";
import test from "node:test";

import { createProcessingServer } from "../server.mjs";

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
  assert.match(pageText, /Print \/ Save PDF/);

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
