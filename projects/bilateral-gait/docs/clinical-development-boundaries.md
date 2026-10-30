# Clinical-Development Boundaries

## Context

The motivating use involves gait rehabilitation after cerebrovascular
accident in a pro bono physical therapy clinic. This makes privacy, safety,
intended-use, and research boundaries central to the design.

## Data boundary

The public repository may contain:

- Software.
- Schemas.
- Protocols.
- Synthetic fixtures.
- Permission-cleared validation material.

It must not contain:

- Names, medical record numbers, dates of birth, or linkage keys.
- Clinical notes or identifiable free text.
- Raw or derived patient recordings.
- Reports from clinical-development sessions.
- Images or video without explicit permission and approved handling.

Human data remain in approved governed storage. Authorized linkage to a person
remains outside project artifacts.

## Clinical versus research use

A clinical-development recording may support the patient's clinical workflow
and reveal software-development needs. It does not automatically authorize:

- Secondary research analysis.
- Inclusion in a study.
- Publication.
- Public demonstration.
- Model training.
- Normative comparison.

Those uses require their own determination, protocol, consent, and storage
plan.

## Safety boundary

The system:

- Does not detect or predict falls.
- Does not decide whether walking is safe.
- Does not prescribe an assistive device.
- Does not assign assistance level.
- Does not replace guarding or clinical observation.
- Does not provide emergency alarms.

The treating team remains responsible for environment, device, orthosis,
assistance, guarding, stopping, and clinical documentation.

The computer operator should be separate from the primary guard whenever the
clinical situation requires continuous guarding.

## Intended interpretation

Initial outputs are descriptive movement measurements. If later included in a
report, they are used alongside other physical therapy examination findings
in developing a movement system interpretation. They do not independently
establish a diagnosis or treatment recommendation.

## Free text

Prefer structured context. Any free-text field must:

- Be optional.
- Be clearly labeled as de-identified.
- Warn against direct identifiers.
- Have a short maximum length.
- Never be required to explain a normal workflow state.

