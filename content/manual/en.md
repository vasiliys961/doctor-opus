# 📘 Doctor Opus — Physician User Guide

> **Important:** Doctor Opus is a Clinical Decision Support System (CDSS) for **licensed healthcare professionals only**. It is not FDA-approved and does not constitute a medical diagnosis. All AI-generated outputs require independent clinical verification. You bear full responsibility for all clinical decisions.

Doctor Opus accelerates your clinical workflow by providing AI-assisted interpretation of medical imaging, lab data, genetic reports, and clinical notes. Each section contains contextual tips — review them on first use.

The application runs on desktop and mobile. Both can work independently or in tandem via the cross-device sync module.

---

## 📱 Install as a Mobile App (PWA)

The platform is a Progressive Web App — install it on your home screen for native-like access.

### iPhone (Safari)
1. Open **doctor-opus.online** in **Safari**
2. Tap the **Share** button (square with arrow) at the bottom
3. Scroll down and select **"Add to Home Screen"**
4. Tap **"Add"** in the top-right corner
5. Done — the Doctor Opus icon will appear on your home screen

### Android (Chrome)
1. Open **doctor-opus.online** in **Chrome**
2. Tap the **three-dot menu** (⋮) in the top-right corner
3. Select **"Add to Home Screen"** or **"Install App"**
4. Confirm installation
5. Done — the icon will appear on your home screen

Once installed, the app opens full-screen, is accessible via icon, and works even with a poor connection (except AI features that require the network).

---

## 🏠 Home

Overview dashboard with quick navigation to all sections.

---

## 🤖 AI Assistant

The core intelligence of the platform. Supports open-ended clinical dialogue, case discussion, differential diagnosis, literature review, and multi-file analysis.

**Available models (dropdown):**
- **GPT-5.6 Terra** — Best for 80% of imaging, MRI, and general clinical questions. Concise and efficient.
- **Claude Opus 5** — Deepest reasoning. Best for complex cases, genetics, and rare pathologies. Slower, higher cost.
- **Claude Sonnet 5** — Balanced. Excellent for quick consultations and fracture assessment.
- **Gemini 3 Flash** — Fastest. Ideal for quick reference and data extraction.

**The assistant can:**
- Answer clinical questions and sustain multi-turn dialogue
- Accept results exported from any other section
- Specialize as a consultant (Cardiologist, Neurologist, Orthopedist, etc.)
- Perform literature review and evidence-based searches
- Process uploaded files (images, PDFs, Word documents)
- Use your **Personal Library** (RAG) — when enabled, the assistant draws answers from your own uploaded PDF guidelines and references

**PHI reminder:** Do not enter patient names, dates of birth, or other identifying information in the chat. Use anonymized descriptions (e.g., *"65 y.o. male, smoker, 3-week cough"*).

---

## 📚 Personal Library (RAG)

Upload your own PDF clinical guidelines, textbooks, and atlases. Once processed, the AI Assistant can search them and cite relevant excerpts directly in the analysis output.

- Capacity: up to ~1 GB (larger collections may slow the browser on low-end hardware)
- Files are processed on your **local server** — not sent to external services
- Use text-searchable PDFs (not scans) for best results

---

## 📝 Clinical Protocol (Voice-to-Note)

Converts unstructured dictation or typed notes into a structured, specialty-specific clinical note — ready to download as a **Word (.docx)** file, edit, and sign.

### How to use
1. Select your **specialty** from the dropdown (Cardiology, Neurology, Orthopedics, etc.)
2. Dictate or type the encounter notes in any order — the AI structures them automatically
3. Click **Generate Protocol** — the formatted note appears in the right panel
4. Download as `.docx`, review, and sign

**Note structure follows SOAP / H&P format:**
- **S** — Subjective (CC, HPI, PMH, medications, allergies)
- **O** — Objective (vitals, PE findings)
- **A** — Assessment (working diagnosis, differential)
- **P** — Plan (diagnostics, treatment, follow-up)

You can customize any template to match your workflow. The customized version can be pinned as your personal standard.

**Recommended models:** GPT-5.6 Terra or Claude Sonnet 5.

---

## 🧮 Medical Calculators

Launches an integrated third-party calculator suite. Runs client-side — no credits consumed, no data transmitted.

---

## 📋 Clinical Guidelines

Search current international clinical guidelines by condition, syndrome, or drug class.

**Search depth options:**
- **Standard** — concise protocol summary with key recommendations
- **Clinical Review** — deep analysis: differential, scoring scales (CHADS₂, Wells, CURB-65, etc.), step-by-step management, treatment algorithms
- **Real-time Search** — latest 2024–2025 publications with source links

After receiving results, you can continue the conversation with follow-up questions in context.

---

## 🔬 Specialized Analysis Modules

### 📈 ECG Analysis

**Workflow:**
1. Upload an ECG image (JPG, PNG, or PDF scan)
2. Add **clinical context** (CC, HPI, relevant medications) — significantly improves accuracy
3. Use the **🛡️ anonymization buttons** before submitting:
   - **Quick:** Auto-redacts edges and corners
   - **Precision:** Brush editor for exact redaction
4. Select analysis mode (Fast / Optimized / Expert Validated)

**Additional tools:**
- **Digital Caliper:** Drag blue markers to measure PR, QRS, QT intervals. Calibrate using the ECG grid (1 sec = 5 large cells at 25 mm/s)
- **Search Library:** After analysis, click to find matching cases or descriptions in your personal PDF library

**Recommended models:** GPT-5.6 Terra (general) · Claude Sonnet 5 (arrhythmia detail)

---

### 🩻 X-Ray Analysis

Upload single or multiple images (folder or DICOM series). Add clinical context for significantly better output.

**Anonymization:**
- Quick: auto-redacts standard PHI zones
- Precision: manual brush editor
- DICOM: metadata stripped automatically

**Comparison mode:** Enable **Before/After** to compare two time points or views side-by-side.

**Best models:** GPT-5.6 Terra (80% of cases) · Claude Sonnet 5 (fractures, 83% accuracy)

---

### 🧠 CT Analysis

Upload CT images or an entire DICOM folder.

**3D Viewer (DICOM series):**
- **MPR 2×2:** Axial / Coronal / Sagittal slices + volumetric model
- **Cinematic 3D ✨:** Full-screen photorealistic rendering with soft shadows
- **Clinical presets:** Bone, Soft tissue (X-ray effect), Glow (highlights pathological foci)
- Scroll slices with mouse wheel · Zoom · Free 3D rotation
- M1 chip: hardware-accelerated rendering

PHI anonymization: manual and automatic (DICOM metadata auto-stripped).

---

### 🧠 MRI Analysis

Identical workflow to CT. Supports multi-sequence DICOM series with full MPR and Cinematic 3D rendering.

---

### 🔊 Ultrasound Analysis (Cine-loop)

Upload a static image **or** a video loop (cine-loop).

**Frame extraction:**
- **Auto-Extract:** System automatically extracts 5–12 key frames
- **Manual Capture:** Step through with ±0.1s buttons and capture the exact frame

All frames are anonymized before submission (black bars on edges).

---

### 🔬 Dermatoscopy Analysis

Upload dermatoscopy images. Add clinical context (lesion location, duration, observed changes). Supports ABCDE criteria analysis and malignancy risk assessment.

---

### 🧪 Laboratory Data Analysis

Upload a lab report (PDF, Excel, CSV, or photo of a paper form).

**Smart extraction:** System automatically recognizes parameters, values, and reference ranges — even from multi-page PDFs or handwritten forms.

**Analysis output includes:**
- Critical value flagging
- Clinical interpretation in the context of provided HPI
- Trend graphs (if patient is in your database)

---

### 🧬 Genetic Analysis

Upload a genetic report in **.VCF** format (raw lab output) or **PDF**.

**Workflow:**
1. Upload file
2. **Stage 1 (Extract):** Gemini 3 Flash extracts rsIDs and genotypes from the report
3. **Stage 2 (Interpret):** Claude Opus 5 provides clinical risk interpretation
4. Continue dialogue with the Genetics specialist for follow-up questions

Always anonymize before submitting (name and address auto-redacted on the preview screen).

---

### 🎬 Video Clinical Analysis

Upload any video file (patient gait, endoscopy, echocardiography, ultrasound loop, etc.).

**Two modes:**

| Mode | Description | Use when |
|---|---|---|
| **Safe (frame extraction)** | System extracts 5–12 frames, anonymizes each, shows preview | Default — any video with or without PHI |
| **Full video** | Entire file sent unprocessed | Only for already-anonymized files |

> ⚠️ In Full Video mode, frames are NOT anonymized automatically. Confirm absence of PHI before using.

---

### 🔍 Comparative Analysis

Side-by-side comparison of medical images across time or location.

**Comparison modes:**
- **Over Time** — progression assessment (before/after treatment)
- **By Location** — comparing scans of different anatomical regions
- **General** — free-form multi-image comparison

Supports both single images and video/DICOM folder batches.

---

### 🔬 Advanced Analysis (Image + Context)

Upload a primary image plus optional additional files (PDFs, Word documents, photos). Add detailed clinical context. Receive a unified clinical directive combining all inputs.

---

### 🧊 Advanced 3D Visualization (Cinematic)

Dedicated high-fidelity volumetric rendering for MRI and CT DICOM series.

- **Cinematic Mode:** Volume scattering for photorealistic organ rendering
- **Vessel Highlight:** Vessels and contrast-enhanced areas shown in red; surrounding tissue becomes semi-transparent
- **Adaptive quality:** Lower resolution while rotating for smooth performance; restores to HQ at rest
- **Apple M1 optimization:** Automatic downsampling for heavy studies to maintain frame rate

---

## 📄 Document Scanning

Turns your smartphone camera into a document scanner.

### Local Copier (browser mode)
Works entirely in your browser — no AI, no internet required. 100% private.

**Features:**
- Brightness, contrast, and grayscale adjustments
- Export to **Word (.docx)** or **PDF** (via system print dialog)
- Free — no credits consumed

### Smart OCR (AI mode)
Extracts text and tables from scanned documents for further processing.

**PHI protection:**
- Mandatory anonymization toggle
- Auto-redaction of names and addresses when enabled
- **🎨 Manual Redact** editor: paint over any sensitive area before submitting

---

## 👥 Patient Database

Local patient records stored in your **browser's IndexedDB** — data never leaves your device.

**Features:**
- Add patients with name (anonymized alias recommended), age, gender, diagnosis, notes
- Save analysis results to patient records from any analysis section
- View analysis history, timeline, and lab value trend charts
- AI case summary: one-click narrative summary of all saved analyses for a patient

---

## 🔌 Direct Device Connection (USB)

Read data from ECG monitors, pulse oximeters, glucometers, and other serial-interface devices directly through the browser — no drivers required.

1. Go to the **Devices** section
2. Select baud rate (usually 115200)
3. Click **Connect** and select your device from the browser prompt (Chrome / Edge only)
4. View live ECG curve or sensor data
5. Click **Analyze fragment** for immediate AI interpretation of the current segment

---

## 🛡️ Privacy & Data Handling

Doctor Opus is built on a **Local-First** principle — patient data stays on your device.

| Data type | Storage location | Leaves the device? |
|---|---|---|
| Patient cards & analysis history | Browser IndexedDB | Never |
| Medical images during analysis | Browser RAM | Only anonymized fragments |
| AI results (saved) | Browser IndexedDB | No |
| User account & credit balance | Cloud PostgreSQL | Yes (no medical data) |
| Analysis statistics (anonymized) | Cloud PostgreSQL | Yes (no PHI) |

**Three-level anonymization before any AI call:**
1. Browser-side text regex — names, dates, IDs stripped
2. Image canvas redaction — PHI zones painted black
3. Server-side recursive scrub — all request fields cleaned before OpenRouter

No Personal Health Information (PHI) or Personally Identifiable Information (PII) linked to medical scans is stored in the cloud database.

---

## 💰 Credit System

Credits are consumed when using advanced AI models. Simple reference lookups and local tools are free.

| Operation | Credit cost (approx.) |
|---|---|
| Fast analysis (Gemini 3 Flash) | ~0.3 – 0.8 cr. |
| Optimized analysis (Sonnet 5) | ~0.8 – 1.5 cr. |
| Expert Validated (Opus 5 / GPT-5.6 Terra) | ~1.5 – 3.5 cr. |
| PDF page (Vision processing) | ~0.3 cr. per page |
| Local copier / calculators | Free |

**Packages:**
- **Starter:** 50 credits — $9.99
- **Standard:** 150 credits — $24.99
- **Pro:** 500 credits — $69.99

Exact cost of each request is shown in the result block immediately after analysis completes. Full transaction history is available in **Balance & History**.

---

## 💡 Tips for Best Results

- Always add **clinical context** (CC, HPI, key PMH) — it significantly improves relevance and accuracy
- Use **text-searchable PDFs** (not image scans) for the Personal Library
- For ECG: use **Claude Sonnet 5** in Optimized mode for arrhythmia detail
- For fractures: **Claude Sonnet 5** outperforms other models (83% accuracy)
- For complex genetics or rare pathology: use **Claude Opus 5** (Expert Validated mode)
- The system improves over time through your feedback — please rate AI responses after tests
