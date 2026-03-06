# 🏥 Doctor Opus — AI Clinical Decision Support Platform

**Version:** 4.6.x | **Updated:** February 2026 | **Status:** 🌍 Global Edition

> **Disclaimer:** Doctor Opus is a Clinical Decision Support System (CDSS) intended exclusively for use by licensed healthcare professionals. It is **not FDA-approved**, does not constitute a medical diagnosis, and does not replace clinical judgment. All AI-generated outputs require physician verification and sign-off. The clinician bears full responsibility for any clinical decisions made.

A comprehensive web application for physicians and expert clinics, built on **Next.js 14 App Router**. It accelerates clinical workflows through agentic AI chains (via OpenRouter), supporting DICOM imaging, laboratory data, genetic reports, voice-dictated protocols, and three-level PHI anonymization.

---

## 🚀 Key Features

### 🛡️ Three-Level Anonymization System (GDPR / HIPAA-Aligned)
- **Automatic server-side protection:** 100% anonymization of all images before transmission to OpenRouter — always active.
- **Quick anonymize:** One-click automatic redaction of image edges and corners.
- **Precision manual redact:** Brush editor for targeted redaction of any region.
- **Text anonymization:** Automatic detection and removal of names, dates, IDs, phone numbers, addresses.
- **Protection level:** 99.9% | No PHI or PII linked to medical scans is stored.

### 🤖 Advanced AI Analysis
- **Multi-model Council:**
  - **Claude Opus 4.6:** Deep reasoning for complex clinical cases and genomics.
  - **Claude Sonnet 4.6:** Best-in-class for fractures and skeletal pathology (83% accuracy).
  - **GPT-5.4:** Best choice for 80% of X-Ray, MRI, and general clinical analysis.
  - **Gemini 3.1 Flash:** High-speed data extraction (OCR) and screening.
- **Two-stage Workflow:** Structured data extraction (JSON) → Clinical directive generation.
- **Streaming (SSE):** Real-time token-by-token output for immediate feedback.

### 📸 Medical Imaging & DICOM
- **Native DICOM:** In-browser viewing and analysis of DICOM series (Cornerstone.js).
- **Modalities:** ECG, X-Ray, MRI, CT, Ultrasound (cine-loop), Dermatoscopy, Histology, Ophthalmology, Mammography.
- **3D Volumetric Rendering:** MPR 2×2 (Axial / Coronal / Sagittal) + Cinematic 3D mode (Apple M1 accelerated).
- **Genetics:** VCF file analysis and complex multi-page PDF genetic report parsing.

### 🎙️ Voice-to-Protocol
- **Dictation:** Fill clinical encounter notes by voice (AssemblyAI).
- **Export:** Generate professional reports in **Word (.docx)** format, ready to print and sign.
- **Templates:** 22 specialty-specific templates (Cardiology, Neurology, Orthopedics, etc.) following SOAP / H&P structure.

### 💰 Credit-Based Billing
- **Payment:** NOWPayments gateway (crypto + fiat, USD).
- **Packages:** Starter (50 cr. / $9.99), Standard (150 cr. / $24.99), Pro (500 cr. / $69.99).
- **Transparent pricing:** Exact credit cost displayed after every analysis.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend / Backend | Next.js 14 (App Router), TypeScript |
| Database | PostgreSQL (Neon) — balances, consents, statistics |
| AI Integration | OpenRouter SDK, Streaming API (SSE) |
| Auth | NextAuth v4 (JWT Strategy) |
| Payments | NOWPayments (crypto/fiat) |
| Voice | AssemblyAI |
| Deployment | VPS + Docker Compose + Nginx |

---

## 📋 Quick Start

### Requirements
- **Node.js 20.x** or higher
- **OpenRouter** API key
- **PostgreSQL** database (Neon or self-hosted)

### 1. Install
```bash
git clone https://github.com/your-org/doctor-opus-global.git
cd doctor-opus-global
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

```env
OPENROUTER_API_KEY=your_key
POSTGRES_URL=your_postgres_connection_string
NEXTAUTH_SECRET=random_32_char_string
NEXTAUTH_URL=https://doctor-opus.online
ASSEMBLYAI_API_KEY=your_key
MIGRATION_SECRET=random_32_char_string
ENCRYPTION_SALT=random_32_char_string
NOWPAYMENTS_API_KEY=your_key
NOWPAYMENTS_IPN_SECRET=your_ipn_secret
```

### 3. Run development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## 🔐 Security

### Built-in Protections
- **API security:** NextAuth JWT middleware — all endpoints require authentication
- **Server-side billing:** PostgreSQL transactions with `FOR UPDATE` — race condition safe
- **Safe logs:** Automatic masking of API keys, tokens, and email addresses
- **PHI anonymization:** Names, dates, IDs, phones, addresses stripped from all data before AI submission

### Privacy by Design
- Patient cards and analysis history stored **locally in the browser** (IndexedDB) — not on server
- PHI filtered at the API route level before reaching any external service
- User balances stored in PostgreSQL; no sensitive medical data touches the cloud database
- API keys never exposed to the client and masked in all logs
- Full anonymization before sending any data to AI models

---

## 🐳 Deployment (Docker Compose)

Before production operations, review branch/environment rules in [`DEPLOY.md`](DEPLOY.md).

### Prerequisites
- Docker + Docker Compose installed on VPS
- DNS pointing to your server
- SSL certificates in `nginx/ssl/` (`fullchain.crt`, `privkey.key`)

### Required environment variables
- `OPENROUTER_API_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `MIGRATION_SECRET`
- `ENCRYPTION_SALT`

### Launch
```bash
docker compose pull
docker compose build --no-cache medical-assistant
docker compose up -d
docker compose ps
```

### Verify
```bash
docker compose logs -f medical-assistant
curl -I https://doctor-opus.online
```

---

## 📁 Project Structure

```text
doctor-opus/
├── app/              # Next.js routes (Pages & API Route Handlers)
├── components/       # React UI components
├── lib/              # Core: database, billing logic, AI streaming, prompts
├── public/           # Static assets
├── types/            # TypeScript type definitions
└── docs/             # Architecture and compliance documentation
```

---

## 📚 Documentation

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | System architecture and component interactions |
| [User Manual](USER_MANUAL_FOR_DOCTORS.md) | Physician guide to all features |
| [Compliance](COMPLIANCE_AND_LEGAL_DOCS.md) | GDPR/HIPAA data handling overview |

---

## ⚖️ Legal

Doctor Opus is a **Clinical Decision Support System (CDSS)**, not a medical device. It is not FDA-approved, CE-marked, or registered as a medical device in any jurisdiction. All outputs are informational and require independent clinical verification by a licensed practitioner. The developer assumes no liability for clinical decisions made using this tool.

**For licensed healthcare professionals only.**
