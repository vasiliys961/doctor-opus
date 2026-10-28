# Doctor Opus Whole-Person Research — NIH SCHARE track

Status: exploratory branch (not an eligible or submitted competition entry).
Base: doctor-opus/main. Preserve the clinical production line unchanged.

## Competition alignment
Source: https://www.nimhd.nih.gov/resources/schare/grand-challenges/advance-whole-person-data-integration-and-analytics

Research target: cardiovascular-metabolic disease disparities (hypertension, diabetes, CKD, cardiovascular outcomes).
Deliver interoperable AI-ready whole-person longitudinal research datasets, reusable transformation pipelines, missingness and representation diagnostics, transparent benchmarking, and investigator-facing cohort tooling. This is not merely a patient-facing clinical chatbot.

## MVP sequence
1. Audit existing application modules, tests, dependency boundaries, data schemas, and licensing. Confirm real implementations rather than README claims.
2. Define a de-identified longitudinal patient/cohort data model with explicit provenance, consent/access scope, time units, and schema versioning. Incorporate clinical labs, ECG summary features, imaging features, meds, diagnoses, physiological measurements, patient-reported behavioral factors, environmental and access-to-care features.
3. Implement imports/export based on relevant HL7 FHIR resources, CSV, JSON with typed validation, conversion logs, missingness flags and data-dictionary metadata. No actual patient data in repo.
4. Create end-to-end reproducible cohort pipeline: ingest -> harmonize -> validation -> feature engineering -> AI readiness report -> aggregate analyses -> export; test on appropriately licensed public or synthetic datasets.
5. Expose cohort filters, longitudinal dashboards, stratified missingness and performance/fairness comparisons, reproducible notebooks and API.
6. Implement one scientifically disciplined use case for cardiometabolic risk research. Clearly distinguish correlation, predictive modeling, and causal claims. Include baseline comparisons and confidence intervals.
7. Add unit/integration tests and evidence report; validate all public datasets' terms and avoid claims of clinical readiness.
8. Review official challenge requirements and eligibility; participation, use of generative AI for code / submission contents, and US prize rules must be clarified with organizers before creating or filing entry.

## Rules for this branch
- No merge into main without tests and review.
- Do not claim NIH endorsement or submission.
- Do not generate contest submission writing, imagery, or data with GenAI in violation of NIH rules; the official instructions say submissions must not be AI-generated. Obtain organizers' interpretation for AI-assisted software before proceeding toward submission.
- Do not use private clinical data in challenge artifacts.
- Main clinical functionality stays undisturbed.

## Done criteria for MVP
- One-command demo with licensed public or independently prepared allowed synthetic data.
- Visible cohort UI with at least one longitudinal analysis.
- Machine-readable, documented export and reproducible pipeline.
- Passing tests for import, harmonization, and analysis.
- Explicit validation and limitations documentation.


## Cross-project integration charter (28 Oct 2026)
The NIH-oriented system reuses capabilities as adapters rather than copying code or merging unrelated repository histories.

Candidate sources to audit and connect:
- Doctor Opus (including English-language edition): multidisciplinary clinical reasoning, lab/genetic and longitudinal data tools.
- Opus Radiology AI: structured imaging findings with model/version/evidence metadata, not unvalidated diagnoses.
- Doctor Opus ECG / ECG engine: signal-derived metrics, rhythm flags, calibrated predictions where validated.
- Sonopus Ultra: portable ultrasound image and acquisition observations; mark experimental outputs accordingly.
- Clinical visit documentation / ambient transcription: consent-based visit notes, symptom timeline, medication and history extraction.
- Medical real-time multilingual translator: language-independent research interviews, original transcript plus translated transcript with uncertainty flags.
- Patient advisor: standardized questionnaires and patient-reported outcomes.
- Peripheral streams: spirometry, CGM, dermatology and other modules if integration passes review.

Integration contract for every adapter:
patient_pseudonym, encounter_id, source_module, source_version, timestamp, observation_code,
value, unit, uncertainty_or_confidence, evidence_reference, acquisition_method,
language, consent_scope, provenance, review_status.

Prioritize one real end-to-end demonstration:
multilingual intake -> clinician-reviewed longitudinal profile -> labs/ECG/CGM summaries
-> social determinants -> cohort dashboard -> reproducible cardiometabolic analysis.
Imaging/ultrasound plug in after first pipeline works. No unreviewed LLM output is treated as verified evidence.
No clinical data leaves its authorization scope. Document validation and permissible datasets.

Milestones: A inventory and adapter tests; B first vertical slice; C cohort analytics; D imaging/US additional streams; E reproducible public-data demonstration. Each milestone requires working tests, not only design documents.
