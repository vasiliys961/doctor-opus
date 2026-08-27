# 🏥 Doctor Opus — AI Clinical Decision Support Platform

**Version:** 4.6.x | **Updated:** August 2026 | **Status:** 🌍 Global Edition (Beta)

> **Disclaimer:** Doctor Opus is beta Clinical Decision Support Software (CDSS) intended exclusively for licensed healthcare professionals. It is not a medical device, does not provide final diagnosis/treatment orders, and does not replace physician judgment. AI output quality depends on third-party LLM capabilities and may be incomplete or inaccurate. All AI outputs require independent physician verification and sign-off. Intended-use restriction: not for regulated clinical deployment in EU/US/UK jurisdictions.

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
- **Claude Opus 5:** Deep reasoning for complex clinical cases and genomics.
- **Claude Sonnet 5:** Best-in-class for fractures and skeletal pathology (83% accuracy).
- **GPT-5.6 Terra:** Best choice for 80% of X-Ray, MRI, and general clinical analysis.
- **Gemini 3 Flash:** High-speed data extraction (OCR) and screening.
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
- **Payment:** Direct USDT TRC20 (Trust Wallet), no payment aggregator dependency.
- **Packages:** Starter (50 cr. / $6.99), Standard (180 cr. / $19.99), Pro (600 cr. / $59.99).
- **No trial credits:** AI features are available after package payment and balance top-up.
- **Transparent pricing:** Exact credit cost is shown after every analysis.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend / Backend | Next.js 14 (App Router), TypeScript |
| Database | PostgreSQL (Neon) — balances, consents, statistics |
| AI Integration | OpenRouter SDK, Streaming API (SSE) |
| Auth | NextAuth v4 (JWT Strategy) |
| Payments | Direct USDT TRC20 flow (Trust Wallet + txHash confirmation) |
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
TRUST_WALLET_TRC20_ADDRESS=your_trust_wallet_trc20_address
```

### 3. Run development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## 🧪 Local Dev Database (No Neon)

If you want stable local development without external PostgreSQL availability, use the built-in Docker Postgres profile.

### 1) Start local PostgreSQL
```bash
npm run dev:db:up
```

### 2) Point app to local DB
Copy `.env.local-db.example` values into your local env (for example, `.env.local`):
```env
POSTGRES_URL=postgresql://doctoropus:doctoropus_local_dev@localhost:54329/doctoropus_dev
DATABASE_URL=postgresql://doctoropus:doctoropus_local_dev@localhost:54329/doctoropus_dev
NEXTAUTH_URL=http://localhost:3000
```

### 3) Run app
```bash
WATCHPACK_POLLING=true npm run dev
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

Doctor Opus is beta **Clinical Decision Support Software (CDSS)**, not a medical device. It is not FDA-approved, CE-marked, or registered as a medical device in any jurisdiction. AI output quality depends on third-party LLM availability/performance and may be inaccurate or incomplete. All outputs are informational drafts and require independent clinical verification by a licensed physician. Intended-use restriction: not for regulated clinical deployment in EU/US/UK jurisdictions. The developer assumes no liability for clinical decisions made using this tool.

**For licensed healthcare professionals only.**
