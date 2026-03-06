export type OnboardingStatus = 'new' | 'chat_done' | 'protocol_done' | 'image_uploaded' | 'completed'

const ONBOARDING_STATUS_KEY = 'onboarding_status_v1'
const ONBOARDING_BONUS_GRANTED_KEY = 'onboarding_bonus_granted_v1'
const ONBOARDING_COMPLETION_PROMPT_SEEN_KEY = 'onboarding_completion_prompt_seen_v1'
const ONBOARDING_LAUNCH_COUNT_KEY = 'onboarding_launch_count_v1'
const ONBOARDING_MAX_LAUNCHES = 1

export function getOnboardingStatus(): OnboardingStatus {
  if (typeof window === 'undefined') return 'new'

  const rawValue = window.localStorage.getItem(ONBOARDING_STATUS_KEY)
  if (rawValue === 'chat_done' || rawValue === 'protocol_done' || rawValue === 'image_uploaded' || rawValue === 'completed') {
    return rawValue
  }

  // Совместимость со старой схемой статусов
  if (rawValue === 'menu_done') return 'chat_done'
  if (rawValue === 'file_uploaded') return 'image_uploaded'

  return 'new'
}

export function setOnboardingStatus(status: OnboardingStatus): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ONBOARDING_STATUS_KEY, status)
}

export function isOnboardingCompleted(): boolean {
  return getOnboardingStatus() === 'completed'
}

export function isOnboardingBonusGranted(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ONBOARDING_BONUS_GRANTED_KEY) === 'true'
}

export function markOnboardingBonusGranted(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ONBOARDING_BONUS_GRANTED_KEY, 'true')
}

export function isOnboardingCompletionPromptSeen(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ONBOARDING_COMPLETION_PROMPT_SEEN_KEY) === 'true'
}

export function markOnboardingCompletionPromptSeen(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ONBOARDING_COMPLETION_PROMPT_SEEN_KEY, 'true')
}

export function canLaunchOnboarding(): boolean {
  if (typeof window === 'undefined') return false
  const launches = Number(window.localStorage.getItem(ONBOARDING_LAUNCH_COUNT_KEY) || '0')
  return launches < ONBOARDING_MAX_LAUNCHES
}

export function registerOnboardingLaunch(): void {
  if (typeof window === 'undefined') return
  const launches = Number(window.localStorage.getItem(ONBOARDING_LAUNCH_COUNT_KEY) || '0')
  window.localStorage.setItem(ONBOARDING_LAUNCH_COUNT_KEY, String(launches + 1))
}
