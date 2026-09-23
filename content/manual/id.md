# 📘 Doctor Opus — Panduan Pengguna Dokter

> **Penting:** Doctor Opus adalah perangkat lunak beta Pendukung Keputusan Klinis (CDSS) **hanya untuk tenaga kesehatan berlisensi**. Sistem ini bukan perangkat medis dan tidak memberikan diagnosis akhir atau instruksi terapi. Kualitas keluaran AI bergantung pada kemampuan LLM pihak ketiga dan dapat tidak lengkap atau kurang akurat. Semua hasil AI memerlukan verifikasi medis independen oleh dokter. Batasan penggunaan: tidak ditujukan untuk penerapan klinis teregulasi di yurisdiksi UE/AS/Inggris. Anda memegang tanggung jawab penuh atas semua keputusan klinis.

Doctor Opus mempercepat alur kerja klinis Anda dengan menyediakan interpretasi berbantuan AI untuk pencitraan medis, data laboratorium, laporan genetik, dan catatan klinis. Setiap bagian berisi tips kontekstual — tinjau kembali pada penggunaan pertama.

Aplikasi ini berjalan di desktop dan seluler. Keduanya dapat bekerja secara independen atau bersamaan melalui modul sinkronisasi lintas perangkat.

---

## 📱 Instal sebagai Aplikasi Seluler (PWA)

Platform ini adalah Progressive Web App — instal di layar utama Anda untuk akses seperti aplikasi asli.

### iPhone (Safari)
1. Buka **doctor-opus.online** di **Safari**
2. Ketuk tombol **Bagikan** (kotak dengan panah) di bagian bawah
3. Gulir ke bawah dan pilih **"Tambah ke Layar Utama"**
4. Ketuk **"Tambah"** di sudut kanan atas
5. Selesai — ikon Doctor Opus akan muncul di layar utama Anda

### Android (Chrome)
1. Buka **doctor-opus.online** di **Chrome**
2. Ketuk **menu tiga titik** (⋮) di sudut kanan atas
3. Pilih **"Tambah ke Layar Utama"** atau **"Instal Aplikasi"**
4. Konfirmasi instalasi
5. Selesai — ikon akan muncul di layar utama Anda

Setelah diinstal, aplikasi terbuka layar penuh, dapat diakses melalui ikon, dan berfungsi bahkan dengan koneksi yang buruk (kecuali fitur AI yang memerlukan jaringan).

---

## 🏠 Beranda (Home)

Dasbor ringkasan dengan navigasi cepat ke semua bagian.

---

## ⚖️ Alur hukum wajib

Setelah login pertama (atau setelah versi dokumen hukum diperbarui), Anda wajib mengonfirmasi persetujuan hukum sebelum menggunakan modul klinis.

Saat menyimpan hasil AI ke rekam pasien:
- Muncul jendela verifikasi dokter
- Anda harus mengonfirmasi telaah pribadi dan tanggung jawab klinis
- Log audit hanya menyimpan pengenal kasus dan metadata konfirmasi/hash (tanpa mengirim data pribadi pasien)

---

## 🤖 Asisten AI

Inti kecerdasan dari platform ini. Mendukung dialog klinis terbuka, diskusi kasus, diagnosis banding, tinjauan literatur, dan analisis multi-file.

**Model yang tersedia (dropdown):**
- **GPT-5.6 Terra** — Terbaik untuk 80% pencitraan, MRI, dan pertanyaan klinis umum. Ringkas dan efisien.
- **Claude Opus 5.5** — Penalaran terdalam. Terbaik untuk kasus kompleks, genetika, dan patologi langka. Lebih lambat, biaya lebih tinggi.
- **Claude Sonnet 5** — Seimbang. Sangat baik untuk konsultasi cepat dan penilaian fraktur.
- **Gemini 3 Flash** — Tercepat. Ideal untuk referensi cepat dan ekstraksi data.

**Asisten dapat:**
- Menjawab pertanyaan klinis dan mempertahankan dialog multi-tahap
- Menerima hasil yang diekspor dari bagian lain mana pun
- Spesialisasi sebagai konsultan (Kardiolog, Neurolog, Ortopedi, dll.)
- Melakukan tinjauan literatur dan pencarian berbasis bukti
- Memproses file yang diunggah (gambar, PDF, dokumen Word)
- Menggunakan **Perpustakaan Pribadi** Anda (RAG) — jika diaktifkan, asisten mengambil jawaban dari pedoman dan referensi PDF yang Anda unggah sendiri

**Pengingat PHI:** Jangan masukkan nama pasien, tanggal lahir, atau informasi identitas lainnya dalam obrolan. Gunakan deskripsi anonim (misalnya, *"Laki-laki 65 thn, perokok, batuk 3 minggu"*).

---

## 📚 Perpustakaan Pribadi (RAG)

Unggah pedoman klinis PDF, buku teks, dan atlas Anda sendiri. Setelah diproses, Asisten AI dapat mencarinya dan mengutip kutipan yang relevan langsung dalam hasil analisis.

- Kapasitas: hingga ~1 GB (koleksi yang lebih besar dapat memperlambat browser pada perangkat keras spesifikasi rendah)
- File diproses di **server lokal** Anda — tidak dikirim ke layanan eksternal
- Gunakan PDF yang teksnya dapat dicari (bukan hasil scan gambar) untuk hasil terbaik

---

## 📝 Protokol Klinis (Suara-ke-Catatan)

Mengonversi dikte tidak terstruktur atau catatan yang diketik menjadi catatan klinis terstruktur khusus spesialisasi — siap diunduh sebagai file **Word (.docx)**, diedit, dan ditandatangani.

### Cara penggunaan
1. Pilih **spesialisasi** Anda dari dropdown (Kardiologi, Neurologi, Ortopedi, dll.)
2. Diktekan atau ketik catatan pertemuan dalam urutan apa pun — AI akan menyusunnya secara otomatis
3. Klik **Generate Protocol** — catatan yang diformat muncul di panel kanan
4. Unduh sebagai `.docx`, tinjau, dan tanda tangani

**Struktur catatan mengikuti format SOAP / H&P:**
- **S** — Subjektif (Keluhan Utama, RPD, obat-obatan, alergi)
- **O** — Objektif (tanda vital, temuan pemeriksaan fisik)
- **A** — Asesmen (diagnosis kerja, diagnosis banding)
- **P** — Plan/Rencana (diagnostik, pengobatan, tindak lanjut)

Anda dapat menyesuaikan templat apa pun agar sesuai dengan alur kerja Anda. Versi yang disesuaikan dapat disematkan sebagai standar pribadi Anda.

**Model yang direkomendasikan:** GPT-5.6 Terra atau Claude Sonnet 5.

---

## 🧮 Kalkulator Medis

Meluncurkan rangkaian kalkulator pihak ketiga yang terintegrasi. Berjalan di sisi klien — tidak mengonsumsi kredit, tidak ada data yang dikirimkan.

---

## 📋 Pedoman Klinis (Clinical Guidelines)

Cari pedoman klinis internasional terbaru berdasarkan kondisi, sindrom, atau kelas obat.

**Opsi kedalaman pencarian:**
- **Standar** — ringkasan protokol singkat dengan rekomendasi utama
- **Tinjauan Klinis** — analisis mendalam: diagnosis banding, skala penilaian (CHADS₂, Wells, CURB-65, dll.), manajemen langkah-demi-langkah, algoritma pengobatan
- **Pencarian Real-time** — publikasi terbaru 2024–2025 dengan tautan sumber

Setelah menerima hasil, Anda dapat melanjutkan percakapan dengan pertanyaan lanjutan dalam konteks tersebut.

---

## 🔬 Modul Analisis Spesialisasi

### 📈 Analisis EKG

**Alur kerja:**
1. Unggah gambar EKG (JPG, PNG, atau scan PDF)
2. Tambahkan **konteks klinis** (Keluhan Utama, RPD, obat-obatan relevan) — secara signifikan meningkatkan akurasi
3. Gunakan **tombol anonimisasi 🛡️** sebelum mengirim:
   - **Cepat:** Menghapus tepi dan sudut secara otomatis
   - **Presisi:** Editor kuas untuk penghapusan tepat
4. Pilih mode analisis (Cepat / Dioptimalkan / Validasi Ahli)

**Alat tambahan:**
- **Jangka Digital:** Seret penanda biru untuk mengukur interval PR, QRS, QT. Kalibrasi menggunakan kisi EKG (1 detik = 5 kotak besar pada 25 mm/s)
- **Cari Perpustakaan:** Setelah analisis, klik untuk menemukan kasus atau deskripsi yang cocok di perpustakaan PDF pribadi Anda

**Model yang direkomendasikan:** GPT-5.6 Terra (umum) · Claude Sonnet 5 (detail aritmia)

---

### 🩻 Analisis Rontgen (X-Ray)

Unggah satu atau beberapa gambar (folder atau seri DICOM). Tambahkan konteks klinis untuk hasil yang jauh lebih baik.

**Anonimisasi:**
- Cepat: menghapus zona PHI standar secara otomatis
- Presisi: editor kuas manual
- DICOM: metadata dihapus secara otomatis

**Mode perbandingan:** Aktifkan **Sebelum/Sesudah** untuk membandingkan dua titik waktu atau sudut pandang secara berdampingan.

**Model terbaik:** GPT-5.6 Terra (80% kasus) · Claude Sonnet 5 (fraktur, akurasi 83%)

---

### 🧠 Analisis CT Scan

Unggah gambar CT atau seluruh folder DICOM.

**Viewer 3D (seri DICOM):**
- **MPR 2×2:** Irisan Aksial / Koronal / Sagital + model volumetrik
- **Cinematic 3D ✨:** Rendering fotorealistik layar penuh dengan bayangan lembut
- **Preset klinis:** Tulang, Jaringan lunak (efek sinar-X), Glow (menyoroti fokus patologis)
- Gulir irisan dengan roda mouse · Zoom · Rotasi 3D bebas
- Chip M1: rendering dengan akselerasi perangkat keras

Anonimisasi PHI: manual dan otomatis (metadata DICOM dihapus otomatis).

---

### 🧠 Analisis MRI

Alur kerja identik dengan CT. Mendukung seri DICOM multi-sekuens dengan rendering MPR penuh dan Cinematic 3D.

---

### 🔊 Analisis Ultrasonografi (Cine-loop)

Unggah gambar statis **atau** loop video (cine-loop).

**Ekstraksi bingkai (frame):**
- **Ekstraksi Otomatis:** Sistem secara otomatis mengekstrak 5–12 bingkai utama
- **Tangkapan Manual:** Telusuri dengan tombol ±0.1 detik dan tangkap bingkai yang tepat

Semua bingkai dianonimkan sebelum pengiriman (batang hitam di bagian tepi).

---

### 🔬 Analisis Dermatoskopi

Unggah gambar dermatoskopi. Tambahkan konteks klinis (lokasi lesi, durasi, perubahan yang diamati). Mendukung analisis kriteria ABCDE dan penilaian risiko keganasan.

---

### 🧪 Analisis Data Laboratorium

Unggah laporan lab (PDF, Excel, CSV, atau foto formulir kertas).

**Ekstraksi cerdas:** Sistem secara otomatis mengenali parameter, nilai, dan rentang referensi — bahkan dari PDF multi-halaman atau formulir tulisan tangan.

**Hasil analisis meliputi:**
- Penandaan nilai kritis
- Interpretasi klinis dalam konteks RPD yang diberikan
- Grafik tren (jika pasien ada dalam database Anda)

---

### 🧬 Analisis Genetik

Unggah laporan genetik dalam format **.VCF** (hasil lab mentah) atau **PDF**.

**Alur kerja:**
1. Unggah file
2. **Tahap 1 (Ekstrak):** Gemini 3 Flash mengekstrak rsID dan genotipe dari laporan
3. **Tahap 2 (Interpretasi):** Claude Opus 5.5 memberikan interpretasi risiko klinis
4. Lanjutkan dialog dengan spesialis Genetika untuk pertanyaan lanjutan

Selalu anonimkan sebelum mengirim (nama dan alamat dihapus otomatis pada layar pratinjau).

---

### 🎬 Analisis Klinis Video

Unggah file video apa pun (cara berjalan pasien, endoskopi, ekokardiografi, loop ultrasound, dll.).

**Dua mode:**

| Mode | Deskripsi | Gunakan saat |
|---|---|---|
| **Aman (ekstraksi bingkai)** | Sistem mengekstrak 5–12 bingkai, menganonimkan masing-masing, menampilkan pratinjau | Default — video apa pun dengan atau tanpa PHI |
| **Video Penuh** | Seluruh file dikirim tanpa diproses | Hanya untuk file yang sudah dianonimkan |

> ⚠️ Dalam mode Video Penuh, bingkai TIDAK dianonimkan secara otomatis. Pastikan tidak ada PHI sebelum menggunakan.

---

### 🔍 Analisis Komparatif

Perbandingan berdampingan dari gambar medis lintas waktu atau lokasi.

**Mode perbandingan:**
- **Seiring Waktu** — penilaian perkembangan (sebelum/sesudah pengobatan)
- **Berdasarkan Lokasi** — membandingkan pemindaian wilayah anatomi yang berbeda
- **Umum** — perbandingan multi-gambar bentuk bebas

Mendukung gambar tunggal maupun kumpulan video/folder DICOM.

---

### 🔬 Analisis Lanjutan (Gambar + Konteks)

Unggah gambar utama ditambah file tambahan opsional (PDF, dokumen Word, foto). Tambahkan konteks klinis terperinci. Terima arahan klinis terpadu yang menggabungkan semua masukan.

---

### 🧊 Visualisasi 3D Tingkat Lanjut (Cinematic)

Rendering volumetrik fidelitas tinggi khusus untuk seri DICOM MRI dan CT.

- **Mode Cinematic:** Hamburan volume untuk rendering organ fotorealistik
- **Sorotan Pembuluh Darah:** Pembuluh darah dan area dengan kontras ditampilkan dalam warna merah; jaringan sekitarnya menjadi semi-transparan
- **Kualitas adaptif:** Resolusi lebih rendah saat memutar untuk kinerja yang lancar; kembali ke HQ saat diam
- **Optimasi Apple M1:** Downsampling otomatis untuk studi berat guna menjaga frame rate

---

## 📄 Pemindaian Dokumen

Mengubah kamera smartphone Anda menjadi pemindai dokumen.

### Penyalin Lokal (mode browser)
Bekerja sepenuhnya di browser Anda — tanpa AI, tidak perlu internet. 100% pribadi.

**Fitur:**
- Penyesuaian kecerahan, kontras, dan grayscale
- Ekspor ke **Word (.docx)** atau **PDF** (melalui dialog cetak sistem)
- Gratis — tidak mengonsumsi kredit

### OCR Cerdas (mode AI)
Mengekstrak teks dan tabel dari dokumen yang dipindai untuk pemrosesan lebih lanjut.

**Perlindungan PHI:**
- Sakelar anonimisasi wajib
- Penghapusan otomatis nama dan alamat saat diaktifkan
- Editor **🎨 Redact Manual**: coret area sensitif mana pun sebelum mengirim

---

## 👥 Database Pasien

Catatan pasien lokal yang disimpan di **IndexedDB browser** Anda — data tidak pernah meninggalkan perangkat Anda.

**Fitur:**
- Tambah pasien dengan nama (disarankan alias anonim), usia, jenis kelamin, diagnosis, catatan
- Simpan hasil analisis ke catatan pasien dari bagian analisis mana pun
- Lihat riwayat analisis, lini masa, dan grafik tren nilai lab
- Ringkasan kasus AI: ringkasan naratif satu klik dari semua analisis yang disimpan untuk seorang pasien

---

## 🔌 Koneksi Perangkat Langsung (USB)

Baca data dari monitor EKG, oksimeter nadi, glukometer, dan perangkat antarmuka serial lainnya langsung melalui browser — tidak perlu driver.

1. Buka bagian **Perangkat (Devices)**
2. Pilih baud rate (biasanya 115200)
3. Klik **Hubungkan** dan pilih perangkat Anda dari perintah browser (hanya Chrome / Edge)
4. Lihat kurva EKG langsung atau data sensor
5. Klik **Analisis fragmen** untuk interpretasi AI segera dari segmen saat ini

---

## 🛡️ Privasi & Penanganan Data

Doctor Opus dibangun di atas prinsip **Local-First** — data pasien tetap berada di perangkat Anda.

| Jenis data | Lokasi penyimpanan | Meninggalkan perangkat? |
|---|---|---|
| Kartu pasien & riwayat analisis | IndexedDB Browser | Tidak pernah |
| Gambar medis selama analisis | RAM Browser | Hanya fragmen yang dianonimkan |
| Hasil AI (disimpan) | IndexedDB Browser | Tidak |
| Akun pengguna & saldo kredit | PostgreSQL Cloud | Ya (tidak ada data medis) |
| Statistik analisis (anonim) | PostgreSQL Cloud | Ya (tanpa PHI) |

**Anonimisasi tiga tingkat sebelum panggilan AI apa pun:**
1. Regex teks sisi browser — nama, tanggal, ID dihapus
2. Penghapusan kanvas gambar — zona PHI dicat hitam
3. Pembersihan rekursif sisi server — semua bidang permintaan dibersihkan sebelum OpenRouter

Tidak ada Informasi Kesehatan Pribadi (PHI) atau Informasi Identitas Pribadi (PII) yang terkait dengan pemindaian medis yang disimpan dalam database cloud.

---

## 💰 Sistem Kredit

Kredit dikonsumsi saat menggunakan model AI tingkat lanjut. Pencarian referensi sederhana dan alat lokal tersedia gratis.

| Operasi | Biaya kredit (perkiraan) |
|---|---|
| Analisis cepat (Gemini 3 Flash) | ~0.3 – 0.8 kr. |
| Analisis dioptimalkan (Sonnet 5) | ~0.8 – 1.5 kr. |
| Validasi Ahli (Opus 5.5 / GPT-5.6 Terra) | ~1.5 – 3.5 kr. |
| Halaman PDF (Pemrosesan visi) | ~0.3 kr. per halaman |
| Penyalin lokal / kalkulator | Gratis |

**Paket:**
- **Starter:** 50 kredit — $6.99
- **Standard:** 180 kredit — $19.99
- **Pro:** 600 kredit — $59.99

**Alur pembayaran (saat ini):**
- Pilih paket di halaman Langganan
- Kirim jumlah USDT yang tepat melalui **TRON (TRC20)** ke dompet yang ditampilkan pada invoice
- Tempel hash transaksi (`txHash`) untuk konfirmasi pembayaran otomatis
- Kredit akan ditambahkan setelah transaksi tervalidasi

Tidak ada kredit percobaan untuk fitur AI.

Biaya pasti dari setiap permintaan ditampilkan di blok hasil segera setelah analisis selesai. Riwayat transaksi lengkap tersedia di **Saldo & Riwayat**.

---

## 💡 Tips untuk Hasil Terbaik

- Selalu tambahkan **konteks klinis** (Keluhan Utama, RPD, Riw. Penyakit Utama) — ini secara signifikan meningkatkan relevansi dan akurasi
- Gunakan **PDF yang teksnya dapat dicari** (bukan scan gambar) untuk Perpustakaan Pribadi
- Untuk EKG: gunakan **Claude Sonnet 5** dalam mode Dioptimalkan untuk detail aritmia
- Untuk fraktur: **Claude Sonnet 5** mengungguli model lain (akurasi 83%)
- Untuk genetika kompleks atau patologi langka: gunakan **Claude Opus 5.5** (mode Validasi Ahli)
- Sistem meningkat seiring waktu melalui umpan balik Anda — harap beri peringkat respons AI setelah pengujian
