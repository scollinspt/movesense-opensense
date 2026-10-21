# Governance boundaries

This public repository contains software, reproducible configuration, synthetic or explicitly redistributable fixtures, and permission-cleared validation artifacts.

It must not contain identifiable participant information, consent records, identity-linkage keys, protected health information, unrestricted human-subject recordings, confidential partner information, restricted third-party assets, credentials, or access tokens.

The authoritative research data store is institution-managed, encrypted storage configured through `MOVESENSE_DATA_ROOT`. The local `data/` directory is only an ignored mount point or working location and is never authoritative.

Participant identity linkage requires stricter access than coded movement data and should be stored separately when institutional systems support that separation.

## Physiological signals and clinical settings

ECG, ambulatory activity, posture, symptoms, and clinical observations are
sensitive research data even when collected with consumer or research-grade
hardware. Public code, schemas, and synthetic fixtures may be retained here;
human recordings and derived physiological artifacts must remain in approved
governed storage.

Software in this repository is not a diagnostic monitor, medical device,
clinical alarm, or substitute for approved clinical equipment and procedures.
A clinical environment, patient population, or collection involving anyone
other than the researcher/developer requires the applicable governance,
operational, consent, privacy, retention, and safety determinations before
collection.
