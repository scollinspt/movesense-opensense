import assert from "node:assert/strict";
import test from "node:test";

import { createTiltEcgServer } from "../server.mjs";

test("serves the operational interface and starts synthetic acquisition", async (context) => {
  const application = await createTiltEcgServer({ port: 0, dataRoot: "/tmp" });
  context.after(() => application.close());

  const page = await fetch(application.url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Tilt ECG Acquisition/);

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
