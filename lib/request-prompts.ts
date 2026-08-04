export const REQUEST_PROMPTS = {
  xray: {
    single: 'Analyze the X-ray image and generate a diagnostic protocol.',
    comparative:
      'PERFORM A COMPARATIVE ANALYSIS OF THE CURRENT AND ARCHIVE X-RAY IMAGES. Describe the dynamics of changes (improvement, stabilization, progression).',
  },
  ct: {
    single: 'Analyze the CT study and generate a diagnostic protocol.',
  },
  mri: {
    single: 'Analyze the MRI study and generate a diagnostic protocol.',
  },
  ultrasound: {
    single: 'Analyze the ultrasound study and generate a diagnostic protocol.',
  },
  dermatoscopy: {
    single:
      'Analyze the dermoscopy image. Describe the structure, colors, borders, and signs of melanoma using ABCDE criteria.',
  },
  lab: {
    allPages:
      'Analyze the laboratory data from all pages. Extract all parameters, their values, and reference ranges.',
    single:
      'Analyze the laboratory data. Extract all parameters, their values, and reference ranges.',
  },
  document: {
    scan:
      'Scan and extract text from the medical document, PRESERVING STRUCTURE: tables, lists, headings, formatting.',
  },
} as const;
