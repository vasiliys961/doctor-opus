# 📘 Doctor Opus — Hekim Kullanım Kılavuzu

> **Önemli:** Doctor Opus, **yalnızca lisanslı sağlık profesyonelleri** için tasarlanmış beta bir Klinik Karar Destek Yazılımıdır (CDSS). Tıbbi cihaz değildir ve nihai tanı ya da tedavi emri vermez. Yapay zeka çıktılarının kalitesi üçüncü taraf LLM yeteneklerine bağlıdır ve eksik veya hatalı olabilir. Tüm yapay zeka çıktıları bağımsız hekim doğrulaması gerektirir. Kullanım kısıtı: AB/ABD/BK yargı alanlarında düzenlemeye tabi klinik kullanım için tasarlanmamıştır. Tüm klinik kararların sorumluluğu tamamen size aittir.

Doctor Opus; tıbbi görüntüleme, laboratuvar verileri, genetik raporlar ve klinik notların yapay zeka destekli yorumlanmasını sağlayarak klinik iş akışınızı hızlandırır. Her bölüm bağlamsal ipuçları içerir — ilk kullanımda bunları gözden geçirin.

Uygulama masaüstü ve mobil cihazlarda çalışır. Her ikisi de bağımsız olarak veya cihazlar arası senkronizasyon modülü aracılığıyla birlikte çalışabilir.

---

## 📱 Mobil Uygulama Olarak Yükleme (PWA)

Platform bir Progresif Web Uygulamasıdır (PWA) — yerel uygulama benzeri erişim için ana ekranınıza yükleyin.

### iPhone (Safari)
1. **Safari** tarayıcısında **doctor-opus.online** adresini açın.
2. Alttaki **Paylaş** düğmesine (yukarı oklu kare) dokunun.
3. Aşağı kaydırın ve **"Ana Ekrana Ekle"** seçeneğini seçin.
4. Sağ üst köşedeki **"Ekle"** düğmesine dokunun.
5. Tamamlandı — Doctor Opus simgesi ana ekranınızda görünecektir.

### Android (Chrome)
1. **Chrome** tarayıcısında **doctor-opus.online** adresini açın.
2. Sağ üst köşedeki **üç nokta menüsüne** (⋮) dokunun.
3. **"Ana Ekrana Ekle"** veya **"Uygulamayı Yükle"** seçeneğini seçin.
4. Yüklemeyi onaylayın.
5. Tamamlandı — simge ana ekranınızda görünecektir.

Yüklendikten sonra uygulama tam ekran açılır, simge üzerinden erişilebilir ve zayıf bağlantıda bile çalışır (ağ gerektiren yapay zeka özellikleri hariç).

---

## 🏠 Ana Sayfa

Tüm bölümlere hızlı navigasyon sağlayan genel bakış paneli.

---

## ⚖️ Zorunlu yasal akış

İlk girişten sonra (veya yasal sürüm güncellendiğinde), klinik modülleri kullanmadan önce yasal onayı onaylamanız zorunludur.

Bir yapay zeka sonucunu hasta kaydına kaydederken:
- Hekim doğrulama penceresi açılır
- Kişisel inceleme ve klinik sorumluluğu onaylamanız gerekir
- Denetim günlüğü yalnızca vaka kimliği ve onay/hash meta verisini saklar (hasta kişisel verisi gönderilmez)

---

## 🤖 Yapay Zeka Asistanı

Platformun temel zekasıdır. Açık uçlu klinik diyalog, vaka tartışması, ayırıcı tanı, literatür taraması ve çoklu dosya analizini destekler.

**Mevcut modeller (açılır menü):**
- **GPT-5.6 Terra** — Görüntüleme, MR ve genel klinik soruların %80'i için en iyisidir. Öz ve verimlidir.
- **Claude Opus 5.5** — En derin muhakeme yeteneği. Karmaşık vakalar, genetik ve nadir patolojiler için en iyisidir. Daha yavaş, daha yüksek maliyetlidir.
- **Claude Sonnet 5** — Dengeli. Hızlı konsültasyonlar ve kırık değerlendirmesi için mükemmeldir.
- **Gemini 3 Flash** — En hızlısı. Hızlı referans ve veri çıkarma için idealdir.

**Asistan şunları yapabilir:**
- Klinik soruları yanıtlar ve çok turlu diyalog sürdürür.
- Diğer bölümlerden dışa aktarılan sonuçları kabul eder.
- Uzman danışman (Kardiyolog, Nörolog, Ortopedist vb.) olarak özelleşebilir.
- Literatür taraması ve kanıta dayalı aramalar yapar.
- Yüklenen dosyaları (görüntüler, PDF'ler, Word belgeleri) işler.
- **Kişisel Kitaplığınızı** (RAG) kullanır — etkinleştirildiğinde asistan, kendi yüklediğiniz PDF kılavuzlarından ve referanslardan yanıtlar üretir.

**PHI (Kişisel Sağlık Bilgileri) hatırlatması:** Sohbet kısmına hasta isimleri, doğum tarihleri veya diğer tanımlayıcı bilgileri girmeyin. Anonimleştirilmiş açıklamalar kullanın (örneğin: *"65 y.e., sigara içen, 3 haftalık öksürük"*).

---

## 📚 Kişisel Kitaplık (RAG)

Kendi PDF klinik kılavuzlarınızı, ders kitaplarınızı ve atlaslarınızı yükleyin. İşlendikten sonra, Yapay Zeka Asistanı bunları tarayabilir ve analiz çıktısında doğrudan ilgili alıntılara atıfta bulunabilir.

- Kapasite: ~1 GB'a kadar (büyük koleksiyonlar düşük donanımlı cihazlarda tarayıcıyı yavaşlatabilir).
- Dosyalar **yerel sunucunuzda** işlenir — harici servislere gönderilmez.
- En iyi sonuçlar için metin araması yapılabilir PDF'ler kullanın (tarama/resim formatında olmayan).

---

## 📝 Klinik Protokol (Sesten Nota)

Yapılandırılmamış dikteyi veya yazılı notları, branşa özel yapılandırılmış bir klinik nota dönüştürür — **Word (.docx)** dosyası olarak indirilmeye, düzenlenmeye ve imzalanmaya hazırdır.

### Nasıl kullanılır?
1. Açılır menüden **uzmanlık alanınızı** seçin (Kardiyoloji, Nöroloji, Ortopedi vb.).
2. Vizit notlarını herhangi bir sırayla dikte edin veya yazın — yapay zeka bunları otomatik olarak yapılandırır.
3. **Protokol Oluştur**'a tıklayın — formatlanmış not sağ panelde görünür.
4. `.docx` olarak indirin, gözden geçirin ve imzalayın.

**Not yapısı SOAP / H&P formatını takip eder:**
- **S (Subjective)** — Subjektif (Şikayet, Hikaye, Özgeçmiş, İlaçlar, Alerjiler)
- **O (Objective)** — Objektif (Vital bulgular, Fizik muayene bulguları)
- **A (Assessment)** — Değerlendirme (Ön tanı, Ayırıcı tanı)
- **P (Plan)** — Plan (Tetkikler, Tedavi, Takip)

Herhangi bir şablonu iş akışınıza göre özelleştirebilirsiniz. Özelleştirilmiş sürüm, kişisel standardınız olarak sabitlenebilir.

**Önerilen modeller:** GPT-5.6 Terra veya Claude Sonnet 5.

---

## 🗣️ Tıbbi çevirmen

Ana sayfadan açın. Siz konuşursunuz; hasta çeviriyi duyar.

1. Kendi dilinizi ve hastanın dilini seçin.
2. **Başlat** düğmesine basın ve mikrofona izin verin. Kulaklık kullanın.
3. Sağ sütun hastanın duyduğudur. **Durdur** kimin konuştuğunu değiştirir. **Bitir** oturumu kapatır.
4. Bir doz, sayı veya klinik terim uyuşmayabilir ise kendiniz kontrol edin. Metin kendiliğinden düzeltilmez.

**Maliyet:** Mikrofon açıkken dakika başına 5,1 kredi. Klinik protokol için konuşma kaydı ayrıdır: saat başına 62 kredi.

---

## 🧮 Tıbbi Hesaplayıcılar

Entegre bir üçüncü taraf hesaplayıcı setini başlatır. İstemci tarafında çalışır — kredi tüketilmez, veri iletilmez.

---

## 📋 Klinik Kılavuzlar

Hastalık, sendrom veya ilaç sınıfına göre güncel uluslararası klinik kılavuzları arayın.

**Arama derinliği seçenekleri:**
- **Standart** — Temel önerileri içeren öz protokol özeti.
- **Klinik İnceleme** — Derin analiz: Ayırıcı tanı, skorlama ölçekleri (CHADS₂, Wells, CURB-65 vb.), adım adım yönetim, tedavi algoritmaları.
- **Gerçek Zamanlı Arama** — Kaynak bağlantılarıyla birlikte en son 2024–2025 yayınları.

Sonuçları aldıktan sonra, bağlam dahilinde takip sorularıyla görüşmeye devam edebilirsiniz.

---

## 🔬 Uzmanlaşmış Analiz Modülleri

### 📈 EKG Analizi

**İş akışı:**
1. Bir EKG görüntüsü yükleyin (JPG, PNG veya PDF tarama).
2. **Klinik bağlam** ekleyin (Şikayet, Hikaye, ilgili ilaçlar) — bu, doğruluğu önemli ölçüde artırır.
3. Göndermeden önce **🛡️ anonimleştirme düğmelerini** kullanın:
   - **Hızlı:** Kenarları ve köşeleri otomatik olarak karartır.
   - **Hassas:** Tam karartma için fırça düzenleyici.
4. Analiz modunu seçin (Hızlı / Optimize Edilmiş / Uzman Onaylı).

**Ek araçlar:**
- **Dijital Kumpas:** PR, QRS, QT aralıklarını ölçmek için mavi işaretçileri sürükleyin. EKG ızgarasını kullanarak kalibre edin (25 mm/sn'de 1 sn = 5 büyük kare).
- **Kitaplıkta Ara:** Analizden sonra, kişisel PDF kitaplığınızda eşleşen vakaları veya açıklamaları bulmak için tıklayın.

**Önerilen modeller:** GPT-5.6 Terra (genel) · Claude Sonnet 5 (aritmi detayları)

---

### 🩻 Röntgen (X-Ray) Analizi

Tekli veya çoklu görüntüler yükleyin (klasör veya DICOM serisi). Önemli ölçüde daha iyi çıktı için klinik bağlam ekleyin.

**Anonimleştirme:**
- Hızlı: Standart PHI bölgelerini otomatik karartır.
- Hassas: Manuel fırça düzenleyici.
- DICOM: Meta veriler otomatik olarak temizlenir.

**Karşılaştırma modu:** İki zaman noktasını veya görünümü yan yana karşılaştırmak için **Önce/Sonra** özelliğini etkinleştirin.

**En iyi modeller:** GPT-5.6 Terra (vakaların %80'i) · Claude Sonnet 5 (kırıklar, %83 doğruluk)

---

### 🧠 BT (CT) Analizi

BT görüntülerini veya tüm bir DICOM klasörünü yükleyin.

**3D Görüntüleyici (DICOM serisi):**
- **MPR 2×2:** Aksiyel / Koronal / Sagittal kesitler + volumetrik model.
- **Cinematic 3D ✨:** Yumuşak gölgeli, tam ekran fotogerçekçi render.
- **Klinik ön ayarlar:** Kemik, Yumuşak doku (Röntgen efekti), Parlama (patolojik odakları vurgular).
- Fare tekerleği ile kesitleri kaydırın · Yakınlaştırın · Serbest 3D döndürme.
- M1 çip: Donanım hızlandırmalı render.

PHI anonimleştirme: Manuel ve otomatik (DICOM meta verileri otomatik temizlenir).

---

### 🧠 MR (MRI) Analizi

BT ile aynı iş akışı. Tam MPR ve Cinematic 3D render ile çoklu sekans DICOM serilerini destekler.

---

### 🔊 Ultrason Analizi (Cine-loop)

Statik bir görüntü **veya** bir video döngüsü (cine-loop) yükleyin.

**Kare çıkarma:**
- **Otomatik Çıkar:** Sistem otomatik olarak 5–12 ana kareyi çıkarır.
- **Manuel Yakalama:** ±0.1s düğmeleriyle ilerleyin ve tam kareyi yakalayın.

Tüm kareler gönderilmeden önce anonimleştirilir (kenarlarda siyah çubuklar).

---

### 🔬 Dermatoskopi Analizi

Dermatoskopi görüntülerini yükleyin. Klinik bağlam ekleyin (lezyon yeri, süresi, gözlenen değişiklikler). ABCDE kriter analizi ve malignite risk değerlendirmesini destekler.

---

### 🧪 Laboratuvar Verileri Analizi

Bir laboratuvar raporu yükleyin (PDF, Excel, CSV veya kağıt formun fotoğrafı).

**Akıllı çıkarma:** Sistem; çok sayfalı PDF'lerden veya el yazısı formlardan bile parametreleri, değerleri ve referans aralıklarını otomatik olarak tanır.

**Analiz çıktısı şunları içerir:**
- Kritik değer işaretleme.
- Sağlanan hikaye bağlamında klinik yorum.
- Trend grafikleri (hasta veritabanınızda kayıtlıysa).

---

### 🧬 Genetik Analiz

**.VCF** formatında (ham laboratuvar çıktısı) veya **PDF** olarak bir genetik rapor yükleyin.

**İş akışı:**
1. Dosyayı yükleyin.
2. **Aşama 1 (Çıkarma):** Gemini 3 Flash, rapordan rsID'leri ve genotipleri çıkarır.
3. **Aşama 2 (Yorumlama):** Claude Opus 5.5, klinik risk yorumu sağlar.
4. Takip soruları için Genetik uzmanı ile diyaloğa devam edin.

Göndermeden önce daima anonimleştirin (önizleme ekranında isim ve adres otomatik olarak karartılır).

---

### 🎬 Video Klinik Analizi

Herhangi bir video dosyası yükleyin (hasta yürüyüşü, endoskopi, ekokardiyografi, ultrason döngüsü vb.).

**İki mod:**

| Mod | Açıklama | Kullanım Durumu |
|---|---|---|
| **Güvenli (kare çıkarma)** | Sistem 5–12 kare çıkarır, her birini anonimleştirir, önizleme gösterir | Varsayılan — PHI içeren veya içermeyen her video |
| **Tam video** | Dosyanın tamamı işlenmeden gönderilir | Yalnızca önceden anonimleştirilmiş dosyalar için |

> ⚠️ Tam Video modunda kareler otomatik olarak anonimleştirilmez. Kullanmadan önce PHI bulunmadığını onaylayın.

---

### 🔍 Karşılaştırmalı Analiz

Tıbbi görüntülerin zamana veya konuma göre yan yana karşılaştırılması.

**Karşılaştırma modları:**
- **Zaman İçinde** — Progresyon değerlendirmesi (tedavi öncesi/sonrası).
- **Konuma Göre** — Farklı anatomik bölgelerin taramalarını karşılaştırma.
- **Genel** — Serbest formda çoklu görüntü karşılaştırması.

Hem tekli görüntüleri hem de video/DICOM klasör gruplarını destekler.

---

### 🔬 Gelişmiş Analiz (Görüntü + Bağlam)

Bir birincil görüntü ve isteğe bağlı ek dosyalar (PDF'ler, Word belgeleri, fotoğraflar) yükleyin. Ayrıntılı klinik bağlam ekleyin. Tüm girdileri birleştiren birleşik bir klinik direktif alın.

---

### 🧊 Gelişmiş 3D Görselleştirme (Cinematic)

MR ve BT DICOM serileri için özel yüksek kaliteli volumetrik render.

- **Cinematic Modu:** Fotogerçekçi organ renderı için hacimsel saçılma (volume scattering).
- **Damar Vurgulama:** Damarlar ve kontrastlı alanlar kırmızı gösterilir; çevre doku yarı saydam hale gelir.
- **Uyarlanabilir kalite:** Akıcı performans için döndürme sırasında daha düşük çözünürlük; durduğunda yüksek kaliteye (HQ) geri döner.
- **Apple M1 optimizasyonu:** Kare hızını korumak için ağır çalışmalarda otomatik alt örnekleme.

---

## 📄 Belge Tarama

Akıllı telefonunuzun kamerasını bir belge tarayıcıya dönüştürür.

### Yerel Kopyalayıcı (tarayıcı modu)
Tamamen tarayıcınızda çalışır — yapay zeka veya internet gerekmez. %100 özeldir.

**Özellikler:**
- Parlaklık, kontrast ve gri tonlama ayarları.
- **Word (.docx)** veya **PDF** (sistem yazdırma penceresi aracılığıyla) olarak dışa aktarma.
- Ücretsiz — kredi tüketilmez.

### Akıllı OCR (Yapay Zeka modu)
Daha fazla işlem için taranan belgelerden metin ve tabloları çıkarır.

**PHI koruması:**
- Zorunlu anonimleştirme anahtarı.
- Etkinleştirildiğinde isim ve adreslerin otomatik karartılması.
- **🎨 Manuel Karartma** düzenleyicisi: Göndermeden önce hassas alanların üzerini boyayın.

---

## 👥 Hasta Veritabanı

Yerel hasta kayıtları **tarayıcınızın IndexedDB** biriminde saklanır — veriler cihazınızdan asla ayrılmaz.

**Özellikler:**
- İsim (anonim takma ad önerilir), yaş, cinsiyet, tanı ve notlarla hasta ekleyin.
- Herhangi bir analiz bölümünden analiz sonuçlarını hasta kayıtlarına kaydedin.
- Analiz geçmişini, zaman çizelgesini ve laboratuvar değeri trend grafiklerini görüntüleyin.
- Yapay zeka vaka özeti: Bir hasta için kaydedilen tüm analizlerin tek tıkla anlatımlı özeti.

---

## 🔌 Doğrudan Cihaz Bağlantısı (USB)

EKG monitörlerinden, nabız oksimetrelerinden, glukometrelerden ve diğer seri arayüzlü cihazlardan verileri doğrudan tarayıcı üzerinden okuyun — sürücü gerekmez.

1. **Cihazlar** bölümüne gidin.
2. Baud hızını seçin (genellikle 115200).
3. **Bağlan**'a tıklayın ve tarayıcı isteminden cihazınızı seçin (yalnızca Chrome / Edge).
4. Canlı EKG eğrisini veya sensör verilerini görüntüleyin.
5. Mevcut segmentin anında yapay zeka yorumu için **Fragmanı Analiz Et**'e tıklayın.

---

## 🛡️ Gizlilik ve Veri İşleme

Doctor Opus, **"Önce Yerel" (Local-First)** prensibi üzerine inşa edilmiştir — hasta verileri cihazınızda kalır.

| Veri Tipi | Saklama Yeri | Cihazdan Ayrılır mı? |
|---|---|---|
| Hasta kartları ve analiz geçmişi | Tarayıcı IndexedDB | Asla |
| Analiz sırasındaki tıbbi görüntüler | Tarayıcı RAM | Yalnızca anonimleştirilmiş fragmanlar |
| Yapay zeka sonuçları (kaydedilen) | Tarayıcı IndexedDB | Hayır |
| Kullanıcı hesabı ve kredi bakiyesi | Bulut PostgreSQL | Evet (tıbbi veri içermez) |
| Analiz istatistikleri (anonim) | Bulut PostgreSQL | Evet (PHI içermez) |

**Herhangi bir yapay zeka çağrısından önce üç seviyeli anonimleştirme:**
1. Tarayıcı tarafı metin regex — isimler, tarihler, kimlikler temizlenir.
2. Görüntü kanvas karartma — PHI bölgeleri siyaha boyanır.
3. Sunucu tarafı özyinelemeli temizlik — tüm istek alanları OpenRouter'dan önce temizlenir.

Bulut veritabanında tıbbi taramalarla bağlantılı hiçbir Kişisel Sağlık Bilgisi (PHI) veya Kişisel Tanımlanabilir Bilgi (PII) saklanmaz.

---

## 💰 Kredi Sistemi

Gelişmiş yapay zeka modelleri kullanıldığında krediler tüketilir. Basit referans aramaları ve yerel araçlar ücretsizdir.

| İşlem | Kredi Maliyeti (yaklaşık) |
|---|---|
| Hızlı analiz (Gemini 3 Flash) | ~0.3 – 0.8 kr. |
| Optimize edilmiş analiz (Sonnet 5) | ~0.8 – 1.5 kr. |
| Uzman Onaylı (Opus 5.5 / GPT-5.6 Terra) | ~1.5 – 3.5 kr. |
| PDF sayfası (Görüntü işleme) | Sayfa başına ~0.3 kr. |
| Tıbbi çevirmen | Mikrofon açıkken dakika başına 5,1 kr. |
| Klinik protokol için konuşma kaydı | Sesin saati başına 62 kr. |
| Yerel kopyalayıcı / hesaplayıcılar | Ücretsiz |

**Paketler:**
- **Başlangıç:** 50 kredi — $6.99
- **Standart:** 180 kredi — $19.99
- **Pro:** 600 kredi — $59.99

**Ödeme akışı (güncel):**
- Abonelik sayfasında paket seçin
- Faturada görünen cüzdana **TRON (TRC20)** üzerinden tam USDT tutarını gönderin
- Ödemeyi otomatik doğrulamak için işlem hash'ini (`txHash`) yapıştırın
- İşlem doğrulandıktan sonra krediler eklenir

Yapay zeka özellikleri için deneme kredisi yoktur.

Her isteğin tam maliyeti, analiz tamamlandıktan hemen sonra sonuç bloğunda gösterilir. Tam işlem geçmişi **Bakiye ve Geçmiş** bölümünde mevcuttur.

---

## 💡 En İyi Sonuçlar İçin İpuçları

- Daima **klinik bağlam** (Şikayet, Hikaye, önemli Özgeçmiş) ekleyin — bu, alaka düzeyini ve doğruluğu önemli ölçüde artırır.
- Kişisel Kitaplık için **metin araması yapılabilir PDF'ler** kullanın (resim taramaları değil).
- EKG için: Aritmi detayları için Optimize Edilmiş modda **Claude Sonnet 5** kullanın.
- Kırıklar için: **Claude Sonnet 5** diğer modellerden daha iyi performans gösterir (%83 doğruluk).
- Karmaşık genetik veya nadir patolojiler için: **Claude Opus 5.5** (Uzman Onaylı mod) kullanın.
- Sistem, geri bildirimlerinizle zamanla gelişir — lütfen testlerden sonra yapay zeka yanıtlarını oylayın.
