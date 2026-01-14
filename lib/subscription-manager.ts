/**
 * Система управления балансом подписчика (в единицах)
 * БЕЗОПАСНАЯ ВЕРСИЯ - с полной изоляцией и обработкой ошибок
 */

import { calculateCost } from './cost-calculator';

// Глобальный флаг включения системы (Всегда включено для учета, блокировка зависит от env)
const SUBSCRIPTION_ENABLED = true;
const SUBSCRIPTION_STRICT_MODE = process.env.NEXT_PUBLIC_SUBSCRIPTION_STRICT_MODE === 'true';

// Настройки стартового баланса
export const ANONYMOUS_BALANCE = 10; // 10 ед. анонимно
export const REGISTERED_BONUS = 20;  // +20 ед. за регистрацию
export const SOFT_LIMIT = -5;        // Разрешаем уходить в минус до -5 ед.

// VIP пользователи с бесконечным балансом
// VIP пользователи с бесконечным балансом
export const VIP_EMAILS = [
  'vasiliys@mail.ru',
  'vasily61@gmail.com',
  'admin@doctor-opus.ru'
];

export function isVIP(email?: string | null): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  return VIP_EMAILS.some(v => v.toLowerCase() === emailLower);
}

// Курс конвертации USD -> единицы (настраивается через .env)
const USD_TO_CREDITS_RATE = parseInt(process.env.NEXT_PUBLIC_USD_TO_CREDITS || '100');

// Пакеты подписки (100% маржа)
// При курсе 100 ед./USD: 1000₽ = ~500 ед., 2500₽ = ~1250 ед.
export const SUBSCRIPTION_PACKAGES = {
  trial: { 
    name: 'Пробный', 
    credits: 250,
    priceRub: 500,
    bonusPercent: 0
  },
  basic: { 
    name: 'Базовый', 
    credits: 500,
    priceRub: 1000,
    bonusPercent: 0
  },
  pro: { 
    name: 'Профессиональный', 
    credits: 1250,
    priceRub: 2500,
    bonusPercent: 0
  },
} as const;

export interface SubscriptionBalance {
  initialCredits: number;
  currentCredits: number;
  totalSpent: number;
  packageName: string;
  packagePriceRub: number;
  purchaseDate: string;
  expiryDate: string | null;
  isUnlimited?: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  section: string;
  sectionName: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costCredits: number;
  operation: string;
}

const BALANCE_KEY = 'userSubscriptionBalance';
const TRANSACTIONS_KEY = 'userTransactions';

/**
 * Проверка доступности системы
 */
export function isSubscriptionEnabled(): boolean {
  return SUBSCRIPTION_ENABLED;
}

/**
 * Безопасное получение баланса
 */
export function getBalance(): SubscriptionBalance | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!window.localStorage) return null;
    
    const data = localStorage.getItem(BALANCE_KEY);
    let balance: SubscriptionBalance;

    if (!data) {
      // Инициализируем анонимный баланс
      balance = {
        initialCredits: ANONYMOUS_BALANCE,
        currentCredits: ANONYMOUS_BALANCE,
        totalSpent: 0,
        packageName: 'Пробный (Анонимный)',
        packagePriceRub: 0,
        purchaseDate: new Date().toISOString(),
        expiryDate: null,
      };
      localStorage.setItem(BALANCE_KEY, JSON.stringify(balance));
    } else {
      balance = JSON.parse(data);
    }

    // Если баланс ушел в минус и это VIP пользователь (через сохраненный пакет или флаг), исправляем
    if (balance.isUnlimited && balance.currentCredits < 100000) {
      balance.currentCredits = 999999;
      localStorage.setItem(BALANCE_KEY, JSON.stringify(balance));
    }
    
    return balance;
  } catch (error) {
    console.error('⚠️ [SUBSCRIPTION] Error loading balance:', error);
    return null;
  }
}

/**
 * Апгрейд баланса после регистрации (+20 ед) или установка безлимита для админов
 */
export function upgradeBalanceToRegistered(email?: string | null): void {
  try {
    const balance = getBalance();
    if (!balance) return;

    // Проверка на админский/VIP доступ
    if (isVIP(email)) {
      // Всегда форсируем безлимит для VIP, даже если уже есть баланс
      balance.currentCredits = 999999;
      balance.initialCredits = 999999;
      balance.packageName = 'Владелец (Безлимит)';
      balance.isUnlimited = true;
      localStorage.setItem(BALANCE_KEY, JSON.stringify(balance));
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('balanceUpdated'));
      }
      console.log(`👑 [SUBSCRIPTION] Форсирован безлимитный доступ для ${email}`);
      return;
    }

    const targetTotal = ANONYMOUS_BALANCE + REGISTERED_BONUS;

    // Если пакет все еще анонимный или начальный (со старым балансом), корректируем до 30 ед.
    if (balance.packageName.includes('Анонимный') || balance.packageName.includes('Free')) {
      // Чтобы не было 50 (30 старых + 20 новых), устанавливаем ровно 30 итого
      if (balance.initialCredits < targetTotal) {
        const diff = targetTotal - balance.initialCredits;
        balance.currentCredits += diff;
        balance.initialCredits = targetTotal;
      } else if (balance.initialCredits > targetTotal && balance.packageName.includes('Free')) {
        // Если вдруг было 50 или больше в "Free" режиме, сбрасываем до 30
        balance.initialCredits = targetTotal;
        balance.currentCredits = Math.min(balance.currentCredits, targetTotal);
      }
      
      balance.packageName = 'Стартовый (Зарегистрирован)';
      localStorage.setItem(BALANCE_KEY, JSON.stringify(balance));
      
      // Вызываем событие обновления баланса для UI
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('balanceUpdated'));
      }
      
      console.log(`🎁 [SUBSCRIPTION] Баланс обновлен до стартового: ${targetTotal} ед.`);
    }
  } catch (error) {
    console.error('❌ [SUBSCRIPTION] Error upgrading balance:', error);
  }
}

/**
 * Инициализация баланса (покупка пакета)
 */
export function initializeBalance(packageKey: keyof typeof SUBSCRIPTION_PACKAGES): boolean {
  try {
    const pkg = SUBSCRIPTION_PACKAGES[packageKey];
    if (!pkg) {
      console.error('❌ [SUBSCRIPTION] Invalid package');
      return false;
    }

    // Повторная покупка - добавляем к текущему балансу
    const existingBalance = getBalance();
    const currentCredits = existingBalance ? existingBalance.currentCredits : 0;
    const newTotalCredits = currentCredits + pkg.credits;

    const balance: SubscriptionBalance = {
      initialCredits: newTotalCredits,
      currentCredits: newTotalCredits,
      totalSpent: existingBalance ? existingBalance.totalSpent : 0,
      packageName: pkg.name,
      packagePriceRub: pkg.priceRub,
      purchaseDate: new Date().toISOString(),
      expiryDate: null,
    };

    localStorage.setItem(BALANCE_KEY, JSON.stringify(balance));
    
    if (existingBalance) {
      console.log(`✅ [SUBSCRIPTION] Пополнение: +${pkg.credits} ед. Новый баланс: ${newTotalCredits} ед.`);
    } else {
      console.log(`✅ [SUBSCRIPTION] Пакет "${pkg.name}" активирован: ${pkg.credits} ед.`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ [SUBSCRIPTION] Error initializing balance:', error);
    return false;
  }
}

/**
 * Получение транзакций
 */
export function getTransactions(): Transaction[] {
  try {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('⚠️ [SUBSCRIPTION] Error loading transactions:', error);
    return [];
  }
}

/**
 * Списание единиц (БЕЗОПАСНАЯ версия)
 */
export function deductBalance(params: {
  section: string;
  sectionName: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  operation: string;
}): { success: boolean; message?: string; cost?: number } {
  try {
    // Если система отключена - пропускаем
    if (!SUBSCRIPTION_ENABLED) {
      return { success: true };
    }

    const balance = getBalance();
    
    // Если баланса нет - не блокируем, просто пропускаем
    if (!balance) {
      console.log('ℹ️ [SUBSCRIPTION] Баланс не активирован, операция выполняется без списания');
      return { success: true };
    }

    // Если безлимитный доступ - не списываем
    if (balance.isUnlimited) {
      console.log('👑 [SUBSCRIPTION] Безлимитный доступ: списание пропущено');
      return { success: true, cost: 0 };
    }

    // Расчет стоимости
    const costInfo = calculateCost(params.inputTokens, params.outputTokens, params.model);
    const costCredits = costInfo.totalCostUnits; // Используем float для точности

    // Проверка достаточности средств с учетом "мягкого лимита"
    if (SUBSCRIPTION_STRICT_MODE && (balance.currentCredits - costCredits) < SOFT_LIMIT) {
      console.warn(`⚠️ [SUBSCRIPTION] Превышен лимит: нужно ${costCredits.toFixed(2)}, доступно ${balance.currentCredits.toFixed(2)}, лимит ${SOFT_LIMIT}`);
      return { 
        success: false, 
        message: `Недостаточно единиц. Баланс: ${balance.currentCredits.toFixed(2)}, требуется: ${costCredits.toFixed(2)}. Пожалуйста, пополните пакет.`,
        cost: costCredits
      };
    }

    // Списание (происходит всегда, если не заблокировано выше)
    balance.currentCredits -= costCredits;
    balance.totalSpent += costCredits;
    localStorage.setItem(BALANCE_KEY, JSON.stringify(balance));

    // Вызываем событие обновления баланса для UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('balanceUpdated'));
    }

    // Транзакция
    const transaction: Transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: new Date().toISOString(),
      section: params.section,
      sectionName: params.sectionName,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costUsd: costInfo.totalCostUsd,
      costCredits: costCredits,
      operation: params.operation,
    };

    const transactions = getTransactions();
    transactions.push(transaction);
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));

    console.log(`💰 [SUBSCRIPTION] Списано ${costCredits.toFixed(2)} ед. Остаток: ${balance.currentCredits.toFixed(2)} ед.`);
    
    return { success: true, cost: costCredits };
  } catch (error) {
    console.error('❌ [SUBSCRIPTION] Error deducting balance:', error);
    // При ошибке не блокируем работу
    return { success: true };
  }
}

/**
 * Процент использования
 */
export function getUsagePercentage(): number {
  try {
    const balance = getBalance();
    if (!balance || balance.initialCredits === 0) return 0;
    return (balance.totalSpent / balance.initialCredits) * 100;
  } catch {
    return 0;
  }
}

/**
 * Оценка стоимости операции
 */
export function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  try {
    const costInfo = calculateCost(inputTokens, outputTokens, model);
    return Math.ceil(costInfo.totalCostUsd * USD_TO_CREDITS_RATE);
  } catch {
    return 0;
  }
}

/**
 * Очистка данных (для тестирования)
 */
export function clearBalance(): void {
  try {
    localStorage.removeItem(BALANCE_KEY);
    localStorage.removeItem(TRANSACTIONS_KEY);
    console.log('🗑️ [SUBSCRIPTION] Данные очищены');
  } catch (error) {
    console.error('❌ [SUBSCRIPTION] Error clearing data:', error);
  }
}

/**
 * Стоимость 1 единицы в рублях
 */
export function getCreditPriceInRub(packageKey: keyof typeof SUBSCRIPTION_PACKAGES): number {
  try {
    const pkg = SUBSCRIPTION_PACKAGES[packageKey];
    const creditsWithBonus = Math.floor(pkg.credits * (1 + pkg.bonusPercent / 100));
    return pkg.priceRub / creditsWithBonus;
  } catch {
    return 0;
  }
}

