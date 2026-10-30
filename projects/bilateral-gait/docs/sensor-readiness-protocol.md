# Sensor Readiness Protocol

Use this protocol before assigning sensors to limbs or starting a governed
bilateral-gait recording.

## Readiness criteria

A sensor is ready only when all of the following are true:

1. Its serial number appears in a fresh BLE scan.
2. Its battery is adequate for the planned session.
3. Inventory reports `gsp-ready`.
4. A short individual `/Meas/IMU9/52` stream produces samples.
5. The selected pair connects concurrently and both sample counters advance.

`legacy-mds` and `unknown` profiles are not ready for this acquisition
application. Record the installed profile before changing firmware.

## Procedure

1. Wake and keep the candidate sensors close to the acquisition computer.
2. Scan and record each expected serial number and current Bluetooth address.
3. Inspect each sensor independently with the firmware inventory command:

   ```console
   .venv/bin/python -m movesense_opensense.acquisition.firmware_inventory \
     inspect --name "Movesense SERIAL" --address ADDRESS
   ```

4. Exclude any sensor that does not report `gsp-ready`.
5. Verify a short individual stream when a sensor was newly updated or its
   behavior is uncertain:

   ```console
   .venv/bin/python -m movesense_opensense.acquisition.live stream \
     --address ADDRESS --sample-rate 52
   ```

6. Stop the individual stream and allow the sensor to resume advertising.
7. Scan again. Do not begin the pair connection unless both selected serial
   numbers appear.
8. Assign the two confirmed sensors in the gait application and connect.
9. Confirm both roles report `connected` and both counters advance for at least
   10 seconds.
10. Perform one-leg-at-a-time movement verification before confirming setup.

If a confirmed sensor is missed during connection, scan again and retry once.
Persistent failure requires a new inventory check rather than repeated
unbounded connection attempts.

## Current verified sensors

As of 2026-10-30:

- `234230000540`: GSP-ready; individual and concurrent 52 Hz streaming
  verified.
- `234230000587`: GSP-ready; concurrent 52 Hz streaming verified.
- `234230000657`: GSP-ready; concurrent 52 Hz streaming verified.
- `234230000604`: GSP-ready after update; individual and concurrent 52 Hz
  streaming verified.

Readiness describes the installed sensor application and bounded connection
checks. It does not establish sustained throughput, clock alignment, drift,
packet continuity, or clinical measurement validity.
