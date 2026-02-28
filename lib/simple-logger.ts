/**
 * Lightweight usage logging by product sections.
 */

import { calculateCost } from './cost-calculator';
import { deductBalance } from './subscription-manager';

// Section slug -> English display name mapping.
const SECTION_NAMES: Record<string, string> = {
  'lab': 'Laboratory Data',
  'ecg': 'ECG',
  'mri': 'MRI',
  'ct': 'CT',
  'xray': 'X-Ray',
  'ultrasound': 'Ultrasound',
  'genetic': 'Genetics',
  'video': 'Video Analysis',
  'document': 'Document Scan',
  'dermatoscopy': 'Dermoscopy',
  'histology': 'Histology',
  'retinal': 'Ophthalmology (Retina)',
  'mammography': 'Mammography',
  'image-analysis': 'Image Analysis',
  'chat': 'AI Assistant',
  'protocols': 'Clinical Guidelines',
};

interface UsageBySectionData {
  [section: string]: {
    sectionName: string;
    calls: number;
    costUnits: number;
    models: { [model: string]: number };
  };
}

function normalizeSectionData(data: UsageBySectionData): UsageBySectionData {
  const normalized: UsageBySectionData = {};
  for (const [section, payload] of Object.entries(data)) {
    normalized[section] = {
      ...payload,
      sectionName: SECTION_NAMES[section] || payload.sectionName || section,
    };
  }
  return normalized;
}

/**
 * Log model usage.
 */
export function logUsage(params: {
  section: string; // 'lab', 'ecg', 'mri', etc.
  model: string;
  inputTokens: number;
  outputTokens: number;
  specialty?: string;
}): void {
  try {
    if (typeof window === 'undefined') return;
    
    // Check and rotate monthly stats.
    checkAndResetMonth();

    // Calculate call cost.
    const costInfo = calculateCost(params.inputTokens, params.outputTokens, params.model);

    // Load current snapshot.
    const savedData = localStorage.getItem('usageBySections');
    const data: UsageBySectionData = normalizeSectionData(savedData ? JSON.parse(savedData) : {});

    // Resolve canonical section name.
    const sectionName = SECTION_NAMES[params.section] || params.section;

    // Initialize section if needed.
    if (!data[params.section]) {
      data[params.section] = {
        sectionName,
        calls: 0,
        costUnits: 0,
        models: {},
      };
    }
    data[params.section].sectionName = sectionName;

    // Update counters.
    data[params.section].calls += 1;
    data[params.section].costUnits += costInfo.totalCostUnits;
    
    // Deduct user balance.
    deductBalance({
      section: params.section,
      sectionName: sectionName,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      operation: 'AI Analysis',
      specialty: params.specialty
    });
    
    // Track model usage.
    if (!data[params.section].models[params.model]) {
      data[params.section].models[params.model] = 0;
    }
    data[params.section].models[params.model] += 1;

    // Persist snapshot.
    localStorage.setItem('usageBySections', JSON.stringify(data));

    console.log(`📊 [USAGE] Logged: ${sectionName}, ${params.model}, ${costInfo.totalCostUnits.toFixed(2)} cr.`);
  } catch (error) {
    console.error('❌ [USAGE] Error logging usage:', error);
  }
}

/**
 * Reset stats when month changes.
 */
function checkAndResetMonth(): void {
  if (typeof window === 'undefined') return;
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthKey = `${currentYear}-${currentMonth}`;

  const savedMonth = localStorage.getItem('statsMonth');

  if (savedMonth !== monthKey) {
    localStorage.removeItem('usageBySections');
    localStorage.setItem('statsMonth', monthKey);
    console.log('📅 [USAGE] New month detected, stats reset');
  }
}

/**
 * Read section usage statistics.
 */
export function getUsageBySections(): UsageBySectionData {
  try {
    if (typeof window === 'undefined') return {};
    const savedData = localStorage.getItem('usageBySections');
    return normalizeSectionData(savedData ? JSON.parse(savedData) : {});
  } catch (error) {
    console.error('❌ [USAGE] Error loading usage data:', error);
    return {};
  }
}

/**
 * Get localized current month label.
 */
export function getCurrentMonthName(): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  return `${months[currentMonth]} ${currentYear}`;
}

/**
 * Clear current month stats.
 */
export function clearCurrentMonthStats(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('usageBySections');
  console.log('🗑️ [USAGE] Current month stats cleared');
}




