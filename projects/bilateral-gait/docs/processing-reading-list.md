# Bilateral Gait Processing Reading List

## Purpose

This reading list supports the next processing stages for two Movesense IMU9
sensors on the bilateral distal medial shanks. It prioritizes sensor-to-shank
transforms, orientation and gravity compensation, gait-event detection,
coordination, and reproducible validation.

Zotero item keys identify the source records in the HMS Lab library. A
published method is not considered validated for this configuration until it
passes the project-specific stages in the [validation plan](validation-plan.md).

## Read first: frames, orientation, and gravity

### Yun and Bachmann (2006)

**Design, Implementation, and Experimental Results of a Quaternion-Based
Kalman Filter for Human Body Motion Tracking**

DOI: [10.1109/TRO.2006.886270](https://doi.org/10.1109/TRO.2006.886270)
Zotero: `ZWTLEC72`

- **Evidence role:** foundational quaternion sensor-fusion model for human limb
  orientation.
- **Population/setup:** experimental human-body tracking with triaxial
  gyroscopes, accelerometers, and magnetometers.
- **Relevance:** motivates quaternion orientation, initial gyroscope-bias
  estimation, and explicit treatment of magnetic interference.
- **Limitation here:** the paper explicitly did not use accelerometers to
  estimate human linear acceleration, and its uncompensated magnetic
  assumptions do not justify magnetometer use in the present clinic
  environment.

### Ricci et al. (2016)

**On the Orientation Error of IMU: Investigating Static and Dynamic Accuracy
Targeting Human Motion**

DOI: [10.1371/journal.pone.0161940](https://doi.org/10.1371/journal.pone.0161940)
Zotero: `GNBDFNG2`

- **Evidence role:** controlled orientation-error characterization.
- **Population/setup:** robotic-arm simulations of typical human-motion
  amplitudes and frequencies; stochastic and complementary fusion methods.
- **Reference:** controlled robotic motion.
- **Key result:** dynamic error depended strongly on movement amplitude,
  frequency, and rotation-axis orientation relative to gravity; reported error
  bounds were nontrivial.
- **Limitation here:** a robot does not reproduce soft-tissue artifact,
  placement variability, or impaired gait.

### Fan et al. (2025)

**Influence of Sampling Rate on Wearable IMU Orientation Estimation Accuracy
for Human Movement Analysis**

DOI: [10.3390/s25071976](https://doi.org/10.3390/s25071976)
Zotero: `QQFNAWTY`

- **Evidence role:** sampling-rate sensitivity for orientation fusion.
- **Population/setup:** 17 healthy participants with thigh, shank, and foot
  IMUs during treadmill walking and running, plus a cyclic-motion testbed.
- **Reference:** optical motion capture.
- **Key result:** the authors recommended 100 Hz for walking orientation
  estimation under their methods and conditions; gyroscope rate mattered more
  than accelerometer rate.
- **Limitation here:** the present acquisition requests 52 Hz and involves
  overground, potentially impaired gait. This source creates a validation
  question; it does not by itself invalidate 52 Hz event or timing measures.

### Al Borno et al. (2022)

**OpenSense: An Open-Source Toolbox for Inertial-Measurement-Unit-Based
Measurement of Lower Extremity Kinematics Over Long Durations**

DOI: [10.1186/s12984-022-01001-x](https://doi.org/10.1186/s12984-022-01001-x)
Zotero: `5EPZDE6R`

- **Evidence role:** sensor-orientation calibration, fixed sensor-to-segment
  offsets, drift review, and constrained biomechanical processing.
- **Population/setup:** 11 participants performing walking and varied
  lower-extremity movements during 10-minute trials.
- **Reference:** optical motion capture and constrained OpenSim inverse
  kinematics.
- **Relevance:** supports an explicit calibration transform and quality
  screening before downstream kinematics.
- **Limitation here:** two distal-shank sensors cannot reproduce the paper's
  multi-segment joint-kinematics outputs. Magnetic distortions affected heading
  and downstream joint angles even in the laboratory.

### Dorschky et al. (2025)

**Comparing Sparse Inertial Sensor Setups for Sagittal-Plane Walking and
Running Reconstructions**

DOI: [10.3389/fbioe.2025.1507162](https://doi.org/10.3389/fbioe.2025.1507162)
Zotero: `YPQ2TQ67`

- **Evidence role:** defines what information is lost as lower-extremity sensor
  configurations become sparse.
- **Population/setup:** walking and running reconstructions using multiple
  sparse sensor combinations.
- **Relevance:** useful when deciding whether a requested metric requires
  adding foot, thigh, pelvis, or trunk sensors.
- **Limitation here:** reconstruction performance from other sparse
  configurations does not validate joint angles or kinetics from two shank
  sensors.

## Gait events and temporal asymmetry

### Lanotte et al. (2024)

**Enhanced Gait Tracking Measures for Individuals With Stroke Using Leg-Worn
Inertial Sensors**

DOI: [10.1186/s12984-024-01521-8](https://doi.org/10.1186/s12984-024-01521-8)
Zotero: `ZFUAC7U8`

- **Evidence role:** primary clinical-population source for bilateral
  lower-leg gait events and temporal measures.
- **Population/setup:** 41 individuals with subacute stroke; bilateral
  lower-leg IMUs; assistive devices, orthoses, and therapist assistance were
  permitted.
- **Reference:** GAITRite instrumented walkway.
- **Key result:** combined gyroscope, acceleration, and template/DTW logic
  improved event detection in slower and asymmetric gait.
- **Limitation here:** sensor rates, placement, coordinate frames, and
  synchronization differ from the Movesense configuration.

### Romijnders et al. (2021)

**Validation of IMU-Based Gait Event Detection During Curved Walking and
Turning in Older Adults and Parkinson's Disease Patients**

DOI: [10.1186/s12984-021-00828-0](https://doi.org/10.1186/s12984-021-00828-0)
Zotero: `EB7UWUDM`

- **Evidence role:** turning and curved-walking boundary for shank event
  detection.
- **Population/setup:** older adults and people with Parkinson disease or
  stroke; IMUs on the lateral sides of both shanks.
- **Reference:** optical motion capture with heel and toe markers.
- **Key result:** straight and slalom performance was strong, while turning
  produced more missed and false events.
- **Limitation here:** lateral placement and the study's detector cannot be
  transferred directly to medial Movesense placement.

### Voisard et al. (2024)

**Automatic Gait Events Detection With Inertial Measurement Units: Healthy
Subjects and Moderate to Severe Impaired Patients**

DOI: [10.1186/s12984-024-01405-x](https://doi.org/10.1186/s12984-024-01405-x)
Zotero: `AX3YGMKS`

- **Evidence role:** matrix-profile and multiparametric-DTW concepts for
  impaired gait.
- **Population/setup:** healthy, multiple-sclerosis, and post-stroke
  equinovarus cohorts.
- **Reference:** instrumented mat.
- **Limitation here:** sensors were foot-mounted, so the event templates and
  axes are not directly transferable to distal shanks.

### Küderle et al. (2024)

**Gaitmap—An Open Ecosystem for IMU-Based Human Gait Analysis and Algorithm
Benchmarking**

DOI: [10.1109/OJEMB.2024.3356791](https://doi.org/10.1109/OJEMB.2024.3356791)
Zotero: `XLASA9QG`

- **Evidence role:** modular pipeline design, coordinate-system handling, and
  reproducible algorithm benchmarking.
- **Relevance:** supports comparing tuned candidate algorithms against the same
  reviewed reference events rather than assuming default parameters
  generalize.
- **Limitation here:** framework availability is not validation for this
  placement, population, or protocol.

## Coordination and dynamical systems

### Jeong and Van Emmerik (2026)

**Comparison of Circular and Ellipse-Based Methods for Assessing Coordination
Variability**

DOI: [10.1123/jab.2025-0270](https://doi.org/10.1123/jab.2025-0270)
Zotero: `2ETMUVPS`

- **Evidence role:** demonstrates that coordination-variability conclusions
  depend on vector-coding method and input representation.
- **Relevance:** supports method-sensitivity analysis before adopting a
  bilateral coordination metric.
- **Limitation here:** the study used optical sagittal joint kinematics, not
  bilateral distal-shank IMU signals.

### Stergiou and Decker (2011)

**Human Movement Variability, Nonlinear Dynamics, and Pathology: Is There a
Connection?**

DOI: [10.1016/j.humov.2011.06.002](https://doi.org/10.1016/j.humov.2011.06.002)
Zotero: `TJMQGTE8`

- **Evidence role:** conceptual and methodological foundation for structured
  variability, entropy, Lyapunov exponents, and fluctuation analysis.
- **Relevance:** supports treating variability as more than standard
  deviation.
- **Limitation here:** nonlinear measures are parameter- and data-length
  sensitive and must not be given diagnostic meaning from one short gait bout.

## Configuration decisions prompted by the literature

1. Preserve all raw axes and every frame transform.
2. Derive a separate proper sensor-to-shank rotation for each limb.
3. Use the seated static interval for proximal direction and gyroscope bias.
4. Use unilateral knee extension/flexion for the functional sagittal axis and
   reviewed sign.
5. Exclude magnetometer heading until magnetic calibration and disturbance
   validation exist.
6. Report shank-frame gravity-compensated acceleration as an estimate with
   fusion diagnostics, not as ground-truth translation.
7. Treat 52 Hz orientation performance as a validation target.
8. Keep straight, transition, and turning results separate.
