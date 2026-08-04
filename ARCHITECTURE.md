# 🏗️ Doctor Opus — System Architecture

**Stack:** Next.js 14 App Router · TypeScript · PostgreSQL · OpenRouter · AssemblyAI · NOWPayments

---

## 📁 Project Structure

```text
doctor-opus/
├── app/                          # Next.js 14 App Router
│   ├── layout.tsx                # Root layout (metadata, fonts, PWA)
│   ├── page.tsx                  # Landing page
│   ├── auth/signin/page.tsx      # Authentication & registration
│   ├── chat/page.tsx             # AI Assistant (main chat interface)
│   ├── ecg/page.tsx              # ECG analysis
│   ├── xray/page.tsx             # X-Ray analysis
│   ├── ct/page.tsx               # CT analysis
│   ├── mri/page.tsx              # MRI analysis
│   ├── ultrasound/page.tsx       # Ultrasound / cine-loop analysis
│   ├── dermatoscopy/page.tsx     # Dermatoscopy analysis
│   ├── image-analysis/page.tsx   # Universal imaging (multi-modal)
│   ├── lab/page.tsx              # Laboratory data analysis
│   ├── genetic/page.tsx          # Genetic report analysis (VCF / PDF)
│   ├── video/page.tsx            # Video clinical analysis
│   ├── comparative/page.tsx      # Comparative before/after analysis
│   ├── advanced/page.tsx         # Advanced analysis (image + context)
│   ├── advanced-3d/page.tsx      # Cinematic 3D volumetric rendering
│   ├── protocol/page.tsx         # Voice-to-protocol (dictation)
│   ├── protocols/page.tsx        # Clinical guidelines search
│   ├── document/page.tsx         # Document scanning (OCR + local copier)
│   ├── patients/page.tsx         # Patient database (IndexedDB)
│   ├── library/page.tsx          # Personal PDF library (RAG)
│   ├── balance/page.tsx          # Credit balance & transaction history
│   ├── subscription/page.tsx     # Credit package purchase
│   ├── statistics/page.tsx       # Usage statistics & model performance
│   ├── calculators/page.tsx      # Medical calculators
│   ├── devices/page.tsx          # USB device direct connection
│   ├── clinic/dashboard/         # Clinic audit dashboard
│   ├── admin/payments/           # Admin payment management
│   ├── compliance/page.tsx       # Compliance information
│   ├── docs/                     # Legal documents
│   │   ├── privacy/page.tsx      # Privacy Policy (GDPR/HIPAA)
│   │   ├── terms/page.tsx        # Terms of Service
│   │   ├── refund/page.tsx       # Refund Policy
│   │   ├── consent/page.tsx      # Informed Consent
│   │   └── offer/page.tsx        # SaaS Subscription Agreement
│   └── api/                      # API Route Handlers
│       ├── auth/[...nextauth]/   # NextAuth endpoints
│       ├── analyze/              # AI analysis endpoints
│       │   ├── image/            # Image analysis (streaming SSE)
│       │   ├── ecg/              # ECG streaming analysis
│       │   ├── labs/             # Lab data OCR + analysis
│       │   ├── genetic/          # Genetic report extraction
│       │   ├── scan/             # Document OCR
│       │   └── patient-summary/  # AI patient case summary
│       ├── payment/
│       │   ├── create/route.ts   # Create NOWPayments invoice
│       │   └── webhook/route.ts  # IPN webhook (HMAC verified)
│       ├── protocols/search/     # Clinical guidelines search
│       ├── feedback/             # Analysis feedback collection
│       ├── balance/              # Balance read / deduct
│       ├── library/              # RAG library management
│       └── sync/                 # Cross-device sync (temporary token)
│
├── components/                   # Reusable React components
│   ├── Navigation.tsx            # Top navigation bar
│   ├── LegalFooter.tsx           # Footer with legal links + disclaimer
│   ├── MedicalDisclaimer.tsx     # Mandatory AI disclaimer (compact + full)
│   ├── AnalysisResult.tsx        # AI result display + export actions
│   ├── AnalysisTips.tsx          # Contextual usage tips per modality
│   ├── AnalysisModeSelector.tsx  # Fast / Optimized / Expert mode picker
│   ├── ModalitySelector.tsx      # Imaging modality selector
│   ├── ImageUpload.tsx           # File upload + DICOM + anonymization
│   ├── FileUpload.tsx            # Multi-file upload component
│   ├── ImageEditor.tsx           # Canvas-based brush redaction editor
│   ├── AudioUpload.tsx           # Audio upload + microphone recording
│   ├── VoiceInput.tsx            # Inline voice input button
│   ├── PatientSelector.tsx       # Patient context selector (IndexedDB)
│   ├── FeedbackForm.tsx          # Post-analysis accuracy feedback
│   ├── SpendingSummary.tsx       # Monthly credit usage summary
│   ├── LabTrendChart.tsx         # Lab value trend chart (SVG)
│   ├── LibrarySearch.tsx         # RAG library search result display
│   ├── EcgCaliper.tsx            # Digital ECG caliper / ruler
│   ├── DeviceSync.tsx            # Cross-device photo sync (QR/code)
│   ├── CookieBanner.tsx          # Cookie consent banner
│   └── ErrorBoundary.tsx         # React error boundary wrapper
│
├── lib/                          # Core business logic
│   ├── prompts.ts                # All AI system prompts + specialist templates
│   ├── chat-specialists.ts       # Chat specialist definitions (22 profiles)
│   ├── subscription-manager.ts   # Credit packages, balance, transactions
│   ├── anonymization.ts          # PHI regex anonymization engine
│   ├── database.ts               # PostgreSQL connection + queries (pg)
│   ├── auth.ts                   # NextAuth configuration
│   ├── openrouter.ts             # OpenRouter SDK wrapper + model routing
│   ├── streaming.ts              # SSE streaming utilities
│   ├── docx-generator.ts         # Word document generation (docx lib)
│   └── payment/
│       ├── types.ts              # Payment provider types
│       ├── payment-service.ts    # Payment provider registry
│       └── providers/
│           └── nowpayments.ts    # NOWPayments API integration
│
├── public/                       # Static assets
│   ├── manifest.json             # PWA manifest
│   └── icons/                    # App icons (PWA)
│
└── types/                        # Global TypeScript definitions
```

---

## 🔄 Core Workflows

### 1. AI Image Analysis (Two-Stage Pipeline)

```
User uploads image
       │
       ▼
[Browser] ImageUpload.tsx
  ├─ DICOM parsing (Cornerstone.js)
  ├─ PHI redaction (canvas brush / auto)
  └─ Base64 encoding
       │
       ▼
[API] /api/analyze/image  (Next.js Route Handler)
  ├─ Stage 1: Gemini 3 Flash → structured JSON description
  └─ Stage 2: Selected model (Sonnet 5 / Opus 5 / GPT-5.6 Terra) → clinical directive
       │
       ▼ SSE stream
[Browser] AnalysisResult.tsx
  ├─ Real-time token rendering
  ├─ Export: .docx / clipboard / print / share
  └─ Save to patient record (IndexedDB)
```

### 2. Voice-to-Protocol

```
Physician dictates / types unsorted notes
       │
       ▼
[API] AssemblyAI transcription  (audio files)
       │
       ▼
[API] /api/analyze/protocol
  └─ Selected specialty template (SOAP / H&P) + GPT-5.6 Terra or Sonnet 5
       │
       ▼
Structured clinical note (.docx export)
```

### 3. Credit Billing Flow

```
User selects package → /api/payment/create
       │
       ▼
NOWPayments invoice created (crypto / fiat)
       │
       ▼ Payment confirmed
NOWPayments IPN webhook → /api/payment/webhook
  ├─ HMAC signature verification
  ├─ getPaymentByOrderId (PostgreSQL)
  ├─ updatePaymentStatus
  └─ addCredits to user balance
```

### 4. PHI Anonymization Chain

```
Input text / image
       │
       ▼
Level 1: Browser-side regex (lib/anonymization.ts)
  └─ Names, dates, IDs, phones, addresses → [REDACTED]
       │
       ▼
Level 2: Image canvas redaction
  └─ Black bars on edges + manual brush (ImageEditor)
       │
       ▼
Level 3: Server-side strip before OpenRouter
  └─ anonymizeObject() — recursive PHI scrub on all request fields
```

---

## 🗄️ Database Schema (PostgreSQL)

```sql
-- Users & Authentication (managed by NextAuth)
users (id, email, name, password_hash, created_at)

-- Credit System
user_balance (user_id, credits, package_name, package_price_usd,
              purchase_date, created_at)

transactions (id, user_id, type, amount, description, specialty,
              model_used, tokens_in, tokens_out, created_at)

-- Payments
payments (id, user_id, order_id, package_id, amount_usd, status,
          provider, created_at, updated_at)

-- Feedback & Fine-tuning data
feedback (id, user_id, analysis_type, specialty, correctness,
          correct_diagnosis, comment, consent_given, created_at)
```

---

## 🤖 AI Model Routing

| Use Case | Recommended Model | Reason |
|---|---|---|
| General X-Ray / MRI | GPT-5.6 Terra | Best visual accuracy (80% of cases) |
| Fractures / Bone pathology | Claude Sonnet 5 | 83% accuracy on skeletal studies |
| Complex cases / Genetics | Claude Opus 5 | Deep clinical reasoning |
| OCR / Data extraction | Gemini 3 Flash | Speed + cost efficiency |
| Clinical guidelines search | Claude Opus 5 | Synthesis + evidence depth |
| Voice protocol generation | GPT-5.6 Terra or Sonnet 5 | Structured output quality |

---

## 🛡️ Security Architecture

### Authentication
- **NextAuth v4** with JWT strategy
- All API routes protected by session middleware
- Passwords hashed with bcrypt

### API Protection
- Rate limiting at Nginx level
- PostgreSQL `SELECT ... FOR UPDATE` on all balance deductions (no race conditions)
- HMAC verification on all payment webhooks

### Data Isolation
- **Patient data:** IndexedDB (browser-local only) — never leaves the device
- **Medical images:** Processed in browser memory, anonymized before API call
- **AI results:** Ephemeral — stored only on user request in IndexedDB
- **Cloud DB:** Only stores user accounts, credit balances, transactions, and feedback

---

## 🐳 Deployment

```
Internet
   │
   ▼
Nginx (SSL termination, reverse proxy)
   │
   ▼
Next.js App (Docker container, port 3000)
   │
   ├─► PostgreSQL (Neon cloud or self-hosted)
   ├─► OpenRouter API (AI models)
   ├─► AssemblyAI API (voice transcription)
   └─► NOWPayments API (billing)
```

### Docker Compose Services
- `medical-assistant` — Next.js application
- `nginx` — Reverse proxy with SSL

### Key Environment Variables
```env
OPENROUTER_API_KEY
POSTGRES_URL
NEXTAUTH_SECRET
NEXTAUTH_URL=https://doctor-opus.online
ASSEMBLYAI_API_KEY
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
MIGRATION_SECRET
ENCRYPTION_SALT
```

---

## 📦 Key Dependencies

| Package | Purpose |
|---|---|
| `next` 14 | Framework |
| `next-auth` | Authentication |
| `pg` | PostgreSQL client |
| `openai` | OpenRouter API client |
| `docx` + `file-saver` | Word document generation |
| `cornerstone-core` | DICOM viewer |
| `pdfjs-dist` | PDF parsing (browser) |
| `mammoth` | Word document parsing |
| `idb` | IndexedDB wrapper |
| `bcryptjs` | Password hashing |
| `tailwindcss` | Styling |
