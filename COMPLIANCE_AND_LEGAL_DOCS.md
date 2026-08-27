# Doctor Opus — Compliance & Legal Overview

**Domain:** doctor-opus.online  
**Version:** 4.6.x (Global Edition)  
**Last updated:** August 2026

---

## 1. Service Description (for Payment Processors & Compliance Teams)

**Doctor Opus** is a beta Software-as-a-Service (SaaS) platform providing licensed healthcare professionals with AI-assisted clinical decision support.

**What we provide:**
- Cloud-based access to AI language and vision models for structuring clinical notes, interpreting medical images, and analyzing laboratory and genetic data
- A credit-based subscription model — users purchase packages of computational units (credits) consumed proportionally to the complexity of each operation
- Physician-only access — registration requires professional credentials acknowledgment and mandatory legal acceptance

**What we do NOT provide:**
- Medical diagnoses, prescriptions, or treatment orders
- Services to patients (B2C) — physicians only (B2B)
- FDA-cleared or CE-marked medical device functionality
- Regulated clinical deployment in EU/US/UK jurisdictions

**Legal classification:** IT SaaS platform / Clinical Decision Support System (CDSS). Not a registered medical device in any jurisdiction.

**Contact:** support@doctor-opus.online

---

## 2. Regulatory Status & Licensing

Doctor Opus operates as an **informational and analytical software service** (CDSS), not a medical device.

**Key statements:**
- The system does not autonomously diagnose, prescribe, or perform clinical procedures
- All AI outputs are advisory and require mandatory physician review and sign-off
- AI output quality depends on third-party LLM availability and performance
- The system explicitly prohibits AI from making final diagnoses (enforced in `lib/prompts.ts`)
- Users acknowledge sole clinical responsibility at registration (mandatory checkbox)

**Not required:**
- FDA 510(k) clearance or PMA (not a medical device under 21 CFR Part 880)
- CE marking under EU MDR 2017/745 (informational tool, not a medical device)
- National medical device registration in any jurisdiction

---

## 3. Data Protection & Privacy (GDPR / HIPAA Considerations)

### User Data (Physicians)
Data collected at registration and stored in cloud PostgreSQL:
- Email address
- Display name (optional)
- Hashed password (bcrypt)
- Credit balance and transaction history
- Anonymous usage statistics (model, credit cost, timestamp)

No clinical or patient data is linked to user accounts in the cloud database.

### Patient Data
Doctor Opus operates on a **Local-First** architecture:
- All patient records (name, age, diagnosis, notes, analysis history) are stored exclusively in the **physician's browser** (IndexedDB)
- Patient data is **never transmitted to our servers**
- We have no access to, and do not store, any patient identifiable information

### Medical Images & PHI
The platform implements a **Three-Level Anonymization System** before any data reaches OpenRouter APIs:

| Level | Mechanism | Scope |
|---|---|---|
| 1 — Text regex | `lib/anonymization.ts` | Names, dates, IDs, phones, addresses stripped in real time |
| 2 — Image canvas | Browser-side brush editor | PHI zones painted black before encoding |
| 3 — Server scrub | `anonymizeObject()` recursive function | All request fields cleaned server-side before API call |

**Result:** No Personal Health Information (PHI) or Personally Identifiable Information (PII) linked to medical scans is stored on our servers or transmitted to third-party AI providers in identifiable form.

### Cross-Border Data Transfer
By using Doctor Opus, users consent to anonymized data being processed by OpenRouter (US-based) and AssemblyAI (US-based) for AI inference. No raw medical images, patient names, or identifiable patient data are transmitted — only anonymized image fragments and de-identified text.

---

## 4. Technical Mechanisms (Developer Reference)

### Anonymization (`lib/anonymization.ts`)
- Cascaded regex filters for PHI detection (Protected Health Information)
- `MEDICAL_EXCEPTIONS` list prevents false positives on medical abbreviations (ECG, MRI, CT, etc.)
- `anonymizeObject()` function recursively cleans all data objects before API submission

### Billing Audit (`lib/subscription-manager.ts`)
- Every balance deduction records: `specialty`, `model_used`, `tokens_in`, `tokens_out`, `cost`, `timestamp`
- Clinic dashboard aggregates spending by department without loading production DB
- All transactions use PostgreSQL `SELECT ... FOR UPDATE` to prevent race conditions

### Legal Consent & Verification Logs
- First-login legal consent gate records acceptance version + timestamp in DB (`user_legal_acceptances`)
- Saving AI result to patient record requires physician verification confirmation
- Verification logs use strict no-PHI design: case identifier + result hash + confirmation metadata only (`analysis_verification_logs`)

### Infrastructure (`lib/database.ts`)
- PostgreSQL connection via standard `pg` (node-postgres) driver
- Connection string via `POSTGRES_URL` or `DATABASE_URL` environment variable
- All tables designed with compliance auditing in mind — timestamps on all writes

### Prompt Safety (`lib/prompts.ts`)
- System prompt hardcodes prohibition on final diagnoses
- AI explicitly instructed to append verification requirement to all outputs
- 22 specialty templates enforce structured SOAP/H&P output format

---

## 5. Monetization Model

**Type:** SaaS subscription — credit packages

| Package | Credits | Price (USD) |
|---|---|---|
| Starter | 50 | $6.99 |
| Standard | 180 | $19.99 |
| Pro | 600 | $59.99 |

**Payment method:** Direct USDT TRC20 transfer (Trust Wallet) with transaction-hash confirmation against TRONSCAN.

**Important:** Payment is for an IT service (computational access), not a medical consultation or service.

---

## 6. Compliance Contact

For payment processor compliance reviews, data protection inquiries, or legal correspondence:

**Email:** support@doctor-opus.online  
**Website:** https://doctor-opus.online  
**Legal documents:** https://doctor-opus.online/docs/privacy

---

## 7. Key Legal Documents (in-app)

| Document | URL |
|---|---|
| Privacy Policy (GDPR/HIPAA) | /docs/privacy |
| Terms of Service | /docs/terms |
| Refund Policy | /docs/refund |
| Informed Consent | /docs/consent |
| SaaS Subscription Agreement | /docs/offer |
