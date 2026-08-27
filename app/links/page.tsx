'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClientLocale } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/config'

type LinkItem = {
  id: string
  title: string
  url: string
  note: string
  createdAt: string
}

type DiscoveredLink = {
  source: string
  title: string
  url: string
  snippet?: string
  year?: string
}

type OaLookupResult = {
  status: 'found' | 'not_found' | 'error'
  url?: string
  source?: string
  message?: string
}

const STORAGE_KEY = 'doctor_opus_links_collection_v1'

type UiText = {
  title: string
  subtitle: string
  legalNote: string
  formTitle: string
  titleLabel: string
  urlLabel: string
  noteLabel: string
  titlePlaceholder: string
  urlPlaceholder: string
  notePlaceholder: string
  save: string
  update: string
  cancel: string
  clearAll: string
  exportJson: string
  importJson: string
  listTitle: string
  empty: string
  open: string
  copy: string
  copied: string
  edit: string
  remove: string
  invalidUrl: string
  requiredUrl: string
  confirmClear: string
  confirmDelete: string
  importPrompt: string
  importError: string
}

const MESSAGES: Record<Locale, UiText> = {
  en: {
    title: '🔗 Link Collection',
    subtitle: 'Your personal list of links for later download/reading.',
    legalNote: 'Store only links you are legally allowed to use.',
    formTitle: 'Add link',
    titleLabel: 'Title',
    urlLabel: 'URL',
    noteLabel: 'Note',
    titlePlaceholder: 'e.g. Cardiology atlas chapter',
    urlPlaceholder: 'https://...',
    notePlaceholder: 'Optional note (topic, source, comments)',
    save: 'Save',
    update: 'Update',
    cancel: 'Cancel',
    clearAll: 'Clear all',
    exportJson: 'Export JSON',
    importJson: 'Import JSON',
    listTitle: 'Saved links',
    empty: 'No links yet. Add your first one.',
    open: 'Open',
    copy: 'Copy',
    copied: 'Copied',
    edit: 'Edit',
    remove: 'Delete',
    invalidUrl: 'Invalid URL. Use full address (https://...)',
    requiredUrl: 'URL is required',
    confirmClear: 'Delete all saved links?',
    confirmDelete: 'Delete this link?',
    importPrompt: 'Paste JSON exported from this page:',
    importError: 'Import failed. Check JSON format.',
  },
  es: {
    title: '🔗 Colección de enlaces',
    subtitle: 'Tu lista personal de enlaces para descargar/leer después.',
    legalNote: 'Guarda solo enlaces que puedas usar legalmente.',
    formTitle: 'Añadir enlace',
    titleLabel: 'Título',
    urlLabel: 'URL',
    noteLabel: 'Nota',
    titlePlaceholder: 'p.ej. Capítulo de atlas de cardiología',
    urlPlaceholder: 'https://...',
    notePlaceholder: 'Nota opcional (tema, fuente, comentarios)',
    save: 'Guardar',
    update: 'Actualizar',
    cancel: 'Cancelar',
    clearAll: 'Borrar todo',
    exportJson: 'Exportar JSON',
    importJson: 'Importar JSON',
    listTitle: 'Enlaces guardados',
    empty: 'Aún no hay enlaces. Añade el primero.',
    open: 'Abrir',
    copy: 'Copiar',
    copied: 'Copiado',
    edit: 'Editar',
    remove: 'Eliminar',
    invalidUrl: 'URL no válida. Usa dirección completa (https://...)',
    requiredUrl: 'La URL es obligatoria',
    confirmClear: '¿Borrar todos los enlaces guardados?',
    confirmDelete: '¿Eliminar este enlace?',
    importPrompt: 'Pega JSON exportado desde esta página:',
    importError: 'Error al importar. Revisa el formato JSON.',
  },
  fr: {
    title: '🔗 Collection de liens',
    subtitle: 'Votre liste personnelle de liens pour téléchargement/lecture.',
    legalNote: 'Enregistrez uniquement des liens utilisables légalement.',
    formTitle: 'Ajouter un lien',
    titleLabel: 'Titre',
    urlLabel: 'URL',
    noteLabel: 'Note',
    titlePlaceholder: 'ex. chapitre atlas de cardiologie',
    urlPlaceholder: 'https://...',
    notePlaceholder: 'Note facultative (thème, source, commentaires)',
    save: 'Enregistrer',
    update: 'Mettre à jour',
    cancel: 'Annuler',
    clearAll: 'Tout effacer',
    exportJson: 'Exporter JSON',
    importJson: 'Importer JSON',
    listTitle: 'Liens enregistrés',
    empty: 'Aucun lien pour le moment.',
    open: 'Ouvrir',
    copy: 'Copier',
    copied: 'Copié',
    edit: 'Modifier',
    remove: 'Supprimer',
    invalidUrl: 'URL invalide. Utilisez une adresse complète (https://...)',
    requiredUrl: "L'URL est obligatoire",
    confirmClear: 'Supprimer tous les liens enregistrés ?',
    confirmDelete: 'Supprimer ce lien ?',
    importPrompt: 'Collez le JSON exporté depuis cette page :',
    importError: "Échec de l'import. Vérifiez le format JSON.",
  },
  ar: {
    title: '🔗 مجموعة الروابط',
    subtitle: 'قائمة روابط شخصية للتحميل/القراءة لاحقاً.',
    legalNote: 'احفظ فقط الروابط المسموح باستخدامها قانونياً.',
    formTitle: 'إضافة رابط',
    titleLabel: 'العنوان',
    urlLabel: 'الرابط',
    noteLabel: 'ملاحظة',
    titlePlaceholder: 'مثال: فصل أطلس القلب',
    urlPlaceholder: 'https://...',
    notePlaceholder: 'ملاحظة اختيارية (موضوع، مصدر، تعليقات)',
    save: 'حفظ',
    update: 'تحديث',
    cancel: 'إلغاء',
    clearAll: 'مسح الكل',
    exportJson: 'تصدير JSON',
    importJson: 'استيراد JSON',
    listTitle: 'الروابط المحفوظة',
    empty: 'لا توجد روابط بعد.',
    open: 'فتح',
    copy: 'نسخ',
    copied: 'تم النسخ',
    edit: 'تعديل',
    remove: 'حذف',
    invalidUrl: 'رابط غير صالح. استخدم عنواناً كاملاً (https://...)',
    requiredUrl: 'الرابط مطلوب',
    confirmClear: 'حذف جميع الروابط المحفوظة؟',
    confirmDelete: 'حذف هذا الرابط؟',
    importPrompt: 'الصق JSON المصدّر من هذه الصفحة:',
    importError: 'فشل الاستيراد. تحقق من تنسيق JSON.',
  },
  hi: {
    title: '🔗 लिंक कलेक्शन',
    subtitle: 'बाद में डाउनलोड/पढ़ने के लिए आपकी निजी लिंक सूची।',
    legalNote: 'केवल वैध और अनुमति वाले लिंक ही सहेजें।',
    formTitle: 'लिंक जोड़ें',
    titleLabel: 'शीर्षक',
    urlLabel: 'URL',
    noteLabel: 'नोट',
    titlePlaceholder: 'उदा. कार्डियोलॉजी एटलस अध्याय',
    urlPlaceholder: 'https://...',
    notePlaceholder: 'वैकल्पिक नोट (विषय, स्रोत, टिप्पणी)',
    save: 'सहेजें',
    update: 'अपडेट',
    cancel: 'रद्द करें',
    clearAll: 'सब साफ करें',
    exportJson: 'JSON निर्यात',
    importJson: 'JSON आयात',
    listTitle: 'सहेजे गए लिंक',
    empty: 'अभी कोई लिंक नहीं है।',
    open: 'खोलें',
    copy: 'कॉपी',
    copied: 'कॉपी हुआ',
    edit: 'संपादित करें',
    remove: 'हटाएं',
    invalidUrl: 'अमान्य URL. पूरा पता दें (https://...)',
    requiredUrl: 'URL आवश्यक है',
    confirmClear: 'सभी सहेजे लिंक हटाएँ?',
    confirmDelete: 'यह लिंक हटाएँ?',
    importPrompt: 'इस पेज से निर्यात किया गया JSON पेस्ट करें:',
    importError: 'आयात विफल। JSON प्रारूप जाँचें।',
  },
  'pt-BR': {
    title: '🔗 Coleção de links',
    subtitle: 'Sua lista pessoal de links para baixar/ler depois.',
    legalNote: 'Salve apenas links permitidos legalmente.',
    formTitle: 'Adicionar link',
    titleLabel: 'Título',
    urlLabel: 'URL',
    noteLabel: 'Nota',
    titlePlaceholder: 'ex.: capítulo de atlas de cardiologia',
    urlPlaceholder: 'https://...',
    notePlaceholder: 'Nota opcional (tema, fonte, comentários)',
    save: 'Salvar',
    update: 'Atualizar',
    cancel: 'Cancelar',
    clearAll: 'Limpar tudo',
    exportJson: 'Exportar JSON',
    importJson: 'Importar JSON',
    listTitle: 'Links salvos',
    empty: 'Ainda não há links.',
    open: 'Abrir',
    copy: 'Copiar',
    copied: 'Copiado',
    edit: 'Editar',
    remove: 'Excluir',
    invalidUrl: 'URL inválida. Use endereço completo (https://...)',
    requiredUrl: 'URL obrigatória',
    confirmClear: 'Excluir todos os links salvos?',
    confirmDelete: 'Excluir este link?',
    importPrompt: 'Cole o JSON exportado desta página:',
    importError: 'Falha ao importar. Verifique o formato JSON.',
  },
  id: {
    title: '🔗 Koleksi tautan',
    subtitle: 'Daftar tautan pribadi untuk diunduh/dibaca nanti.',
    legalNote: 'Simpan hanya tautan yang legal untuk digunakan.',
    formTitle: 'Tambah tautan',
    titleLabel: 'Judul',
    urlLabel: 'URL',
    noteLabel: 'Catatan',
    titlePlaceholder: 'mis. bab atlas kardiologi',
    urlPlaceholder: 'https://...',
    notePlaceholder: 'Catatan opsional (topik, sumber, komentar)',
    save: 'Simpan',
    update: 'Perbarui',
    cancel: 'Batal',
    clearAll: 'Hapus semua',
    exportJson: 'Ekspor JSON',
    importJson: 'Impor JSON',
    listTitle: 'Tautan tersimpan',
    empty: 'Belum ada tautan.',
    open: 'Buka',
    copy: 'Salin',
    copied: 'Disalin',
    edit: 'Edit',
    remove: 'Hapus',
    invalidUrl: 'URL tidak valid. Gunakan alamat lengkap (https://...)',
    requiredUrl: 'URL wajib diisi',
    confirmClear: 'Hapus semua tautan tersimpan?',
    confirmDelete: 'Hapus tautan ini?',
    importPrompt: 'Tempel JSON yang diekspor dari halaman ini:',
    importError: 'Impor gagal. Periksa format JSON.',
  },
  ms: {
    title: '🔗 Koleksi pautan',
    subtitle: 'Senarai pautan peribadi untuk muat turun/baca kemudian.',
    legalNote: 'Simpan hanya pautan yang sah untuk digunakan.',
    formTitle: 'Tambah pautan',
    titleLabel: 'Tajuk',
    urlLabel: 'URL',
    noteLabel: 'Nota',
    titlePlaceholder: 'cth. bab atlas kardiologi',
    urlPlaceholder: 'https://...',
    notePlaceholder: 'Nota pilihan (topik, sumber, komen)',
    save: 'Simpan',
    update: 'Kemas kini',
    cancel: 'Batal',
    clearAll: 'Padam semua',
    exportJson: 'Eksport JSON',
    importJson: 'Import JSON',
    listTitle: 'Pautan disimpan',
    empty: 'Belum ada pautan.',
    open: 'Buka',
    copy: 'Salin',
    copied: 'Disalin',
    edit: 'Edit',
    remove: 'Padam',
    invalidUrl: 'URL tidak sah. Guna alamat penuh (https://...)',
    requiredUrl: 'URL diperlukan',
    confirmClear: 'Padam semua pautan yang disimpan?',
    confirmDelete: 'Padam pautan ini?',
    importPrompt: 'Tampal JSON yang dieksport dari halaman ini:',
    importError: 'Import gagal. Semak format JSON.',
  },
  tr: {
    title: '🔗 Bağlantı koleksiyonu',
    subtitle: 'Daha sonra indirmek/okumak için kişisel bağlantı listeniz.',
    legalNote: 'Yalnızca yasal olarak kullanılabilir bağlantıları kaydedin.',
    formTitle: 'Bağlantı ekle',
    titleLabel: 'Başlık',
    urlLabel: 'URL',
    noteLabel: 'Not',
    titlePlaceholder: 'örn. kardiyoloji atlas bölümü',
    urlPlaceholder: 'https://...',
    notePlaceholder: 'İsteğe bağlı not (konu, kaynak, yorum)',
    save: 'Kaydet',
    update: 'Güncelle',
    cancel: 'İptal',
    clearAll: 'Tümünü temizle',
    exportJson: 'JSON dışa aktar',
    importJson: 'JSON içe aktar',
    listTitle: 'Kaydedilen bağlantılar',
    empty: 'Henüz bağlantı yok.',
    open: 'Aç',
    copy: 'Kopyala',
    copied: 'Kopyalandı',
    edit: 'Düzenle',
    remove: 'Sil',
    invalidUrl: 'Geçersiz URL. Tam adres kullanın (https://...)',
    requiredUrl: 'URL gerekli',
    confirmClear: 'Tüm kayıtlı bağlantılar silinsin mi?',
    confirmDelete: 'Bu bağlantı silinsin mi?',
    importPrompt: 'Bu sayfadan dışa aktarılan JSON’u yapıştırın:',
    importError: 'İçe aktarma başarısız. JSON biçimini kontrol edin.',
  },
  'zh-CN': {
    title: '🔗 链接收藏',
    subtitle: '用于后续下载/阅读的个人链接列表。',
    legalNote: '请仅保存合法可用的链接。',
    formTitle: '添加链接',
    titleLabel: '标题',
    urlLabel: 'URL',
    noteLabel: '备注',
    titlePlaceholder: '例如：心脏病学图谱章节',
    urlPlaceholder: 'https://...',
    notePlaceholder: '可选备注（主题、来源、说明）',
    save: '保存',
    update: '更新',
    cancel: '取消',
    clearAll: '清空全部',
    exportJson: '导出 JSON',
    importJson: '导入 JSON',
    listTitle: '已保存链接',
    empty: '暂无链接。',
    open: '打开',
    copy: '复制',
    copied: '已复制',
    edit: '编辑',
    remove: '删除',
    invalidUrl: 'URL 无效，请使用完整地址（https://...）',
    requiredUrl: 'URL 为必填项',
    confirmClear: '删除所有已保存链接？',
    confirmDelete: '删除此链接？',
    importPrompt: '粘贴从本页导出的 JSON：',
    importError: '导入失败，请检查 JSON 格式。',
  },
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeUrlForKey(value: string): string {
  try {
    const parsed = new URL(value.trim())
    parsed.hash = ''
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/'
    const search = parsed.search || ''
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${pathname}${search}`
  } catch {
    return value.trim()
  }
}

export default function LinksPage() {
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>('en')
  const t = useMemo(() => MESSAGES[locale], [locale])

  const [links, setLinks] = useState<LinkItem[]>([])
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSource, setSearchSource] = useState<'all' | 'pubmed' | 'europepmc' | 'arxiv' | 'doaj' | 'all-web'>('all')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<DiscoveredLink[]>([])
  const [oaLoadingKey, setOaLoadingKey] = useState<string | null>(null)
  const [bulkOaLoading, setBulkOaLoading] = useState(false)
  const [oaByUrl, setOaByUrl] = useState<Record<string, OaLookupResult>>({})
  const [selectedSavedIds, setSelectedSavedIds] = useState<string[]>([])
  const [selectedSearchKeys, setSelectedSearchKeys] = useState<string[]>([])

  const discoveredWithKeys = useMemo(
    () => searchResults.map((item, idx) => ({ item, key: `${idx}:${item.url}` })),
    [searchResults],
  )

  useEffect(() => {
    setLocale(getClientLocale())
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setLinks(parsed)
      }
    } catch {
      // ignore broken local state
    }
  }, [])

  const persist = (next: LinkItem[]) => {
    setLinks(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const toggleSavedSelection = (id: string) => {
    setSelectedSavedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]))
  }

  const toggleSearchSelection = (key: string) => {
    setSelectedSearchKeys((prev) => (prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key]))
  }

  const selectedSavedLinks = links.filter((item) => selectedSavedIds.includes(item.id))
  const selectedDiscoveredLinks = discoveredWithKeys
    .filter((row) => selectedSearchKeys.includes(row.key))
    .map((row) => row.item)

  const selectedAllLinks = [...selectedSavedLinks, ...selectedDiscoveredLinks]

  const protocolDraftLabel = locale === 'ru' ? 'Источники по теме' : 'Topic sources'
  const protocolDraftHint = locale === 'ru'
    ? 'Сформируй протокол с учетом следующих ссылок и кратких заметок.'
    : 'Generate protocol using these links and short notes.'

  const pushToProtocol = (items: Array<Pick<LinkItem, 'title' | 'url' | 'note'>>) => {
    if (items.length === 0) return
    const lines = items.map((item, index) => {
      const titlePart = item.title?.trim() ? item.title.trim() : item.url
      const notePart = item.note?.trim() ? ` — ${item.note.trim()}` : ''
      return `${index + 1}. ${titlePart}\n${item.url}${notePart}`
    })
    const rawText = `${protocolDraftLabel}\n\n${lines.join('\n\n')}\n\n${protocolDraftHint}`
    localStorage.setItem(
      'protocol_draft',
      JSON.stringify({
        kind: 'links_collection',
        rawText,
        timestamp: new Date().toISOString(),
      }),
    )
    router.push('/protocol')
  }

  const addSelectedDiscoveredToCollection = () => {
    if (selectedDiscoveredLinks.length === 0) return
    const existingUrlKeys = new Set(links.map((item) => normalizeUrlForKey(item.url)))
    const created: LinkItem[] = []
    selectedDiscoveredLinks.forEach((item) => {
      const urlKey = normalizeUrlForKey(item.url)
      if (!isValidUrl(item.url) || existingUrlKeys.has(urlKey)) return
      created.push({
        id: crypto.randomUUID(),
        title: item.title || item.url,
        url: item.url,
        note: `${item.source}${item.year ? ` • ${item.year}` : ''}`,
        createdAt: new Date().toISOString(),
      })
      existingUrlKeys.add(urlKey)
    })
    if (created.length === 0) return
    persist([...created, ...links])
    setSelectedSearchKeys([])
  }

  const removeSelectedSaved = () => {
    if (selectedSavedIds.length === 0) return
    const next = links.filter((item) => !selectedSavedIds.includes(item.id))
    persist(next)
    setSelectedSavedIds([])
  }

  const copySelectedUrls = async () => {
    if (selectedAllLinks.length === 0) return
    const payload = selectedAllLinks.map((item) => item.url).join('\n')
    try {
      await navigator.clipboard.writeText(payload)
    } catch {
      // ignore clipboard failures
    }
  }

  const resetForm = () => {
    setTitle('')
    setUrl('')
    setNote('')
    setEditingId(null)
    setError(null)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanedUrl = url.trim()
    if (!cleanedUrl) {
      setError(t.requiredUrl)
      return
    }
    if (!isValidUrl(cleanedUrl)) {
      setError(t.invalidUrl)
      return
    }
    const nextUrlKey = normalizeUrlForKey(cleanedUrl)
    const hasDuplicate = links.some((item) => item.id !== editingId && normalizeUrlForKey(item.url) === nextUrlKey)
    if (hasDuplicate) {
      setError(locale === 'ru' ? 'Такая ссылка уже есть в коллекции' : 'This link is already in your collection')
      return
    }

    const now = new Date().toISOString()
    if (editingId) {
      const next = links.map((item) =>
        item.id === editingId
          ? { ...item, title: title.trim(), url: cleanedUrl, note: note.trim() }
          : item
      )
      persist(next)
      resetForm()
      return
    }

    const item: LinkItem = {
      id: crypto.randomUUID(),
      title: title.trim(),
      url: cleanedUrl,
      note: note.trim(),
      createdAt: now,
    }
    persist([item, ...links])
    resetForm()
  }

  const onEdit = (item: LinkItem) => {
    setEditingId(item.id)
    setTitle(item.title)
    setUrl(item.url)
    setNote(item.note)
    setError(null)
  }

  const onDelete = (id: string) => {
    if (!confirm(t.confirmDelete)) return
    const next = links.filter((item) => item.id !== id)
    persist(next)
    if (editingId === id) resetForm()
  }

  const onClearAll = () => {
    if (!confirm(t.confirmClear)) return
    persist([])
    resetForm()
  }

  const onCopy = async (item: LinkItem) => {
    try {
      await navigator.clipboard.writeText(item.url)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 1200)
    } catch {
      // ignore clipboard failures
    }
  }

  const onExport = () => {
    const blob = new Blob([JSON.stringify(links, null, 2)], { type: 'application/json' })
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = 'doctor-opus-links.json'
    a.click()
    URL.revokeObjectURL(objectUrl)
  }

  const onImport = () => {
    const raw = window.prompt(t.importPrompt)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error('invalid')
      const normalized: LinkItem[] = parsed
        .filter((item) => item && typeof item === 'object')
        .map((item: any) => ({
          id: String(item.id || crypto.randomUUID()),
          title: String(item.title || ''),
          url: String(item.url || ''),
          note: String(item.note || ''),
          createdAt: String(item.createdAt || new Date().toISOString()),
        }))
        .filter((item) => isValidUrl(item.url))
      const dedup = new Map<string, LinkItem>()
      normalized.forEach((item) => {
        const key = normalizeUrlForKey(item.url)
        if (!key || dedup.has(key)) return
        dedup.set(key, item)
      })
      persist(Array.from(dedup.values()))
    } catch {
      setError(t.importError)
    }
  }

  const onSearchSources = async () => {
    const q = searchQuery.trim()
    if (!q) return
    setSearching(true)
    setSearchError(null)
    try {
      const params = new URLSearchParams({ q, source: searchSource })
      const response = await fetch(`/api/links/search?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Search failed')
      }
      setSearchResults(Array.isArray(data.items) ? data.items : [])
      setSelectedSearchKeys([])
    } catch (e: any) {
      setSearchResults([])
      setSearchError(String(e?.message || 'Search failed'))
    } finally {
      setSearching(false)
    }
  }

  const addDiscoveredLink = (item: DiscoveredLink) => {
    if (!isValidUrl(item.url)) return
    const itemUrlKey = normalizeUrlForKey(item.url)
    const exists = links.some((row) => normalizeUrlForKey(row.url) === itemUrlKey)
    if (exists) return
    const next: LinkItem = {
      id: crypto.randomUUID(),
      title: item.title || item.url,
      url: item.url,
      note: `${item.source}${item.year ? ` • ${item.year}` : ''}`,
      createdAt: new Date().toISOString(),
    }
    persist([next, ...links])
  }

  const lookupOaResult = async (item: { url: string; title?: string }): Promise<OaLookupResult> => {
    try {
      const params = new URLSearchParams({ url: item.url, title: item.title || '' })
      const response = await fetch(`/api/links/oa?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!data?.success) {
        throw new Error(String(data?.error || 'OA lookup failed'))
      }
      if (data?.found && data?.item?.url) {
        return { status: 'found', url: String(data.item.url), source: String(data.item.source || 'OA') }
      }
      return { status: 'not_found' }
    } catch (e: any) {
      return { status: 'error', message: String(e?.message || 'OA lookup failed') }
    }
  }

  const findOaCopy = async (item: { url: string; title?: string }) => {
    const key = item.url
    if (!key) return
    setOaLoadingKey(key)
    const result = await lookupOaResult(item)
    setOaByUrl((prev) => ({ ...prev, [key]: result }))
    setOaLoadingKey((prev) => (prev === key ? null : prev))
  }

  const findOaForSelected = async (items: Array<{ url: string; title?: string }>) => {
    if (items.length === 0 || bulkOaLoading) return
    setBulkOaLoading(true)
    try {
      const uniqueItems: Array<{ url: string; title?: string }> = []
      const seen = new Set<string>()
      items.forEach((item) => {
        const key = normalizeUrlForKey(item.url)
        if (!key || seen.has(key)) return
        seen.add(key)
        uniqueItems.push(item)
      })

      const updates: Record<string, OaLookupResult> = {}
      for (const item of uniqueItems) {
        updates[item.url] = await lookupOaResult(item)
      }
      setOaByUrl((prev) => ({ ...prev, ...updates }))
    } finally {
      setBulkOaLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-2">{t.title}</h1>
      <p className="text-sm text-slate-600 mb-1">{t.subtitle}</p>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
        ⚠️ {t.legalNote}
      </p>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-3">🔎 Find legal sources</h2>
        <p className="text-xs text-slate-600 mb-3">
          Search in allowed databases (PubMed, Europe PMC, arXiv, DOAJ), then add selected links to your collection.
        </p>
        <p className="text-[11px] text-violet-700 bg-violet-50 border border-violet-200 rounded-md px-2.5 py-1.5 mb-3">
          Tip: <strong>All Web</strong> searches the broader internet. Results can include non-medical pages; paywalled content still requires your own access.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
          <input
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            placeholder="Enter topic, disease, drug, guideline..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={searchSource}
            onChange={(e) => setSearchSource(e.target.value as any)}
          >
            <option value="all">All sources</option>
            <option value="all-web">All Web</option>
            <option value="pubmed">PubMed</option>
            <option value="europepmc">Europe PMC</option>
            <option value="arxiv">arXiv</option>
            <option value="doaj">DOAJ</option>
          </select>
          <button
            type="button"
            onClick={onSearchSources}
            className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 text-sm"
            disabled={searching}
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {searchError && <p className="text-xs text-red-600 mt-2">{searchError}</p>}
        {selectedDiscoveredLinks.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="text-xs font-semibold text-emerald-800">
              {locale === 'ru' ? `Выбрано из поиска: ${selectedDiscoveredLinks.length}` : `Selected from search: ${selectedDiscoveredLinks.length}`}
            </span>
            <button
              type="button"
              onClick={addSelectedDiscoveredToCollection}
              className="text-xs px-2.5 py-1.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-100"
            >
              {locale === 'ru' ? 'Добавить выбранное' : 'Add selected'}
            </button>
            <button
              type="button"
              onClick={() => pushToProtocol(selectedDiscoveredLinks.map((item) => ({ title: item.title, url: item.url, note: `${item.source}${item.year ? ` • ${item.year}` : ''}` })))}
              className="text-xs px-2.5 py-1.5 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              {locale === 'ru' ? 'В протокол' : 'To protocol'}
            </button>
            <button
              type="button"
              onClick={() => void findOaForSelected(selectedDiscoveredLinks.map((item) => ({ url: item.url, title: item.title })))}
              className="text-xs px-2.5 py-1.5 rounded border border-violet-300 text-violet-700 hover:bg-violet-50"
              disabled={bulkOaLoading}
            >
              {bulkOaLoading ? (locale === 'ru' ? 'Проверка OA...' : 'Checking OA...') : (locale === 'ru' ? 'OA для выбранных' : 'OA for selected')}
            </button>
          </div>
        )}
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {discoveredWithKeys.map(({ item, key }) => (
              <div key={key} className="border border-slate-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-slate-900 break-words">{item.title}</p>
                <p className="text-[11px] text-slate-500 break-all">{item.url}</p>
                {item.snippet && <p className="text-xs text-slate-600 mt-1">{item.snippet}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-300 bg-white">
                    <input
                      type="checkbox"
                      checked={selectedSearchKeys.includes(key)}
                      onChange={() => toggleSearchSelection(key)}
                    />
                    <span>{locale === 'ru' ? 'Выбрать' : 'Select'}</span>
                  </label>
                  <span className="text-[11px] px-2 py-1 rounded bg-slate-100 text-slate-700">{item.source}{item.year ? ` • ${item.year}` : ''}</span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-2.5 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
                  >
                    {t.open}
                  </a>
                  <button
                    type="button"
                    onClick={() => addDiscoveredLink(item)}
                    className="text-xs px-2.5 py-1.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    + {t.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => findOaCopy(item)}
                    className="text-xs px-2.5 py-1.5 rounded border border-violet-300 text-violet-700 hover:bg-violet-50"
                    disabled={oaLoadingKey === item.url}
                  >
                    {oaLoadingKey === item.url ? 'Checking OA...' : 'Find OA copy'}
                  </button>
                </div>
                {oaByUrl[item.url]?.status === 'found' && oaByUrl[item.url]?.url && (
                  <p className="text-xs text-emerald-700 mt-2">
                    OA found ({oaByUrl[item.url]?.source}):{' '}
                    <a
                      href={oaByUrl[item.url]?.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      open link
                    </a>
                  </p>
                )}
                {oaByUrl[item.url]?.status === 'not_found' && (
                  <p className="text-xs text-slate-500 mt-2">OA copy was not found for this item.</p>
                )}
                {oaByUrl[item.url]?.status === 'error' && (
                  <p className="text-xs text-rose-600 mt-2">{oaByUrl[item.url]?.message || 'OA lookup failed'}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-2">📄 Upload your PDF</h2>
        <p className="text-xs text-slate-600 mb-3">
          For personal documents/books, use PDF upload in your Personal Library.
        </p>
        <Link
          href="/library"
          className="inline-flex items-center text-sm px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Open Personal Library
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-3">{t.formTitle}</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-600">{t.titleLabel}</label>
            <input
              className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.titlePlaceholder}
            />
          </div>
          <div>
            <label className="text-xs text-slate-600">{t.urlLabel}</label>
            <input
              className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t.urlPlaceholder}
            />
          </div>
          <div>
            <label className="text-xs text-slate-600">{t.noteLabel}</label>
            <textarea
              className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm min-h-[84px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="text-sm px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700">
              {editingId ? t.update : t.save}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-sm px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-50">
                {t.cancel}
              </button>
            )}
            <button type="button" onClick={onClearAll} className="text-sm px-4 py-2 rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50">
              {t.clearAll}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{t.listTitle}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              className="text-xs px-2.5 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
            >
              {t.exportJson}
            </button>
            <button
              type="button"
              onClick={onImport}
              className="text-xs px-2.5 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
            >
              {t.importJson}
            </button>
          </div>
        </div>
        {selectedSavedLinks.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
            <span className="text-xs font-semibold text-indigo-800">
              {locale === 'ru' ? `Выбрано: ${selectedSavedLinks.length}` : `Selected: ${selectedSavedLinks.length}`}
            </span>
            <button
              type="button"
              onClick={copySelectedUrls}
              className="text-xs px-2.5 py-1.5 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-100"
            >
              {locale === 'ru' ? 'Копировать URL' : 'Copy URLs'}
            </button>
            <button
              type="button"
              onClick={() => pushToProtocol(selectedSavedLinks)}
              className="text-xs px-2.5 py-1.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              {locale === 'ru' ? 'В протокол' : 'To protocol'}
            </button>
            <button
              type="button"
              onClick={() => void findOaForSelected(selectedSavedLinks.map((item) => ({ url: item.url, title: item.title })))}
              className="text-xs px-2.5 py-1.5 rounded border border-violet-300 text-violet-700 hover:bg-violet-50"
              disabled={bulkOaLoading}
            >
              {bulkOaLoading ? (locale === 'ru' ? 'Проверка OA...' : 'Checking OA...') : (locale === 'ru' ? 'OA для выбранных' : 'OA for selected')}
            </button>
            <button
              type="button"
              onClick={removeSelectedSaved}
              className="text-xs px-2.5 py-1.5 rounded border border-rose-300 text-rose-700 hover:bg-rose-50"
            >
              {locale === 'ru' ? 'Удалить выбранное' : 'Delete selected'}
            </button>
          </div>
        )}
        {links.length === 0 ? (
          <p className="text-sm text-slate-500">{t.empty}</p>
        ) : (
          <div className="space-y-3">
            {links.map((item) => (
              <div key={item.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 break-words">
                      {item.title || item.url}
                    </p>
                    <p className="text-xs text-slate-500 break-all">{item.url}</p>
                    {item.note && <p className="text-xs text-slate-600 mt-1 break-words">{item.note}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-300 bg-white">
                      <input
                        type="checkbox"
                        checked={selectedSavedIds.includes(item.id)}
                        onChange={() => toggleSavedSelection(item.id)}
                      />
                      <span>{locale === 'ru' ? 'Выбрать' : 'Select'}</span>
                    </label>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-2.5 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
                    >
                      {t.open}
                    </a>
                    <button
                      type="button"
                      onClick={() => onCopy(item)}
                      className="text-xs px-2.5 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
                    >
                      {copiedId === item.id ? t.copied : t.copy}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="text-xs px-2.5 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
                    >
                      {t.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="text-xs px-2.5 py-1.5 rounded border border-rose-300 text-rose-700 hover:bg-rose-50"
                    >
                      {t.remove}
                    </button>
                    <button
                      type="button"
                      onClick={() => findOaCopy(item)}
                      className="text-xs px-2.5 py-1.5 rounded border border-violet-300 text-violet-700 hover:bg-violet-50"
                      disabled={oaLoadingKey === item.url}
                    >
                      {oaLoadingKey === item.url ? 'Checking OA...' : 'Find OA copy'}
                    </button>
                  </div>
                </div>
                {oaByUrl[item.url]?.status === 'found' && oaByUrl[item.url]?.url && (
                  <p className="text-xs text-emerald-700 mt-2">
                    OA found ({oaByUrl[item.url]?.source}):{' '}
                    <a
                      href={oaByUrl[item.url]?.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      open link
                    </a>
                  </p>
                )}
                {oaByUrl[item.url]?.status === 'not_found' && (
                  <p className="text-xs text-slate-500 mt-2">OA copy was not found for this item.</p>
                )}
                {oaByUrl[item.url]?.status === 'error' && (
                  <p className="text-xs text-rose-600 mt-2">{oaByUrl[item.url]?.message || 'OA lookup failed'}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-2">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

