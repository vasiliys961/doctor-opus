#!/usr/bin/env python3
"""
Расчет стоимости анализа на основе реальных логов
"""

# Цены моделей (USD за 1M токенов)
GEMINI_2_5_FLASH_PRICES = {
    'input': 0.30,   # $0.30 за 1M input токенов
    'output': 2.50   # $2.50 за 1M output токенов
}

OPUS_4_5_PRICES = {
    'input': 5.0,    # $5.0 за 1M input токенов
    'output': 25.0   # $25.0 за 1M output токенов
}

# Курс доллара
USD_TO_RUB = 100

def calculate_cost(tokens_total, input_ratio, prices):
    """
    Рассчитать стоимость при известном общем количестве токенов
    
    Args:
        tokens_total: Общее количество токенов
        input_ratio: Доля input токенов (0.0-1.0)
        prices: Словарь с ценами {'input': float, 'output': float}
    """
    tokens_input = tokens_total * input_ratio
    tokens_output = tokens_total * (1 - input_ratio)
    
    cost_input = (tokens_input / 1_000_000) * prices['input']
    cost_output = (tokens_output / 1_000_000) * prices['output']
    
    return {
        'tokens_input': tokens_input,
        'tokens_output': tokens_output,
        'cost_input_usd': cost_input,
        'cost_output_usd': cost_output,
        'cost_total_usd': cost_input + cost_output,
        'cost_total_rub': (cost_input + cost_output) * USD_TO_RUB
    }

# Данные из логов
gemini_tokens = 2327
opus_tokens = 722

print("=" * 70)
print("РАСЧЕТ СТОИМОСТИ АНАЛИЗА ИЗ ЛОГОВ")
print("=" * 70)
print()

# Для Gemini: обычно ~80% input (промпт + изображение), 20% output (JSON)
print("📊 Этап 1: Gemini 2.5 Flash JSON Extraction")
print(f"   Всего токенов: {gemini_tokens}")
print()

gemini_cost_80_20 = calculate_cost(gemini_tokens, 0.80, GEMINI_2_5_FLASH_PRICES)
print(f"   Предположение: 80% input, 20% output")
print(f"   Input: {gemini_cost_80_20['tokens_input']:.0f} токенов = ${gemini_cost_80_20['cost_input_usd']:.6f}")
print(f"   Output: {gemini_cost_80_20['tokens_output']:.0f} токенов = ${gemini_cost_80_20['cost_output_usd']:.6f}")
print(f"   Итого: ${gemini_cost_80_20['cost_total_usd']:.6f} (~{gemini_cost_80_20['cost_total_rub']:.2f} руб)")
print()

# Для Opus в двухэтапной схеме: обычно ~60% input (промпт + JSON), 40% output (заключение)
print("🔍 Этап 2: Opus 4.5 Validation")
print(f"   Всего токенов: {opus_tokens}")
print()

opus_cost_60_40 = calculate_cost(opus_tokens, 0.60, OPUS_4_5_PRICES)
print(f"   Предположение: 60% input, 40% output")
print(f"   Input: {opus_cost_60_40['tokens_input']:.0f} токенов = ${opus_cost_60_40['cost_input_usd']:.6f}")
print(f"   Output: {opus_cost_60_40['tokens_output']:.0f} токенов = ${opus_cost_60_40['cost_output_usd']:.6f}")
print(f"   Итого: ${opus_cost_60_40['cost_total_usd']:.6f} (~{opus_cost_60_40['cost_total_rub']:.2f} руб)")
print()

# Общая стоимость
total_cost_usd = gemini_cost_80_20['cost_total_usd'] + opus_cost_60_40['cost_total_usd']
total_cost_rub = total_cost_usd * USD_TO_RUB

print("=" * 70)
print("ИТОГОВАЯ СТОИМОСТЬ")
print("=" * 70)
print(f"Gemini: ${gemini_cost_80_20['cost_total_usd']:.6f} (~{gemini_cost_80_20['cost_total_rub']:.2f} руб)")
print(f"Opus:   ${opus_cost_60_40['cost_total_usd']:.6f} (~{opus_cost_60_40['cost_total_rub']:.2f} руб)")
print(f"Итого: ${total_cost_usd:.6f} (~{total_cost_rub:.2f} руб)")
print()

# Пересчет в единицы (где 1 единица = $0.08 по себестоимости старой схемы)
unit_cost_old = 0.08  # Старая схема Opus end-to-end
units_equivalent = total_cost_usd / unit_cost_old

print("=" * 70)
print("ПЕРЕСЧЕТ В ЕДИНИЦЫ")
print("=" * 70)
print(f"Реальная себестоимость: {units_equivalent:.3f} единицы (по себестоимости)")
print(f"Для пользователя: 1 единица (не изменилось)")
print(f"Экономия: {1.0 - units_equivalent:.3f} единицы ({((1.0 - units_equivalent) / 1.0 * 100):.1f}%)")
print()

# Сравнение со старой схемой
old_scheme_cost = 0.08  # $0.08 за Opus end-to-end
savings_usd = old_scheme_cost - total_cost_usd
savings_percent = (savings_usd / old_scheme_cost) * 100

print("=" * 70)
print("СРАВНЕНИЕ СО СТАРОЙ СХЕМОЙ")
print("=" * 70)
print(f"Старая схема (Opus end-to-end): ${old_scheme_cost:.6f}")
print(f"Новая схема (Gemini → Opus):     ${total_cost_usd:.6f}")
print(f"Экономия: ${savings_usd:.6f} ({savings_percent:.1f}%)")
print()

