import assert from "node:assert/strict";
import test from "node:test";

import { createTiltEcgServer } from "../server.mjs";

test("serves the operational interface and starts synthetic acquisition", async (context) => {
  const application = await createTiltEcgServer({ port: 0, dataRoot: "/tmp" });
  context.after(() => application.close());

  const page = await fetch(application.url);
  assert.equal(page.status, 200);
  const pageText = await page.text();
  assert.match(pageText, /Tilt ECG Acquisition/);
  assert.match(pageText, /Presyncope \/ lightheadedness/);
  assert.match(pageText, /Annotation controls are shown for protocol review/);
  assert.match(pageText, /Target table angle/);
  assert.match(pageText, /value="70"/);
  assert.match(pageText, /Begin return early/);
  assert.match(pageText, /Observed maximum table angle if known/);
  assert.match(pageText, /Early-return reason/);

  const demo = await fetch(new URL("/api/connect/demo", application.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(demo.status, 200);
  const state = await demo.json();
  assert.equal(state.connectionState, "connected");
  assert.equal(state.sensor.mode, "synthetic");

  const current = await fetch(new URL("/api/state", application.url));
  assert.equal((await current.json()).sensor.ecgRateHz, 250);
});
