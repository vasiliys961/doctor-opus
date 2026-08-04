# 📘 Doctor Opus — Guide de l'utilisateur (Médecin)

> **Important :** Doctor Opus est un système d'aide à la décision clinique (SADC) destiné **exclusivement aux professionnels de santé agréés**. Il n'est pas approuvé par la FDA et ne constitue pas un diagnostic médical. Tous les résultats générés par l'IA nécessitent une vérification clinique indépendante. Vous assumez l'entière responsabilité de toutes les décisions cliniques.

Doctor Opus accélère votre flux de travail clinique en fournissant une interprétation assistée par IA de l'imagerie médicale, des données de laboratoire, des rapports génétiques et des notes cliniques. Chaque section contient des conseils contextuels — consultez-les lors de la première utilisation.

L'application fonctionne sur ordinateur et mobile. Les deux peuvent fonctionner indépendamment ou en tandem via le module de synchronisation multi-appareils.

---

## 📱 Installer comme application mobile (PWA)

La plateforme est une Progressive Web App — installez-la sur votre écran d'accueil pour un accès de type natif.

### iPhone (Safari)
1. Ouvrez **doctor-opus.online** dans **Safari**
2. Appuyez sur le bouton **Partager** (carré avec une flèche) en bas
3. Faites défiler vers le bas et sélectionnez **"Sur l'écran d'accueil"**
4. Appuyez sur **"Ajouter"** dans le coin supérieur droit
5. Terminé — l'icône Doctor Opus apparaîtra sur votre écran d'accueil

### Android (Chrome)
1. Ouvrez **doctor-opus.online** dans **Chrome**
2. Appuyez sur le **menu à trois points** (⋮) dans le coin supérieur droit
3. Sélectionnez **"Ajouter à l'écran d'accueil"** ou **"Installer l'application"**
4. Confirmez l'installation
5. Terminé — l'icône apparaîtra sur votre écran d'accueil

Une fois installée, l'application s'ouvre en plein écran, est accessible via l'icône et fonctionne même avec une connexion médiocre (sauf pour les fonctionnalités d'IA qui nécessitent le réseau).

---

## 🏠 Accueil

Tableau de bord général avec navigation rapide vers toutes les sections.

---

## 🤖 Assistant IA

L'intelligence centrale de la plateforme. Prend en charge le dialogue clinique ouvert, la discussion de cas, le diagnostic différentiel, la revue de littérature et l'analyse multi-fichiers.

**Modèles disponibles (menu déroulant) :**
- **GPT-5.6 Terra** — Idéal pour 80 % de l'imagerie, de l'IRM et des questions cliniques générales. Concis et efficace.
- **Claude Opus 5** — Raisonnement le plus approfondi. Idéal pour les cas complexes, la génétique et les pathologies rares. Plus lent, coût plus élevé.
- **Claude Sonnet 5** — Équilibré. Excellent pour les consultations rapides et l'évaluation des fractures.
- **Gemini 3 Flash** — Le plus rapide. Idéal pour les références rapides et l'extraction de données.

**L'assistant peut :**
- Répondre aux questions cliniques et maintenir un dialogue à plusieurs tours
- Accepter les résultats exportés de n'importe quelle autre section
- Se spécialiser en tant que consultant (Cardiologue, Neurologue, Orthopédiste, etc.)
- Effectuer des revues de littérature et des recherches basées sur des preuves
- Traiter les fichiers téléchargés (images, PDF, documents Word)
- Utiliser votre **Bibliothèque Personnelle** (RAG) — lorsqu'elle est activée, l'assistant puise ses réponses dans vos propres directives PDF et références téléchargées

**Rappel PHI (Informations de Santé Protégées) :** Ne saisissez pas les noms des patients, les dates de naissance ou d'autres informations identifiables dans le chat. Utilisez des descriptions anonymisées (ex: *"Homme de 65 ans, fumeur, toux depuis 3 semaines"*).

---

## 📚 Bibliothèque Personnelle (RAG)

Téléchargez vos propres directives cliniques PDF, manuels et atlas. Une fois traités, l'assistant IA peut y effectuer des recherches et citer des extraits pertinents directement dans le compte-rendu d'analyse.

- Capacité : jusqu'à ~1 Go (les collections plus importantes peuvent ralentir le navigateur sur du matériel bas de gamme)
- Les fichiers sont traités sur votre **serveur local** — ils ne sont pas envoyés à des services externes
- Utilisez des PDF avec texte consultable (pas de scans) pour de meilleurs résultats

---

## 📝 Protocole Clinique (Voix-vers-Note)

Convertit une dictée non structurée ou des notes tapées en une note clinique structurée spécifique à une spécialité — prête à être téléchargée au format **Word (.docx)**, modifiée et signée.

### Comment l'utiliser
1. Sélectionnez votre **spécialité** dans le menu déroulant (Cardiologie, Neurologie, Orthopédie, etc.)
2. Dictez ou tapez les notes de consultation dans n'importe quel ordre — l'IA les structure automatiquement
3. Cliquez sur **Générer le protocole** — la note formatée apparaît dans le panneau de droite
4. Téléchargez en `.docx`, révisez et signez

**La structure de la note suit le format SOAP / H&P :**
- **S** — Subjectif (Motif de consultation, Histoire de la maladie, Antécédents, médicaments, allergies)
- **O** — Objectif (Signes vitaux, examen physique)
- **A** — Évaluation (Diagnostic de travail, différentiel)
- **P** — Plan (Diagnostics, traitement, suivi)

Vous pouvez personnaliser n'importe quel modèle pour l'adapter à votre flux de travail. La version personnalisée peut être épinglée comme votre standard personnel.

**Modèles recommandés :** GPT-5.6 Terra ou Claude Sonnet 5.

---

## 🧮 Calculateurs Médicaux

Lance une suite de calculateurs tiers intégrée. S'exécute côté client — aucun crédit consommé, aucune donnée transmise.

---

## 📋 Directives Cliniques

Recherchez les directives cliniques internationales actuelles par pathologie, syndrome ou classe de médicaments.

**Options de profondeur de recherche :**
- **Standard** — résumé concis du protocole avec les recommandations clés
- **Revue Clinique** — analyse approfondie : différentiel, échelles de score (CHADS₂, Wells, CURB-65, etc.), gestion étape par étape, algorithmes de traitement
- **Recherche en temps réel** — dernières publications 2024–2025 avec liens vers les sources

Après avoir reçu les résultats, vous pouvez poursuivre la conversation avec des questions de suivi en contexte.

---

## 🔬 Modules d'Analyse Spécialisés

### 📈 Analyse ECG

**Flux de travail :**
1. Téléchargez une image d'ECG (JPG, PNG ou scan PDF)
2. Ajoutez le **contexte clinique** (Motif, Histoire, médicaments pertinents) — améliore considérablement la précision
3. Utilisez les **🛡️ boutons d'anonymisation** avant de soumettre :
   - **Rapide :** Masque automatiquement les bords et les coins
   - **Précision :** Éditeur au pinceau pour un masquage exact
4. Sélectionnez le mode d'analyse (Rapide / Optimisé / Validé par Expert)

**Outils supplémentaires :**
- **Pied à coulisse numérique :** Faites glisser les marqueurs bleus pour mesurer les intervalles PR, QRS, QT. Calibrez à l'aide de la grille ECG (1 sec = 5 grands carreaux à 25 mm/s)
- **Recherche en bibliothèque :** Après l'analyse, cliquez pour trouver des cas ou des descriptions correspondants dans votre bibliothèque PDF personnelle

**Modèles recommandés :** GPT-5.6 Terra (général) · Claude Sonnet 5 (détails des arythmies)

---

### 🩻 Analyse de Radiographie (X-Ray)

Téléchargez une ou plusieurs images (dossier ou série DICOM). Ajoutez le contexte clinique pour un meilleur résultat.

**Anonymisation :**
- Rapide : masque automatiquement les zones PHI standard
- Précision : éditeur manuel au pinceau
- DICOM : métadonnées supprimées automatiquement

**Mode comparaison :** Activez **Avant/Après** pour comparer deux points temporels ou vues côte à côte.

**Meilleurs modèles :** GPT-5.6 Terra (80 % des cas) · Claude Sonnet 5 (fractures, 83 % de précision)

---

### 🧠 Analyse Scanner (CT)

Téléchargez des images CT ou un dossier DICOM complet.

**Visionneuse 3D (série DICOM) :**
- **MPR 2×2 :** Coupes Axiales / Coronales / Sagittales + modèle volumétrique
- **Cinematic 3D ✨ :** Rendu photoréaliste plein écran avec ombres douces
- **Préréglages cliniques :** Os, Tissus mous (effet rayons X), Glow (met en évidence les foyers pathologiques)
- Faites défiler les coupes avec la molette de la souris · Zoom · Rotation 3D libre
- Puce M1 : rendu avec accélération matérielle

Anonymisation PHI : manuelle et automatique (métadonnées DICOM supprimées automatiquement).

---

### 🧠 Analyse IRM (MRI)

Flux de travail identique au scanner. Prend en charge les séries DICOM multi-séquences avec rendu MPR complet et Cinematic 3D.

---

### 🔊 Analyse Échographique (Cine-loop)

Téléchargez une image statique **ou** une boucle vidéo (cine-loop).

**Extraction d'images :**
- **Auto-Extract :** Le système extrait automatiquement 5 à 12 images clés
- **Capture Manuelle :** Naviguez avec les boutons ±0,1s et capturez l'image exacte

Toutes les images sont anonymisées avant soumission (bandes noires sur les bords).

---

### 🔬 Analyse Dermatoscopique

Téléchargez des images de dermatoscopie. Ajoutez le contexte clinique (localisation de la lésion, durée, changements observés). Prend en charge l'analyse des critères ABCDE et l'évaluation du risque de malignité.

---

### 🧪 Analyse des Données de Laboratoire

Téléchargez un rapport de laboratoire (PDF, Excel, CSV ou photo d'un formulaire papier).

**Extraction intelligente :** Le système reconnaît automatiquement les paramètres, les valeurs et les plages de référence — même à partir de PDF multi-pages ou de formulaires manuscrits.

**Le compte-rendu d'analyse comprend :**
- Signalement des valeurs critiques
- Interprétation clinique dans le contexte de l'histoire de la maladie fournie
- Graphiques de tendance (si le patient est dans votre base de données)

---

### 🧬 Analyse Génétique

Téléchargez un rapport génétique au format **.VCF** (données brutes de laboratoire) ou **PDF**.

**Flux de travail :**
1. Téléchargez le fichier
2. **Étape 1 (Extraire) :** Gemini 3 Flash extrait les rsID et les génotypes du rapport
3. **Étape 2 (Interpréter) :** Claude Opus 5 fournit une interprétation clinique des risques
4. Continuez le dialogue avec le spécialiste en génétique pour les questions de suivi

Toujours anonymiser avant de soumettre (nom et adresse masqués automatiquement sur l'écran de prévisualisation).

---

### 🎬 Analyse Clinique Vidéo

Téléchargez n'importe quel fichier vidéo (démarche du patient, endoscopie, échocardiographie, boucle échographique, etc.).

**Deux modes :**

| Mode | Description | Utilisation |
|---|---|---|
| **Sécurisé (extraction d'images)** | Le système extrait 5–12 images, anonymise chacune, affiche un aperçu | Par défaut — toute vidéo avec ou sans PHI |
| **Vidéo complète** | Le fichier entier est envoyé non traité | Uniquement pour les fichiers déjà anonymisés |

> ⚠️ En mode Vidéo Complète, les images ne sont PAS anonymisées automatiquement. Confirmez l'absence de PHI avant utilisation.

---

### 🔍 Analyse Comparative

Comparaison côte à côte d'images médicales dans le temps ou par localisation.

**Modes de comparaison :**
- **Dans le temps** — évaluation de la progression (avant/après traitement)
- **Par localisation** — comparaison de scans de différentes régions anatomiques
- **Général** — comparaison libre de plusieurs images

Prend en charge les images uniques ainsi que les lots de vidéos/dossiers DICOM.

---

### 🔬 Analyse Avancée (Image + Contexte)

Téléchargez une image principale plus des fichiers supplémentaires optionnels (PDF, documents Word, photos). Ajoutez un contexte clinique détaillé. Recevez une directive clinique unifiée combinant toutes les entrées.

---

### 🧊 Visualisation 3D Avancée (Cinematic)

Rendu volumétrique haute fidélité dédié aux séries DICOM IRM et CT.

- **Mode Cinematic :** Diffusion de volume pour un rendu photoréaliste des organes
- **Vessel Highlight :** Les vaisseaux et les zones rehaussées par contraste apparaissent en rouge ; les tissus environnants deviennent semi-transparents
- **Qualité adaptative :** Résolution inférieure pendant la rotation pour une performance fluide ; restauration en haute qualité à l'arrêt
- **Optimisation Apple M1 :** Sous-échantillonnage automatique pour les études lourdes afin de maintenir la fluidité

---

## 📄 Numérisation de Documents

Transforme la caméra de votre smartphone en scanner de documents.

### Copieur Local (mode navigateur)
Fonctionne entièrement dans votre navigateur — pas d'IA, pas d'internet requis. 100 % privé.

**Caractéristiques :**
- Réglages de luminosité, contraste et niveaux de gris
- Exportation vers **Word (.docx)** ou **PDF** (via la boîte de dialogue d'impression du système)
- Gratuit — aucun crédit consommé

### OCR Intelligent (mode IA)
Extrait le texte et les tableaux des documents numérisés pour un traitement ultérieur.

**Protection PHI :**
- Bouton d'anonymisation obligatoire
- Masquage automatique des noms et adresses lorsqu'il est activé
- Éditeur **🎨 Masquage Manuel** : peignez sur n'importe quelle zone sensible avant de soumettre

---

## 👥 Base de Données Patients

Dossiers patients locaux stockés dans l'**IndexedDB de votre navigateur** — les données ne quittent jamais votre appareil.

**Caractéristiques :**
- Ajoutez des patients avec nom (alias anonymisé recommandé), âge, sexe, diagnostic, notes
- Enregistrez les résultats d'analyse dans les dossiers patients depuis n'importe quelle section d'analyse
- Visualisez l'historique des analyses, la chronologie et les graphiques de tendance des valeurs de laboratoire
- Résumé de cas par IA : résumé narratif en un clic de toutes les analyses enregistrées pour un patient

---

## 🔌 Connexion Directe d'Appareils (USB)

Lisez les données des moniteurs ECG, oxymètres de pouls, glucomètres et autres appareils à interface série directement via le navigateur — aucun pilote requis.

1. Allez dans la section **Appareils**
2. Sélectionnez la vitesse de transmission (généralement 115200)
3. Cliquez sur **Connecter** et sélectionnez votre appareil dans l'invite du navigateur (Chrome / Edge uniquement)
4. Visualisez la courbe ECG en direct ou les données des capteurs
5. Cliquez sur **Analyser le fragment** pour une interprétation immédiate par l'IA du segment actuel

---

## 🛡️ Confidentialité et Traitement des Données

Doctor Opus est construit sur un principe de **Local-First** — les données des patients restent sur votre appareil.

| Type de données | Lieu de stockage | Quitte l'appareil ? |
|---|---|---|
| Fiches patients & historique d'analyse | IndexedDB du navigateur | Jamais |
| Images médicales pendant l'analyse | RAM du navigateur | Uniquement fragments anonymisés |
| Résultats d'IA (enregistrés) | IndexedDB du navigateur | Non |
| Compte utilisateur & solde de crédits | PostgreSQL Cloud | Oui (aucune donnée médicale) |
| Statistiques d'analyse (anonymisées) | PostgreSQL Cloud | Oui (pas de PHI) |

**Anonymisation à trois niveaux avant tout appel à l'IA :**
1. Regex textuel côté navigateur — noms, dates, identifiants supprimés
2. Masquage sur canevas d'image — zones PHI peintes en noir
3. Nettoyage récursif côté serveur — tous les champs de la requête nettoyés avant OpenRouter

Aucune Information de Santé Protégée (PHI) ou Information Personnellement Identifiable (PII) liée aux scans médicaux n'est stockée dans la base de données cloud.

---

## 💰 Système de Crédits

Les crédits sont consommés lors de l'utilisation de modèles d'IA avancés. Les recherches de référence simples et les outils locaux sont gratuits.

| Opération | Coût en crédits (approx.) |
|---|---|
| Analyse rapide (Gemini 3 Flash) | ~0,3 – 0,8 cr. |
| Analyse optimisée (Sonnet 5) | ~0,8 – 1,5 cr. |
| Validé par Expert (Opus 5 / GPT-5.6 Terra) | ~1,5 – 3,5 cr. |
| Page PDF (Traitement Vision) | ~0,3 cr. par page |
| Copieur local / calculateurs | Gratuit |

**Forfaits :**
- **Starter :** 50 crédits — 9,99 $
- **Standard :** 150 crédits — 24,99 $
- **Pro :** 500 crédits — 69,99 $

Le coût exact de chaque requête est affiché dans le bloc de résultat immédiatement après la fin de l'analyse. L'historique complet des transactions est disponible dans **Solde & Historique**.

---

## 💡 Conseils pour de Meilleurs Résultats

- Ajoutez toujours le **contexte clinique** (Motif, Histoire, Antécédents clés) — cela améliore considérablement la pertinence et la précision.
- Utilisez des **PDF avec texte consultable** (pas de scans d'images) pour la Bibliothèque Personnelle.
- Pour l'ECG : utilisez **Claude Sonnet 5** en mode Optimisé pour les détails des arythmies.
- Pour les fractures : **Claude Sonnet 5** surpasse les autres modèles (83 % de précision).
- Pour la génétique complexe ou les pathologies rares : utilisez **Claude Opus 5** (mode Validé par Expert).
- Le système s'améliore au fil du temps grâce à vos retours — veuillez évaluer les réponses de l'IA après les tests.