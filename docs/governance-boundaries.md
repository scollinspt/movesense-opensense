# Governance boundaries

This public repository contains software, reproducible configuration, synthetic or explicitly redistributable fixtures, and permission-cleared validation artifacts.

It must not contain identifiable participant information, consent records, identity-linkage keys, protected health information, unrestricted human-subject recordings, confidential partner information, restricted third-party assets, credentials, or access tokens.

The authoritative research data store is institution-managed, encrypted storage configured through `MOVESENSE_DATA_ROOT`. The local `data/` directory is only an ignored mount point or working location and is never authoritative.

Participant identity linkage requires stricter access than coded movement data and should be stored separately when institutional systems support that separation.
