# 🏥 Doctor Opus — AI Clinical Decision Support Platform

**Version:** 4.4.0 | **Updated:** September 2026 | **Status:** 🌍 Global Edition (Beta)

> **Disclaimer:** Doctor Opus is beta Clinical Decision Support Software (CDSS) intended exclusively for licensed healthcare professionals. It is not a medical device, does not provide final diagnosis/treatment orders, and does not replace physician judgment. AI output quality depends on third-party LLM capabilities and may be incomplete or inaccurate. All AI outputs require independent physician verification and sign-off. Intended-use restriction: not for regulated clinical deployment in EU/US/UK jurisdictions.

A comprehensive web application for physicians and expert clinics, built on **Next.js 14 App Router**. It accelerates clinical workflows through agentic AI chains (Polza AI primary, OpenRouter fallback), supporting DICOM imaging, laboratory data, genetic reports, voice-dictated protocols, multi-language UI, and three-level PHI anonymization.

This repository branch (`en-version-global`) is the English/global product. Production domain: `doctor-opus.online`. The Russian product lives on `main` and deploys separately to `doctor-opus.ru`.

---

## 🚀 Key Features

### 🛡️ Three-Level Anonymization System (GDPR / HIPAA-Aligned)
- **Automatic server-side protection:** 100% anonymization of all images before transmission to the LLM gateway — always active.
- **Quick anonymize:** One-click automatic redaction of image edges and corners.
- **Precision manual redact:** Brush editor for targeted redaction of any region.
- **Text anonymization:** Automatic detection and removal of names, dates, IDs, phone numbers, addresses.
- **Protection level:** 99.9% | No PHI or PII linked to medical scans is stored.

### 🤖 Advanced AI Analysis
- **LLM routing:** Polza AI as the primary OpenAI-compatible gateway, with automatic fallback to OpenRouter on network/provider errors.
- **Multi-model Council:**
- **Claude Opus 5.5:** Deep reasoning for complex clinical cases and genomics.
- **Claude Sonnet 5:** Strong default for fractures, skeletal pathology, and routine optimized analysis.
- **GPT-5.6 Terra:** Fast working model for X-Ray, MRI, CT, and general clinical analysis.
- **Gemini 3.8 Flash:** High-speed Stage 1 extraction (JSON/OCR) and screening.
- **Two-stage Workflow:** Structured data extraction (JSON) → Clinical directive generation.
- **Streaming (SSE):** Real-time token-by-token output for immediate feedback.
- **Consilium:** Multi-agent case review for complex diagnostics.

### 📸 Medical Imaging & DICOM
- **Native DICOM:** In-browser viewing and analysis of DICOM series (Cornerstone.js).
- **Modalities:** ECG, X-Ray, MRI, CT, Ultrasound (cine-loop), Dermatoscopy, Histology, Ophthalmology, Mammography, Lab, Spirometry.
- **3D Volumetric Rendering:** MPR 2×2 (Axial / Coronal / Sagittal) + Cinematic 3D mode.
- **Genetics:** VCF file analysis and complex multi-page PDF genetic report parsing.
- **Comparative / video:** Follow-up comparison and ultrasound cine-loop frame capture.

### 🎙️ Voice-to-Protocol
- **In-browser dictation:** Web Speech API, language follows the selected UI locale.
- **Audio file transcription:** Optional server STT (AssemblyAI by default; Yandex/Polza depending on env).
- **Export:** Generate professional reports in **Word (.docx)** format, ready to print and sign.
- **Templates:** 26 specialty-specific templates (Cardiology, Neurology, Orthopedics, etc.) following SOAP / H&P structure.

### 🌍 Localization & Clinical Workspace
- **UI locales:** English plus Spanish, French, Arabic, Hindi, Portuguese (Brazil), Indonesian, Malay, Turkish, Chinese.
- **Personal library:** Local PDF knowledge base for RAG-style citations.
- **Link collection, calculators, devices, mobile bridge:** Supporting tools around the main analysis workflow.

### 💰 Credit-Based Billing
- **Payment (EN):** Direct USDT TRC20 (Trust Wallet), no payment aggregator dependency.
- **Packages:** Starter (50 cr. / $6.99), Standard (180 cr. / $19.99), Pro (600 cr. / $59.99).
- **No trial credits:** AI features are available after package payment and balance top-up.
- **Transparent pricing:** Exact credit cost is shown after every analysis.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend / Backend | Next.js 14 (App Router), TypeScript |
| Database | PostgreSQL (Neon in cloud, Docker Postgres for local) — balances, consents, statistics |
| AI Integration | Polza AI (primary) + OpenRouter (fallback), Streaming API (SSE) |
| Auth | NextAuth v4 (JWT Strategy) |
| Payments | Direct USDT TRC20 flow (Trust Wallet + txHash confirmation) |
| Voice | Browser SpeechRecognition + optional server STT (AssemblyAI / Yandex / Polza) |
| Deployment | VPS + Docker Compose + Nginx |

---

## 📋 Quick Start

### Requirements
- **Node.js 20.x** or higher
- **Polza** and/or **OpenRouter** API key
- **PostgreSQL** database (Neon or local Docker)

### 1. Install
```bash
git clone https://github.com/vasiliys961/doctor-opus.git
cd doctor-opus
git checkout en-version-global
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

```env
LLM_BASE_URL=https://polza.ai/api/v1
LLM_API_KEY=your_polza_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=your_openrouter_key
POSTGRES_URL=your_postgres_connection_string
NEXTAUTH_SECRET=random_32_char_string
NEXTAUTH_URL=http://localhost:3000
ASSEMBLYAI_API_KEY=your_key
MIGRATION_SECRET=random_32_char_string
ENCRYPTION_SALT=random_32_char_string
TRUST_WALLET_TRC20_ADDRESS=your_trust_wallet_trc20_address
```

### 3. Run development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

`npm run dev` also tries to start the local Docker Postgres profile when Docker is available.

---

## 🧪 Local Dev Database (No Neon)

If you want stable local development without external PostgreSQL availability, use the built-in Docker Postgres profile (`docker-compose.local-db.yml`).

### 1) Start local PostgreSQL
```bash
npm run dev:db:up
```

### 2) Point app to local DB
Add these values to `.env` or `.env.local`:
```env
POSTGRES_URL=postgresql://doctoropus:doctoropus_local_dev@localhost:54329/doctoropus_dev
DATABASE_URL=postgresql://doctoropus:doctoropus_local_dev@localhost:54329/doctoropus_dev
NEXTAUTH_URL=http://localhost:3000
```

### 3) Run app
```bash
npm run dev
```

Or start DB + app in one command:
```bash
npm run dev:auto
```

Helpful commands:
- `npm run dev:db:logs` — follow Postgres logs
- `npm run dev:db:down` — stop local DB

---

## 🔐 Security

### Built-in Protections
- **API security:** NextAuth JWT middleware — all endpoints require authentication
- **Server-side billing:** PostgreSQL transactions with `FOR UPDATE` — race condition safe
- **Safe logs:** Automatic masking of API keys, tokens, and email addresses
- **PHI anonymization:** Names, dates, IDs, phones, addresses stripped from all data before AI submission
- **Mandatory legal consent gate:** First login requires explicit legal acceptance with timestamped DB record
- **Mandatory physician verification on save:** Clinical result save to patient record requires physician confirmation with strict no-PHI audit log (`patient_id` + content hash only)

### Privacy by Design
- Patient cards and analysis history stored **locally in the browser** (IndexedDB) — not on server
- PHI filtered at the API route level before reaching any external service
- User balances stored in PostgreSQL; no sensitive medical data touches the cloud database
- API keys never exposed to the client and masked in all logs
- Full anonymization before sending any data to AI models

---

## 🐳 Deployment (Docker Compose)

Before production operations, review branch/environment rules in [`DEPLOY.md`](DEPLOY.md).

- Push to `en-version-global` → deploy only EN (`doctor-opus.online`).
- Push to `main` → deploy only RU (`doctor-opus.ru`).
- Do not mix RU and EN paths, containers, or databases.

### Prerequisites
- Docker + Docker Compose installed on VPS
- DNS pointing to your server
- SSL certificates in `nginx/ssl/` (`fullchain.crt`, `privkey.key`)

### Required environment variables
- `LLM_API_KEY` and/or `OPENROUTER_API_KEY`
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
├── app/                 # Next.js pages and API route handlers
├── components/          # React UI components
├── lib/                 # Core: LLM provider, billing, prompts, i18n, streaming
├── content/             # Localized manuals and static content
├── scripts/             # Migrations, prebuild, local model setup
├── public/              # Static assets (PDF.js, Cornerstone, calculators)
├── nginx/               # Reverse-proxy / SSL templates
├── docs/                # Architecture, payment, and ops notes
├── backend/             # Optional auxiliary backend
├── stt-service/         # Optional local STT service
├── types/               # Extra TypeScript declarations
├── middleware.ts        # Auth and request interception
└── docker-compose*.yml  # App and local Postgres profiles
```

Main clinical routes live under `app/` (`chat`, `protocol`, `ct`, `mri`, `xray`, `ultrasound`, `ecg`, `lab`, `genetic`, `library`, `links`, `devices`, `subscription`, and others).

---

## 📚 Documentation

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | System architecture and component interactions |
| [User Manual](USER_MANUAL_FOR_DOCTORS.md) | Physician guide to all features |
| [Compliance](COMPLIANCE_AND_LEGAL_DOCS.md) | GDPR/HIPAA data handling overview |
| [Deploy](DEPLOY.md) | Branch, environment, and production rules |

---

## ⚖️ Legal

Doctor Opus is beta **Clinical Decision Support Software (CDSS)**, not a medical device. It is not FDA-approved, CE-marked, or registered as a medical device in any jurisdiction. AI output quality depends on third-party LLM availability/performance and may be inaccurate or incomplete. All outputs are informational drafts and require independent clinical verification by a licensed physician. Intended-use restriction: not for regulated clinical deployment in EU/US/UK jurisdictions. The developer assumes no liability for clinical decisions made using this tool.

**For licensed healthcare professionals only.**
