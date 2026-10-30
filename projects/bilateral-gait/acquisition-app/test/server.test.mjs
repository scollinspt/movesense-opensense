import assert from "node:assert/strict";
import test from "node:test";

import { createGaitAcquisitionServer } from "../server.mjs";

test("serves the bilateral gait interface and simulator", async (context) => {
  const application = await createGaitAcquisitionServer({
    port: 0,
    dataRoot: "/tmp",
  });
  context.after(() => application.close());

  const page = await fetch(application.url);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Bilateral Gait Acquisition/);
  assert.match(html, /Left distal shank/);
  assert.match(html, /M points proximally on both limbs/);
  assert.match(html, /Flat overground gait session/);
  assert.match(html, /Turn left/);
  assert.match(html, /Assistive device/);
  assert.match(html, /Stop and finalize/);

  const response = await fetch(new URL("/api/connect/demo", application.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(response.status, 200);
  const state = await response.json();
  assert.equal(
    state.roles.left_distal_shank.connectionState,
    "connected",
  );
  assert.equal(
    state.roles.right_distal_shank.connectionState,
    "connected",
  );
  assert.equal(state.ready, false);
});

