# 📘 Doctor Opus — Guia do Usuário Médico

> **Importante:** O Doctor Opus é um Sistema de Apoio à Decisão Clínica (SADC) destinado **apenas a profissionais de saúde licenciados**. Ele não é aprovado pela FDA e não constitui um diagnóstico médico. Todos os resultados gerados por IA exigem verificação clínica independente. Você assume total responsabilidade por todas as decisões clínicas.

O Doctor Opus acelera seu fluxo de trabalho clínico fornecendo interpretação assistida por IA de imagens médicas, dados laboratoriais, relatórios genéticos e notas clínicas. Cada seção contém dicas contextuais — revise-as no primeiro uso.

O aplicativo funciona em desktop e dispositivos móveis. Ambos podem operar de forma independente ou em conjunto através do módulo de sincronização entre dispositivos.

---

## 📱 Instalar como Aplicativo Móvel (PWA)

A plataforma é um Progressive Web App — instale-o em sua tela inicial para acesso semelhante a um aplicativo nativo.

### iPhone (Safari)
1. Abra **doctor-opus.online** no **Safari**
2. Toque no botão **Compartilhar** (quadrado com seta) na parte inferior
3. Role para baixo e selecione **"Adicionar à Tela de Início"**
4. Toque em **"Adicionar"** no canto superior direito
5. Pronto — o ícone do Doctor Opus aparecerá na sua tela inicial

### Android (Chrome)
1. Abra **doctor-opus.online** no **Chrome**
2. Toque no **menu de três pontos** (⋮) no canto superior direito
3. Selecione **"Adicionar à tela inicial"** ou **"Instalar aplicativo"**
4. Confirme a instalação
5. Pronto — o ícone aparecerá na sua tela inicial

Uma vez instalado, o aplicativo abre em tela cheia, é acessível via ícone e funciona mesmo com conexão instável (exceto recursos de IA que exigem rede).

---

## 🏠 Início (Home)

Painel de visão geral com navegação rápida para todas as seções.

---

## 🤖 Assistente de IA

A inteligência central da plataforma. Suporta diálogo clínico aberto, discussão de casos, diagnóstico diferencial, revisão de literatura e análise de múltiplos arquivos.

**Modelos disponíveis (menu suspenso):**
- **GPT-5.6 Terra** — Melhor para 80% de imagens, RM e questões clínicas gerais. Conciso e eficiente.
- **Claude Opus 5** — Raciocínio mais profundo. Melhor para casos complexos, genética e patologias raras. Mais lento, custo mais elevado.
- **Claude Sonnet 5** — Equilibrado. Excelente para consultas rápidas e avaliação de fraturas.
- **Gemini 3 Flash** — Mais rápido. Ideal para referência rápida e extração de dados.

**O assistente pode:**
- Responder a perguntas clínicas e manter diálogos de múltiplos turnos
- Aceitar resultados exportados de qualquer outra seção
- Especializar-se como consultor (Cardiologista, Neurologista, Ortopedista, etc.)
- Realizar revisão de literatura e buscas baseadas em evidências
- Processar arquivos carregados (imagens, PDFs, documentos Word)
- Usar sua **Biblioteca Pessoal** (RAG) — quando ativado, o assistente extrai respostas de suas próprias diretrizes e referências em PDF carregadas

**Lembrete de PHI (Informações de Saúde Protegidas):** Não insira nomes de pacientes, datas de nascimento ou outras informações identificáveis no chat. Use descrições anonimizadas (ex: *"homem, 65 anos, fumante, tosse há 3 semanas"*).

---

## 📚 Biblioteca Pessoal (RAG)

Carregue suas próprias diretrizes clínicas em PDF, livros didáticos e atlas. Uma vez processados, o Assistente de IA pode pesquisá-los e citar trechos relevantes diretamente no resultado da análise.

- Capacidade: até ~1 GB (coleções maiores podem deixar o navegador lento em hardware básico)
- Os arquivos são processados no seu **servidor local** — não são enviados para serviços externos
- Use PDFs com pesquisa de texto (não digitalizações de imagem) para melhores resultados

---

## 📝 Protocolo Clínico (Voz para Nota)

Converte ditados não estruturados ou notas digitadas em uma nota clínica estruturada e específica para a especialidade — pronta para download como arquivo **Word (.docx)**, edição e assinatura.

### Como usar
1. Selecione sua **especialidade** no menu suspenso (Cardiologia, Neurologia, Ortopedia, etc.)
2. Dite ou digite as notas da consulta em qualquer ordem — a IA as estrutura automaticamente
3. Clique em **Gerar Protocolo** — a nota formatada aparece no painel direito
4. Baixe como `.docx`, revise e assine

**A estrutura da nota segue o formato SOAP / H&P:**
- **S** — Subjetivo (Queixa principal, HMA, Antecedentes, medicamentos, alergias)
- **O** — Objetivos (sinais vitais, achados do exame físico)
- **A** — Avaliação (hipótese diagnóstica, diferencial)
- **P** — Plano (diagnósticos, tratamento, acompanhamento)

Você pode personalizar qualquer modelo para corresponder ao seu fluxo de trabalho. A versão personalizada pode ser fixada como seu padrão pessoal.

**Modelos recomendados:** GPT-5.6 Terra ou Claude Sonnet 5.

---

## 🧮 Calculadoras Médicas

Inicia um conjunto integrado de calculadoras de terceiros. Executado no lado do cliente — sem consumo de créditos, sem transmissão de dados.

---

## 📋 Diretrizes Clínicas

Pesquise diretrizes clínicas internacionais atuais por condição, síndrome ou classe de medicamentos.

**Opções de profundidade de busca:**
- **Padrão** — resumo conciso do protocolo com recomendações principais
- **Revisão Clínica** — análise profunda: diferencial, escalas de pontuação (CHADS₂, Wells, CURB-65, etc.), manejo passo a passo, algoritmos de tratamento
- **Busca em Tempo Real** — publicações mais recentes de 2024–2025 com links para as fontes

Após receber os resultados, você pode continuar a conversa com perguntas de acompanhamento no contexto.

---

## 🔬 Módulos de Análise Especializada

### 📈 Análise de ECG

**Fluxo de trabalho:**
1. Carregue uma imagem de ECG (JPG, PNG ou digitalização em PDF)
2. Adicione **contexto clínico** (Queixa principal, HMA, medicamentos relevantes) — melhora significativamente a precisão
3. Use os **botões de anonimização 🛡️** antes de enviar:
   - **Rápido:** Oculta automaticamente bordas e cantos
   - **Precisão:** Editor de pincel para ocultação exata
4. Selecione o modo de análise (Rápido / Otimizado / Validado por Especialista)

**Ferramentas adicionais:**
- **Compasso Digital:** Arraste os marcadores azuis para medir intervalos PR, QRS, QT. Calibre usando a grade do ECG (1 seg = 5 quadrados grandes a 25 mm/s)
- **Biblioteca de Busca:** Após a análise, clique para encontrar casos ou descrições correspondentes em sua biblioteca pessoal de PDFs

**Modelos recomendados:** GPT-5.6 Terra (geral) · Claude Sonnet 5 (detalhes de arritmia)

---

### 🩻 Análise de Raio-X

Carregue imagens únicas ou múltiplas (pasta ou série DICOM). Adicione contexto clínico para resultados significativamente melhores.

**Anonimização:**
- Rápido: oculta automaticamente zonas padrão de PHI
- Precisão: editor de pincel manual
- DICOM: metadados removidos automaticamente

**Modo de comparação:** Ative **Antes/Depois** para comparar dois pontos no tempo ou visualizações lado a lado.

**Melhores modelos:** GPT-5.6 Terra (80% dos casos) · Claude Sonnet 5 (fraturas, 83% de precisão)

---

### 🧠 Análise de TC (Tomografia)

Carregue imagens de TC ou uma pasta DICOM inteira.

**Visualizador 3D (série DICOM):**
- **MPR 2×2:** Cortes Axial / Coronal / Sagital + modelo volumétrico
- **Cinematic 3D ✨:** Renderização fotorrealista em tela cheia com sombras suaves
- **Predefinições clínicas:** Ósseo, Tecidos moles (efeito Raio-X), Glow (destaca focos patológicos)
- Role os cortes com a roda do mouse · Zoom · Rotação 3D livre
- Chip M1: renderização acelerada por hardware

Anonimização de PHI: manual e automática (metadados DICOM removidos automaticamente).

---

### 🧠 Análise de RM (Ressonância)

Fluxo de trabalho idêntico à TC. Suporta séries DICOM de múltiplas sequências com MPR completo e renderização Cinematic 3D.

---

### 🔊 Análise de Ultrassom (Cine-loop)

Carregue uma imagem estática **ou** um loop de vídeo (cine-loop).

**Extração de quadros:**
- **Extração Automática:** O sistema extrai automaticamente de 5 a 12 quadros principais
- **Captura Manual:** Navegue com botões de ±0.1s e capture o quadro exato

Todos os quadros são anonimizados antes do envio (barras pretas nas bordas).

---

### 🔬 Análise de Dermatoscopia

Carregue imagens de dermatoscopia. Adicione contexto clínico (localização da lesão, duração, alterações observadas). Suporta análise de critérios ABCDE e avaliação de risco de malignidade.

---

### 🧪 Análise de Dados Laboratoriais

Carregue um relatório laboratorial (PDF, Excel, CSV ou foto de um formulário em papel).

**Extração inteligente:** O sistema reconhece automaticamente parâmetros, valores e intervalos de referência — mesmo em PDFs de várias páginas ou formulários manuscritos.

**O resultado da análise inclui:**
- Sinalização de valores críticos
- Interpretação clínica no contexto da HMA fornecida
- Gráficos de tendência (se o paciente estiver no seu banco de dados)

---

### 🧬 Análise Genética

Carregue um relatório genético no formato **.VCF** (saída bruta de laboratório) ou **PDF**.

**Fluxo de trabalho:**
1. Carregar arquivo
2. **Estágio 1 (Extrair):** Gemini 3 Flash extrai rsIDs e genótipos do relatório
3. **Estágio 2 (Interpretar):** Claude Opus 5 fornece interpretação de risco clínico
4. Continue o diálogo com o especialista em Genética para perguntas de acompanhamento

Sempre anonimize antes de enviar (nome e endereço são ocultados automaticamente na tela de visualização).

---

### 🎬 Análise Clínica de Vídeo

Carregue qualquer arquivo de vídeo (marcha do paciente, endoscopia, ecocardiografia, loop de ultrassom, etc.).

**Dois modos:**

| Modo | Descrição | Quando usar |
|---|---|---|
| **Seguro (extração de quadros)** | O sistema extrai 5–12 quadros, anonimiza cada um, mostra visualização | Padrão — qualquer vídeo com ou sem PHI |
| **Vídeo completo** | Arquivo inteiro enviado sem processamento | Apenas para arquivos já anonimizados |

> ⚠️ No modo Vídeo Completo, os quadros NÃO são anonimizados automaticamente. Confirme a ausência de PHI antes de usar.

---

### 🔍 Análise Comparativa

Comparação lado a lado de imagens médicas ao longo do tempo ou localização.

**Modos de comparação:**
- **Ao Longo do Tempo** — avaliação de progressão (antes/depois do tratamento)
- **Por Localização** — comparando exames de diferentes regiões anatômicas
- **Geral** — comparação livre de múltiplas imagens

Suporta tanto imagens únicas quanto lotes de vídeos/pastas DICOM.

---

### 🔬 Análise Avançada (Imagem + Contexto)

Carregue uma imagem primária mais arquivos adicionais opcionais (PDFs, documentos Word, fotos). Adicione contexto clínico detalhado. Receba uma diretriz clínica unificada combinando todas as entradas.

---

### 🧊 Visualização 3D Avançada (Cinematic)

Renderização volumétrica dedicada de alta fidelidade para séries DICOM de RM e TC.

- **Modo Cinematic:** Espalhamento de volume para renderização fotorrealista de órgãos
- **Destaque de Vasos:** Vasos e áreas com contraste mostrados em vermelho; o tecido circundante torna-se semitransparente
- **Qualidade adaptativa:** Resolução menor durante a rotação para desempenho fluido; restaura para HQ em repouso
- **Otimização Apple M1:** Redução automática de resolução para estudos pesados para manter a taxa de quadros

---

## 📄 Digitalização de Documentos

Transforma a câmera do seu smartphone em um scanner de documentos.

### Copiadora Local (modo navegador)
Funciona inteiramente no seu navegador — sem IA, sem necessidade de internet. 100% privado.

**Recursos:**
- Ajustes de brilho, contraste e tons de cinza
- Exportação para **Word (.docx)** ou **PDF** (via diálogo de impressão do sistema)
- Gratuito — sem consumo de créditos

### OCR Inteligente (modo IA)
Extrai texto e tabelas de documentos digitalizados para processamento posterior.

**Proteção de PHI:**
- Alternância de anonimização obrigatória
- Ocultação automática de nomes e endereços quando ativado
- Editor **🎨 Ocultar Manualmente**: pinte sobre qualquer área sensível antes de enviar

---

## 👥 Banco de Dados de Pacientes

Registros locais de pacientes armazenados no **IndexedDB do seu navegador** — os dados nunca saem do seu dispositivo.

**Recursos:**
- Adicione pacientes com nome (pseudônimo anonimizado recomendado), idade, sexo, diagnóstico, notas
- Salve resultados de análise nos registros do paciente a partir de qualquer seção de análise
- Visualize histórico de análises, linha do tempo e gráficos de tendência de valores laboratoriais
- Resumo de caso por IA: resumo narrativo em um clique de todas as análises salvas para um paciente

---

## 🔌 Conexão Direta de Dispositivos (USB)

Leia dados de monitores de ECG, oxímetros de pulso, glicosímetros e outros dispositivos de interface serial diretamente pelo navegador — sem necessidade de drivers.

1. Vá para a seção **Dispositivos**
2. Selecione a taxa de transmissão (geralmente 115200)
3. Clique em **Conectar** e selecione seu dispositivo no prompt do navegador (apenas Chrome / Edge)
4. Visualize a curva de ECG ao vivo ou dados do sensor
5. Clique em **Analisar fragmento** para interpretação imediata por IA do segmento atual

---

## 🛡️ Privacidade e Manuseio de Dados

O Doctor Opus é construído sobre o princípio **Local-First** — os dados do paciente permanecem no seu dispositivo.

| Tipo de dado | Local de armazenamento | Sai do dispositivo? |
|---|---|---|
| Fichas de pacientes e histórico | IndexedDB do navegador | Nunca |
| Imagens médicas durante análise | RAM do navegador | Apenas fragmentos anonimizados |
| Resultados de IA (salvos) | IndexedDB do navegador | Não |
| Conta de usuário e saldo | PostgreSQL na nuvem | Sim (sem dados médicos) |
| Estatísticas de análise (anonimizadas) | PostgreSQL na nuvem | Sim (sem PHI) |

**Anonimização em três níveis antes de qualquer chamada de IA:**
1. Regex de texto no navegador — nomes, datas e IDs removidos
2. Ocultação em tela de imagem — zonas de PHI pintadas de preto
3. Limpeza recursiva no servidor — todos os campos da requisição limpos antes do OpenRouter

Nenhuma Informação de Saúde Protegida (PHI) ou Informação de Identificação Pessoal (PII) vinculada a exames médicos é armazenada no banco de dados na nuvem.

---

## 💰 Sistema de Créditos

Créditos são consumidos ao usar modelos de IA avançados. Consultas de referência simples e ferramentas locais são gratuitas.

| Operação | Custo em créditos (aprox.) |
|---|---|
| Análise rápida (Gemini 3 Flash) | ~0.3 – 0.8 cr. |
| Análise otimizada (Sonnet 5) | ~0.8 – 1.5 cr. |
| Validada por Especialista (Opus 5 / GPT-5.6 Terra) | ~1.5 – 3.5 cr. |
| Página de PDF (Processamento de visão) | ~0.3 cr. por página |
| Copiadora local / calculadoras | Grátis |

**Pacotes:**
- **Starter:** 50 créditos — $9.99
- **Standard:** 150 créditos — $24.99
- **Pro:** 500 créditos — $69.99

O custo exato de cada solicitação é mostrado no bloco de resultados imediatamente após a conclusão da análise. O histórico completo de transações está disponível em **Saldo e Histórico**.

---

## 💡 Dicas para Melhores Resultados

- Sempre adicione **contexto clínico** (Queixa principal, HMA, antecedentes principais) — isso melhora significativamente a relevância e a precisão.
- Use **PDFs com pesquisa de texto** (não digitalizações de imagem) para a Biblioteca Pessoal.
- Para ECG: use o **Claude Sonnet 5** no modo Otimizado para detalhes de arritmia.
- Para fraturas: o **Claude Sonnet 5** supera outros modelos (83% de precisão).
- Para genética complexa ou patologia rara: use o **Claude Opus 5** (modo Validado por Especialista).
- O sistema melhora com o tempo através do seu feedback — por favor, avalie as respostas da IA após os testes.