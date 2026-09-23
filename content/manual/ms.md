# 📘 Doctor Opus — Panduan Pengguna Pakar Perubatan

> **Penting:** Doctor Opus ialah perisian beta Sokongan Keputusan Klinikal (CDSS) untuk **profesional penjagaan kesihatan berlesen sahaja**. Ia bukan peranti perubatan dan tidak memberikan diagnosis akhir atau arahan rawatan. Kualiti output AI bergantung pada keupayaan LLM pihak ketiga dan mungkin tidak lengkap atau kurang tepat. Semua output AI memerlukan pengesahan perubatan bebas oleh doktor. Had penggunaan: tidak bertujuan untuk penggunaan klinikal terkawal di bidang kuasa EU/AS/UK. Anda memikul tanggungjawab penuh untuk semua keputusan klinikal.

Doctor Opus mempercepatkan aliran kerja klinikal anda dengan menyediakan tafsiran berbantu AI untuk pengimejan perubatan, data makmal, laporan genetik dan nota klinikal. Setiap bahagian mengandungi petua kontekstual — semak petua tersebut pada penggunaan pertama.

Aplikasi ini berjalan pada desktop dan mudah alih. Kedua-duanya boleh berfungsi secara bebas atau seiring melalui modul penyegerakan merentas peranti.

---

## 📱 Pasang sebagai Aplikasi Mudah Alih (PWA)

Platform ini ialah Aplikasi Web Progresif (PWA) — pasangkannya pada skrin utama anda untuk akses seperti aplikasi asli.

### iPhone (Safari)
1. Buka **doctor-opus.online** dalam **Safari**
2. Ketik butang **Kongsi** (segi empat dengan anak panah) di bahagian bawah
3. Tatal ke bawah dan pilih **"Tambah ke Skrin Utama"**
4. Ketik **"Tambah"** di sudut kanan atas
5. Selesai — ikon Doctor Opus akan muncul pada skrin utama anda

### Android (Chrome)
1. Buka **doctor-opus.online** dalam **Chrome**
2. Ketik **menu tiga titik** (⋮) di sudut kanan atas
3. Pilih **"Tambah ke Skrin Utama"** atau **"Pasang Apl"**
4. Sahkan pemasangan
5. Selesai — ikon akan muncul pada skrin utama anda

Setelah dipasang, aplikasi dibuka dalam skrin penuh, boleh diakses melalui ikon, dan berfungsi walaupun dengan sambungan yang lemah (kecuali ciri AI yang memerlukan rangkaian).

---

## 🏠 Laman Utama

Papan pemuka gambaran keseluruhan dengan navigasi pantas ke semua bahagian.

---

## ⚖️ Aliran undang-undang wajib

Selepas log masuk pertama (atau selepas versi dokumen undang-undang dikemas kini), anda wajib mengesahkan penerimaan undang-undang sebelum menggunakan modul klinikal.

Semasa menyimpan hasil AI ke rekod pesakit:
- Tetingkap pengesahan doktor akan dipaparkan
- Anda perlu mengesahkan semakan peribadi dan tanggungjawab klinikal
- Log audit hanya menyimpan pengecam kes serta metadata pengesahan/hash (tiada data peribadi pesakit dihantar)

---

## 🤖 Pembantu AI

Teras kecerdasan platform ini. Menyokong dialog klinikal terbuka, perbincangan kes, diagnosis pembezaan, tinjauan literatur, dan analisis pelbagai fail.

**Model yang tersedia (dropdown):**
- **GPT-5.6 Terra** — Terbaik untuk 80% pengimejan, MRI, dan soalan klinikal umum. Ringkas dan cekap.
- **Claude Opus 5.5** — Penaakulan paling mendalam. Terbaik untuk kes kompleks, genetik, dan patologi jarang berlaku. Lebih perlahan, kos lebih tinggi.
- **Claude Sonnet 5** — Seimbang. Cemerlang untuk perundingan pantas dan penilaian patah tulang.
- **Gemini 3 Flash** — Paling pantas. Ideal untuk rujukan pantas dan pengekstrakan data.

**Pembantu boleh:**
- Menjawab soalan klinikal dan mengekalkan dialog berbilang pusingan
- Menerima keputusan yang dieksport dari mana-mana bahagian lain
- Menjadi pakar sebagai perunding (Kardiologi, Neurologi, Ortopedik, dll.)
- Menjalankan tinjauan literatur dan carian berasaskan bukti
- Memproses fail yang dimuat naik (imej, PDF, dokumen Word)
- Menggunakan **Perpustakaan Peribadi** (RAG) anda — apabila diaktifkan, pembantu mengambil jawapan daripada garis panduan dan rujukan PDF yang anda muat naik sendiri

**Peringatan PHI:** Jangan masukkan nama pesakit, tarikh lahir, atau maklumat pengenalan lain dalam sembang. Gunakan huraian tanpa nama (cth., *"Lelaki 65 tahun, perokok, batuk selama 3 minggu"*).

---

## 📚 Perpustakaan Peribadi (RAG)

Muat naik garis panduan klinikal PDF, buku teks, dan atlas anda sendiri. Setelah diproses, Pembantu AI boleh mencarinya dan memetik petikan berkaitan secara langsung dalam output analisis.

- Kapasiti: sehingga ~1 GB (koleksi yang lebih besar mungkin memperlahankan pelayar pada perkakasan spesifikasi rendah)
- Fail diproses pada **pelayan tempatan** anda — tidak dihantar ke perkhidmatan luaran
- Gunakan PDF yang boleh dicari teks (bukan imbasan) untuk keputusan terbaik

---

## 📝 Protokol Klinikal (Suara-ke-Nota)

Menukar imlak tidak berstruktur atau nota bertaip kepada nota klinikal berstruktur khusus kepakaran — sedia untuk dimuat turun sebagai fail **Word (.docx)**, diedit, dan ditandatangani.

### Cara penggunaan
1. Pilih **kepakaran** anda daripada menu dropdown (Kardiologi, Neurologi, Ortopedik, dll.)
2. Imlak atau taip nota pertemuan dalam sebarang urutan — AI menyusunnya secara automatik
3. Klik **Generate Protocol** — nota berformat muncul di panel kanan
4. Muat turun sebagai `.docx`, semak, dan tandatangan

**Struktur nota mengikut format SOAP / H&P:**
- **S** — Subjektif (CC, HPI, PMH, ubat-ubatan, alahan)
- **O** — Objektif (tanda vital, penemuan PE)
- **A** — Penilaian (diagnosis kerja, pembezaan)
- **P** — Pelan (diagnostik, rawatan, susulan)

Anda boleh menyesuaikan mana-mana templat untuk memadankan aliran kerja anda. Versi yang disesuaikan boleh disematkan sebagai standard peribadi anda.

**Model disyorkan:** GPT-5.6 Terra atau Claude Sonnet 5.

---

## 🧮 Kalkulator Perubatan

Melancarkan set kalkulator pihak ketiga yang bersepadu. Berjalan pada sisi pelanggan — tiada kredit digunakan, tiada data dihantar.

---

## 📋 Garis Panduan Klinikal

Cari garis panduan klinikal antarabangsa semasa mengikut keadaan, sindrom, atau kelas ubat.

**Pilihan kedalaman carian:**
- **Standard** — ringkasan protokol padat dengan cadangan utama
- **Clinical Review** — analisis mendalam: pembezaan, skala pemarkahan (CHADS₂, Wells, CURB-65, dll.), pengurusan langkah demi langkah, algoritma rawatan
- **Real-time Search** — penerbitan terbaharu 2024–2025 dengan pautan sumber

Selepas menerima keputusan, anda boleh meneruskan perbualan dengan soalan susulan dalam konteks.

---

## 🔬 Modul Analisis Khusus

### 📈 Analisis ECG

**Aliran kerja:**
1. Muat naik imej ECG (imbasan JPG, PNG, atau PDF)
2. Tambah **konteks klinikal** (CC, HPI, ubat-ubatan berkaitan) — meningkatkan ketepatan secara ketara
3. Gunakan **butang perlindungan 🛡️ (anonymization)** sebelum menghantar:
   - **Quick:** Memadam tepi dan sudut secara automatik
   - **Precision:** Editor berus untuk pemadaman tepat
4. Pilih mod analisis (Fast / Optimized / Expert Validated)

**Alatan tambahan:**
- **Digital Caliper:** Seret penanda biru untuk mengukur selang PR, QRS, QT. Kalibrasi menggunakan grid ECG (1 saat = 5 kotak besar pada 25 mm/s)
- **Search Library:** Selepas analisis, klik untuk mencari kes atau huraian yang sepadan dalam perpustakaan PDF peribadi anda

**Model disyorkan:** GPT-5.6 Terra (umum) · Claude Sonnet 5 (perincian aritmia)

---

### 🩻 Analisis X-Ray

Muat naik imej tunggal atau berbilang (folder atau siri DICOM). Tambah konteks klinikal untuk output yang jauh lebih baik.

**Tanpa Nama (Anonymization):**
- Quick: memadam zon PHI standard secara automatik
- Precision: editor berus manual
- DICOM: metadata dibuang secara automatik

**Mod perbandingan:** Dayakan **Before/After** untuk membandingkan dua titik masa atau pandangan secara bersebelahan.

**Model terbaik:** GPT-5.6 Terra (80% kes) · Claude Sonnet 5 (patah tulang, ketepatan 83%)

---

### 🧠 Analisis CT

Muat naik imej CT atau keseluruhan folder DICOM.

**Pelihat 3D (siri DICOM):**
- **MPR 2×2:** Hirisan Aksial / Koronal / Sagital + model volumetrik
- **Cinematic 3D ✨:** Render fotorealistik skrin penuh dengan bayang lembut
- **Pratetap klinikal:** Tulang, Tisu lembut (kesan X-ray), Glow (menyerlahkan fokus patologi)
- Tatal hirisan dengan roda tetikus · Zum · Putaran 3D bebas
- Cip M1: rendering dipercepatkan perkakasan

Tanpa nama PHI: manual dan automatik (metadata DICOM dibuang secara automatik).

---

### 🧠 Analisis MRI

Aliran kerja yang sama dengan CT. Menyokong siri DICOM berbilang jujukan dengan MPR penuh dan rendering Cinematic 3D.

---

### 🔊 Analisis Ultrabunyi (Cine-loop)

Muat naik imej statik **atau** gelung video (cine-loop).

**Pengekstrakan bingkai:**
- **Auto-Extract:** Sistem mengekstrak 5–12 bingkai utama secara automatik
- **Manual Capture:** Langkah demi langkah dengan butang ±0.1s dan tangkap bingkai yang tepat

Semua bingkai dijadikan tanpa nama sebelum penghantaran (bar hitam pada tepi).

---

### 🔬 Analisis Dermatoskopi

Muat naik imej dermatoskopi. Tambah konteks klinikal (lokasi lesi, tempoh, perubahan yang diperhatikan). Menyokong analisis kriteria ABCDE dan penilaian risiko keganasan.

---

### 🧪 Analisis Data Makmal

Muat naik laporan makmal (PDF, Excel, CSV, atau foto borang kertas).

**Pengekstrakan pintar:** Sistem secara automatik mengecam parameter, nilai, dan julat rujukan — walaupun daripada PDF berbilang halaman atau borang tulisan tangan.

**Output analisis termasuk:**
- Penandaan nilai kritikal
- Tafsiran klinikal dalam konteks HPI yang disediakan
- Graf trend (jika pesakit berada dalam pangkalan data anda)

---

### 🧬 Analisis Genetik

Muat naik laporan genetik dalam format **.VCF** (output makmal mentah) atau **PDF**.

**Aliran kerja:**
1. Muat naik fail
2. **Tahap 1 (Ekstrak):** Gemini 3 Flash mengekstrak rsID dan genotip daripada laporan
3. **Tahap 2 (Tafsir):** Claude Opus 5.5 menyediakan tafsiran risiko klinikal
4. Teruskan dialog dengan pakar Genetik untuk soalan susulan

Sentiasa jadikan tanpa nama sebelum menghantar (nama dan alamat dipadam secara automatik pada skrin pratonton).

---

### 🎬 Analisis Klinikal Video

Muat naik sebarang fail video (gaya jalan pesakit, endoskopi, ekokardiografi, gelung ultrabunyi, dll.).

**Dua mod:**

| Mod | Huraian | Gunakan apabila |
|---|---|---|
| **Safe (pengekstrakan bingkai)** | Sistem mengekstrak 5–12 bingkai, memadam maklumat peribadi setiap satu, menunjukkan pratonton | Lalai — sebarang video dengan atau tanpa PHI |
| **Full video** | Keseluruhan fail dihantar tanpa diproses | Hanya untuk fail yang sudah dibersihkan maklumat peribadinya |

> ⚠️ Dalam mod Video Penuh, bingkai TIDAK dipadam maklumat peribadinya secara automatik. Sahkan ketiadaan PHI sebelum menggunakan.

---

### 🔍 Analisis Perbandingan

Perbandingan bersebelahan imej perubatan merentas masa atau lokasi.

**Mod perbandingan:**
- **Over Time** — penilaian perkembangan (sebelum/selepas rawatan)
- **By Location** — membandingkan imbasan kawasan anatomi yang berbeza
- **General** — perbandingan berbilang imej bentuk bebas

Menyokong kedua-dua imej tunggal dan kumpulan video/folder DICOM.

---

### 🔬 Analisis Lanjutan (Imej + Konteks)

Muat naik imej utama ditambah fail tambahan pilihan (PDF, dokumen Word, foto). Tambah konteks klinikal terperinci. Terima arahan klinikal bersatu yang menggabungkan semua input.

---

### 🧊 Visualisasi 3D Lanjutan (Cinematic)

Rendering volumetrik kesetiaan tinggi khusus untuk siri DICOM MRI dan CT.

- **Cinematic Mode:** Serakan volum untuk rendering organ fotorealistik
- **Vessel Highlight:** Salur darah dan kawasan dipertingkatkan kontras ditunjukkan dalam warna merah; tisu sekeliling menjadi separa lutsinar
- **Kualiti adaptif:** Resolusi lebih rendah semasa berputar untuk prestasi lancar; kembali ke HQ semasa pegun
- **Pengoptimuman Apple M1:** Downsampling automatik untuk kajian berat bagi mengekalkan kadar bingkai

---

## 📄 Pengimbasan Dokumen

Menukarkan kamera telefon pintar anda menjadi pengimbas dokumen.

### Penyalin Tempatan (mod pelayar)
Berfungsi sepenuhnya dalam pelayar anda — tiada AI, tiada internet diperlukan. 100% peribadi.

**Ciri-ciri:**
- Pelarasan kecerahan, kontras, dan skala kelabu
- Eksport ke **Word (.docx)** atau **PDF** (melalui dialog cetak sistem)
- Percuma — tiada kredit digunakan

### OCR Pintar (mod AI)
Mengekstrak teks dan jadual daripada dokumen yang diimbas untuk pemprosesan lanjut.

**Perlindungan PHI:**
- Togol pemadaman maklumat peribadi mandatori
- Pemadaman automatik nama dan alamat apabila diaktifkan
- Editor **🎨 Manual Redact**: cat di atas mana-mana kawasan sensitif sebelum menghantar

---

## 👥 Pangkalan Data Pesakit

Rekod pesakit tempatan disimpan dalam **IndexedDB pelayar** anda — data tidak pernah meninggalkan peranti anda.

**Ciri-ciri:**
- Tambah pesakit dengan nama (alias tanpa nama disyorkan), umur, jantina, diagnosis, nota
- Simpan keputusan analisis ke rekod pesakit dari mana-mana bahagian analisis
- Lihat sejarah analisis, garis masa, dan carta trend nilai makmal
- Ringkasan kes AI: ringkasan naratif satu klik bagi semua analisis yang disimpan untuk seseorang pesakit

---

## 🔌 Sambungan Peranti Terus (USB)

Baca data daripada monitor ECG, oksimeter nadi, glukometer, dan peranti antara muka bersiri lain secara terus melalui pelayar — tiada pemacu diperlukan.

1. Pergi ke bahagian **Devices**
2. Pilih kadar baud (biasanya 115200)
3. Klik **Connect** dan pilih peranti anda daripada gesaan pelayar (Chrome / Edge sahaja)
4. Lihat lengkung ECG langsung atau data penderia
5. Klik **Analyze fragment** untuk tafsiran AI segera bagi segmen semasa

---

## 🛡️ Privasi & Pengendalian Data

Doctor Opus dibina atas prinsip **Local-First** — data pesakit kekal pada peranti anda.

| Jenis data | Lokasi penyimpanan | Meninggalkan peranti? |
|---|---|---|
| Kad pesakit & sejarah analisis | IndexedDB Pelayar | Tidak pernah |
| Imej perubatan semasa analisis | RAM Pelayar | Hanya fragmen tanpa nama |
| Keputusan AI (disimpan) | IndexedDB Pelayar | Tidak |
| Akaun pengguna & baki kredit | PostgreSQL Awan | Ya (tiada data perubatan) |
| Statistik analisis (tanpa nama) | PostgreSQL Awan | Ya (tiada PHI) |

**Tiga tahap pemadaman maklumat peribadi sebelum sebarang panggilan AI:**
1. Regex teks sisi pelayar — nama, tarikh, ID dibuang
2. Pemadaman kanvas imej — zon PHI dicat hitam
3. Pembersihan rekursif sisi pelayan — semua medan permintaan dibersihkan sebelum OpenRouter

Tiada Maklumat Kesihatan Peribadi (PHI) atau Maklumat Pengenalan Peribadi (PII) yang dikaitkan dengan imbasan perubatan disimpan dalam pangkalan data awan.

---

## 💰 Sistem Kredit

Kredit digunakan apabila menggunakan model AI lanjutan. Carian rujukan mudah dan alatan tempatan adalah percuma.

| Operasi | Kos kredit (anggaran) |
|---|---|
| Analisis pantas (Gemini 3 Flash) | ~0.3 – 0.8 kr. |
| Analisis dioptimumkan (Sonnet 5) | ~0.8 – 1.5 kr. |
| Pengesahan Pakar (Opus 5.5 / GPT-5.6 Terra) | ~1.5 – 3.5 kr. |
| Halaman PDF (Pemprosesan Visi) | ~0.3 kr. setiap halaman |
| Penyalin tempatan / kalkulator | Percuma |

**Pakej:**
- **Starter:** 50 kredit — $6.99
- **Standard:** 180 kredit — $19.99
- **Pro:** 600 kredit — $59.99

**Aliran pembayaran (semasa):**
- Pilih pakej di halaman Langganan
- Hantar jumlah USDT yang tepat melalui **TRON (TRC20)** ke dompet yang dipaparkan pada invois
- Tampal hash transaksi (`txHash`) untuk pengesahan pembayaran automatik
- Kredit akan ditambah selepas transaksi disahkan

Tiada kredit percubaan untuk ciri AI.

Kos tepat bagi setiap permintaan ditunjukkan dalam blok keputusan sejurus selepas analisis selesai. Sejarah transaksi penuh tersedia dalam **Balance & History**.

---

## 💡 Petua untuk Keputusan Terbaik

- Sentiasa tambah **konteks klinikal** (CC, HPI, PMH utama) — ia meningkatkan kaitan dan ketepatan secara ketara
- Gunakan **PDF yang boleh dicari teks** (bukan imbasan imej) untuk Perpustakaan Peribadi
- Untuk ECG: gunakan **Claude Sonnet 5** dalam mod Optimized untuk perincian aritmia
- Untuk patah tulang: **Claude Sonnet 5** mengatasi model lain (ketepatan 83%)
- Untuk genetik kompleks atau patologi jarang: gunakan **Claude Opus 5.5** (mod Expert Validated)
- Sistem bertambah baik dari semasa ke semasa melalui maklum balas anda — sila nilaikan respons AI selepas ujian
