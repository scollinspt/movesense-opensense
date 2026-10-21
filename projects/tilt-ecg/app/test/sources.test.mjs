import assert from "node:assert/strict";
import test from "node:test";

import { MovesenseBridgeSource } from "../sources.mjs";

test("hardware source defaults to HRV ECG and low-rate tilt IMU", () => {
  const source = new MovesenseBridgeSource({
    address: "test-sensor",
    pythonExecutable: "/unused/python",
  });

  assert.equal(source.info.ecgRateHz, 512);
  assert.equal(source.info.imuRateHz, 26);
});
