# 📘 Doctor Opus — Guía del Usuario Médico

> **Importante:** Doctor Opus es un Sistema de Soporte a la Decisión Clínica (CDSS) destinado **únicamente a profesionales de la salud con licencia**. No cuenta con la aprobación de la FDA y no constituye un diagnóstico médico. Todos los resultados generados por IA requieren verificación clínica independiente. Usted asume la responsabilidad total de todas las decisiones clínicas.

Doctor Opus acelera su flujo de trabajo clínico proporcionando interpretación asistida por IA de imágenes médicas, datos de laboratorio, informes genéticos y notas clínicas. Cada sección contiene consejos contextuales; revíselos en el primer uso.

La aplicación funciona en computadoras de escritorio y dispositivos móviles. Ambos pueden trabajar de forma independiente o en conjunto a través del módulo de sincronización entre dispositivos.

---

## 📱 Instalar como Aplicación Móvil (PWA)

La plataforma es una Aplicación Web Progresiva (PWA); instálela en su pantalla de inicio para un acceso similar al de una aplicación nativa.

### iPhone (Safari)
1. Abra **doctor-opus.online** en **Safari**
2. Toque el botón **Compartir** (cuadrado con flecha) en la parte inferior
3. Desplácese hacia abajo y seleccione **"Agregar a la pantalla de inicio"**
4. Toque **"Agregar"** en la esquina superior derecha
5. Listo — el icono de Doctor Opus aparecerá en su pantalla de inicio

### Android (Chrome)
1. Abra **doctor-opus.online** en **Chrome**
2. Toque el **menú de tres puntos** (⋮) en la esquina superior derecha
3. Seleccione **"Agregar a la pantalla de inicio"** o **"Instalar aplicación"**
4. Confirme la instalación
5. Listo — el icono aparecerá en su pantalla de inicio

Una vez instalada, la aplicación se abre a pantalla completa, es accesible mediante el icono y funciona incluso con una conexión deficiente (excepto las funciones de IA que requieren red).

---

## 🏠 Inicio

Panel de control general con navegación rápida a todas las secciones.

---

## 🤖 Asistente de IA

La inteligencia central de la plataforma. Admite diálogo clínico abierto, discusión de casos, diagnóstico diferencial, revisión de literatura y análisis de múltiples archivos.

**Modelos disponibles (menú desplegable):**
- **GPT-5.6 Terra** — El mejor para el 80% de imágenes, RM y preguntas clínicas generales. Conciso y eficiente.
- **Claude Opus 5** — Razonamiento más profundo. Ideal para casos complejos, genética y patologías raras. Más lento, mayor costo.
- **Claude Sonnet 5** — Equilibrado. Excelente para consultas rápidas y evaluación de fracturas.
- **Gemini 3 Flash** — El más rápido. Ideal para referencia rápida y extracción de datos.

**El asistente puede:**
- Responder preguntas clínicas y mantener diálogos de varios turnos
- Aceptar resultados exportados de cualquier otra sección
- Especializarse como consultor (Cardiólogo, Neurólogo, Ortopedista, etc.)
- Realizar revisiones de literatura y búsquedas basadas en evidencia
- Procesar archivos cargados (imágenes, PDFs, documentos de Word)
- Usar su **Biblioteca Personal** (RAG): cuando está habilitada, el asistente extrae respuestas de sus propias guías y referencias en PDF cargadas

**Recordatorio de PHI:** No introduzca nombres de pacientes, fechas de nacimiento u otra información identificativa en el chat. Utilice descripciones anonimizadas (ej. *"Varón de 65 años, fumador, tos de 3 semanas"*).

---

## 📚 Biblioteca Personal (RAG)

Cargue sus propias guías clínicas en PDF, libros de texto y atlas. Una vez procesados, el Asistente de IA puede buscarlos y citar fragmentos relevantes directamente en el resultado del análisis.

- Capacidad: hasta ~1 GB (colecciones más grandes pueden ralentizar el navegador en hardware de gama baja)
- Los archivos se procesan en su **servidor local**, no se envían a servicios externos
- Utilice PDFs con búsqueda de texto (no escaneos) para obtener mejores resultados

---

## 📝 Protocolo Clínico (Voz a Nota)

Convierte dictados no estructurados o notas escritas en una nota clínica estructurada y específica de la especialidad, lista para descargar como archivo **Word (.docx)**, editar y firmar.

### Cómo usarlo
1. Seleccione su **especialidad** en el menú desplegable (Cardiología, Neurología, Ortopedia, etc.)
2. Dicte o escriba las notas de la consulta en cualquier orden; la IA las estructura automáticamente
3. Haga clic en **Generar Protocolo**: la nota formateada aparecerá en el panel derecho
4. Descargue como `.docx`, revise y firme

**La estructura de la nota sigue el formato SOAP / H&P:**
- **S** — Subjetivo (Motivo de consulta, HPI, Antecedentes, medicamentos, alergias)
- **O** — Objetivo (Signos vitales, hallazgos del examen físico)
- **A** — Evaluación (Diagnóstico presuntivo, diferencial)
- **P** — Plan (Diagnóstico, tratamiento, seguimiento)

Puede personalizar cualquier plantilla para que coincida con su flujo de trabajo. La versión personalizada puede fijarse como su estándar personal.

**Modelos recomendados:** GPT-5.6 Terra o Claude Sonnet 5.

---

## 🧮 Calculadoras Médicas

Inicia una suite integrada de calculadoras de terceros. Se ejecuta en el lado del cliente: no consume créditos ni se transmiten datos.

---

## 📋 Guías Clínicas

Busque guías clínicas internacionales actualizadas por condición, síndrome o clase de fármaco.

**Opciones de profundidad de búsqueda:**
- **Estándar** — Resumen conciso del protocolo con recomendaciones clave
- **Revisión Clínica** — Análisis profundo: diferencial, escalas de puntuación (CHADS₂, Wells, CURB-65, etc.), manejo paso a paso, algoritmos de tratamiento
- **Búsqueda en Tiempo Real** — Últimas publicaciones 2024–2025 con enlaces a las fuentes

Tras recibir los resultados, puede continuar la conversación con preguntas de seguimiento en contexto.

---

## 🔬 Módulos de Análisis Especializados

### 📈 Análisis de ECG

**Flujo de trabajo:**
1. Cargue una imagen de ECG (JPG, PNG o escaneo PDF)
2. Añada **contexto clínico** (Motivo de consulta, HPI, medicamentos relevantes); mejora significativamente la precisión
3. Use los **botones de anonimización 🛡️** antes de enviar:
   - **Rápido:** Redacta automáticamente bordes y esquinas
   - **Precisión:** Editor de pincel para redacción exacta
4. Seleccione el modo de análisis (Rápido / Optimizado / Validado por Experto)

**Herramientas adicionales:**
- **Calibrador Digital:** Arrastre los marcadores azules para medir intervalos PR, QRS, QT. Calibre usando la cuadrícula del ECG (1 seg = 5 cuadros grandes a 25 mm/s)
- **Buscar en Biblioteca:** Tras el análisis, haga clic para encontrar casos o descripciones coincidentes en su biblioteca PDF personal

**Modelos recomendados:** GPT-5.6 Terra (general) · Claude Sonnet 5 (detalle de arritmias)

---

### 🩻 Análisis de Rayos X

Cargue imágenes individuales o múltiples (carpeta o serie DICOM). Añada contexto clínico para obtener un resultado significativamente mejor.

**Anonimización:**
- Rápido: redacta automáticamente zonas estándar de PHI
- Precisión: editor de pincel manual
- DICOM: los metadatos se eliminan automáticamente

**Modo de comparación:** Active **Antes/Después** para comparar dos puntos en el tiempo o vistas lado a lado.

**Mejores modelos:** GPT-5.6 Terra (80% de los casos) · Claude Sonnet 5 (fracturas, 83% de precisión)

---

### 🧠 Análisis de TC

Cargue imágenes de TC o una carpeta DICOM completa.

**Visor 3D (series DICOM):**
- **MPR 2×2:** Cortes Axiales / Coronales / Sagitales + modelo volumétrico
- **Cinematic 3D ✨:** Renderizado fotorrealista a pantalla completa con sombras suaves
- **Ajustes clínicos:** Hueso, Tejido blando (efecto rayos X), Brillo (resalta focos patológicos)
- Desplace los cortes con la rueda del ratón · Zoom · Rotación 3D libre
- Chip M1: renderizado acelerado por hardware

Anonimización de PHI: manual y automática (metadatos DICOM eliminados automáticamente).

---

### 🧠 Análisis de RM

Flujo de trabajo idéntico a la TC. Admite series DICOM de múltiples secuencias con MPR completo y renderizado Cinematic 3D.

---

### 🔊 Análisis de Ultrasonido (Cine-loop)

Cargue una imagen estática **o** un bucle de video (cine-loop).

**Extracción de fotogramas:**
- **Auto-Extract:** El sistema extrae automáticamente de 5 a 12 fotogramas clave
- **Manual Capture:** Avance con los botones de ±0.1s y capture el fotograma exacto

Todos los fotogramas se anonimizan antes del envío (barras negras en los bordes).

---

### 🔬 Análisis de Dermatoscopia

Cargue imágenes de dermatoscopia. Añada contexto clínico (ubicación de la lesión, duración, cambios observados). Admite el análisis de criterios ABCDE y la evaluación del riesgo de malignidad.

---

### 🧪 Análisis de Datos de Laboratorio

Cargue un informe de laboratorio (PDF, Excel, CSV o foto de un formulario en papel).

**Extracción inteligente:** El sistema reconoce automáticamente parámetros, valores y rangos de referencia, incluso en PDFs de varias páginas o formularios escritos a mano.

**El resultado del análisis incluye:**
- Marcado de valores críticos
- Interpretación clínica en el contexto de la HPI proporcionada
- Gráficos de tendencias (si el paciente está en su base de datos)

---

### 🧬 Análisis Genético

Cargue un informe genético en formato **.VCF** (resultado bruto de laboratorio) o **PDF**.

**Flujo de trabajo:**
1. Cargar archivo
2. **Etapa 1 (Extraer):** Gemini 3 Flash extrae rsIDs y genotipos del informe
3. **Etapa 2 (Interpretar):** Claude Opus 5 proporciona la interpretación del riesgo clínico
4. Continúe el diálogo con el especialista en Genética para preguntas de seguimiento

Anonimice siempre antes de enviar (el nombre y la dirección se redactan automáticamente en la pantalla de vista previa).

---

### 🎬 Análisis Clínico de Video

Cargue cualquier archivo de video (marcha del paciente, endoscopia, ecocardiografía, bucle de ultrasonido, etc.).

**Dos modos:**

| Modo | Descripción | Cuándo usarlo |
|---|---|---|
| **Seguro (extracción de fotogramas)** | El sistema extrae 5–12 fotogramas, anonimiza cada uno y muestra vista previa | Por defecto — cualquier video con o sin PHI |
| **Video completo** | Se envía el archivo completo sin procesar | Solo para archivos ya anonimizados |

> ⚠️ En el modo de Video Completo, los fotogramas NO se anonimizan automáticamente. Confirme la ausencia de PHI antes de usarlo.

---

### 🔍 Análisis Comparativo

Comparación lado a lado de imágenes médicas a través del tiempo o la ubicación.

**Modos de comparación:**
- **En el tiempo** — Evaluación de progresión (antes/después del tratamiento)
- **Por ubicación** — Comparación de escaneos de diferentes regiones anatómicas
- **General** — Comparación libre de múltiples imágenes

Admite tanto imágenes individuales como lotes de videos/carpetas DICOM.

---

### 🔬 Análisis Avanzado (Imagen + Contexto)

Cargue una imagen principal más archivos adicionales opcionales (PDFs, documentos de Word, fotos). Añada contexto clínico detallado. Reciba una directiva clínica unificada que combine todas las entradas.

---

### 🧊 Visualización 3D Avanzada (Cinematic)

Renderizado volumétrico dedicado de alta fidelidad para series DICOM de RM y TC.

- **Modo Cinematic:** Dispersión de volumen para un renderizado de órganos fotorrealista
- **Resaltado de Vasos:** Los vasos y las áreas con contraste se muestran en rojo; el tejido circundante se vuelve semitransparente
- **Calidad adaptativa:** Menor resolución durante la rotación para un rendimiento fluido; se restaura a alta calidad en reposo
- **Optimización Apple M1:** Reducción automática de resolución para estudios pesados para mantener la tasa de fotogramas

---

## 📄 Escaneo de Documentos

Convierte la cámara de su smartphone en un escáner de documentos.

### Copiadora Local (modo navegador)
Funciona enteramente en su navegador: sin IA, sin necesidad de internet. 100% privado.

**Características:**
- Ajustes de brillo, contraste y escala de grises
- Exportación a **Word (.docx)** o **PDF** (vía diálogo de impresión del sistema)
- Gratis — no consume créditos

### OCR Inteligente (modo IA)
Extrae texto y tablas de documentos escaneados para su posterior procesamiento.

**Protección de PHI:**
- Interruptor de anonimización obligatorio
- Redacción automática de nombres y direcciones cuando está habilitado
- Editor **🎨 Redactar Manualmente**: pinte sobre cualquier área sensible antes de enviar

---

## 👥 Base de Datos de Pacientes

Registros locales de pacientes almacenados en la **IndexedDB de su navegador**; los datos nunca salen de su dispositivo.

**Características:**
- Añada pacientes con nombre (se recomienda alias anonimizado), edad, género, diagnóstico, notas
- Guarde los resultados del análisis en los registros del paciente desde cualquier sección de análisis
- Vea el historial de análisis, la línea de tiempo y los gráficos de tendencias de valores de laboratorio
- Resumen de caso por IA: resumen narrativo con un solo clic de todos los análisis guardados de un paciente

---

## 🔌 Conexión Directa de Dispositivos (USB)

Lea datos de monitores de ECG, pulsioxímetros, glucómetros y otros dispositivos con interfaz serie directamente a través del navegador; no se requieren controladores.

1. Vaya a la sección **Dispositivos**
2. Seleccione la velocidad en baudios (normalmente 115200)
3. Haga clic en **Conectar** y seleccione su dispositivo en el aviso del navegador (solo Chrome / Edge)
4. Vea la curva de ECG en vivo o los datos del sensor
5. Haga clic en **Analizar fragmento** para una interpretación inmediata por IA del segmento actual

---

## 🛡️ Privacidad y Manejo de Datos

Doctor Opus se basa en el principio **Local-First**: los datos del paciente permanecen en su dispositivo.

| Tipo de dato | Ubicación de almacenamiento | ¿Sale del dispositivo? |
|---|---|---|
| Fichas de pacientes e historial | IndexedDB del navegador | Nunca |
| Imágenes médicas durante análisis | RAM del navegador | Solo fragmentos anonimizados |
| Resultados de IA (guardados) | IndexedDB del navegador | No |
| Cuenta de usuario y saldo | PostgreSQL en la nube | Sí (sin datos médicos) |
| Estadísticas de análisis (anonimizadas) | PostgreSQL en la nube | Sí (sin PHI) |

**Anonimización de tres niveles antes de cualquier llamada a la IA:**
1. Regex de texto en el navegador: se eliminan nombres, fechas e IDs
2. Redacción en el lienzo de la imagen: las zonas con PHI se pintan de negro
3. Limpieza recursiva en el servidor: todos los campos de la solicitud se limpian antes de OpenRouter

No se almacena en la base de datos en la nube ninguna Información de Salud Protegida (PHI) o Información de Identificación Personal (PII) vinculada a escaneos médicos.

---

## 💰 Sistema de Créditos

Los créditos se consumen al utilizar modelos de IA avanzados. Las consultas de referencia simples y las herramientas locales son gratuitas.

| Operación | Costo en créditos (aprox.) |
|---|---|
| Análisis rápido (Gemini 3 Flash) | ~0.3 – 0.8 cr. |
| Análisis optimizado (Sonnet 5) | ~0.8 – 1.5 cr. |
| Validado por Experto (Opus 5 / GPT-5.6 Terra) | ~1.5 – 3.5 cr. |
| Página PDF (Procesamiento de visión) | ~0.3 cr. por página |
| Copiadora local / calculadoras | Gratis |

**Paquetes:**
- **Starter:** 50 créditos — $9.99
- **Standard:** 150 créditos — $24.99
- **Pro:** 500 créditos — $69.99

El costo exacto de cada solicitud se muestra en el bloque de resultados inmediatamente después de completar el análisis. El historial completo de transacciones está disponible en **Saldo e Historial**.

---

## 💡 Consejos para Mejores Resultados

- Añada siempre **contexto clínico** (Motivo de consulta, HPI, antecedentes clave); mejora significativamente la relevancia y precisión
- Utilice **PDFs con búsqueda de texto** (no escaneos de imágenes) para la Biblioteca Personal
- Para ECG: use **Claude Sonnet 5** en modo Optimizado para detalles de arritmias
- Para fracturas: **Claude Sonnet 5** supera a otros modelos (83% de precisión)
- Para genética compleja o patología rara: use **Claude Opus 5** (modo Validado por Experto)
- El sistema mejora con el tiempo gracias a sus comentarios; por favor, califique las respuestas de la IA después de las pruebas