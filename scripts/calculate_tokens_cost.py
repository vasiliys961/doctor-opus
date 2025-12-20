#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для подсчета токенов и стоимости анализа изображений
Анализирует логи и вычисляет стоимость в условных единицах
"""

# Цены моделей (USD за 1M токенов)
MODEL_PRICING = {
    'google/gemini-2.5-flash': {'input': 0.30, 'output': 2.50},
    'google/gemini-3-flash-preview': {'input': 0.50, 'output': 3.00},
    'google/gemini-3-flash': {'input': 0.50, 'output': 3.00},
    'anthropic/claude-opus-4.5': {'input': 15.0, 'output': 75.0},
    'anthropic/claude-sonnet-4.5': {'input': 3.0, 'output': 15.0},
}

USD_TO_RUB = 100  # Коэффициент пересчёта для условных единиц


def calculate_cost(tokens: int, model: str, input_ratio: float = 0.5) -> dict:
    """
    Рассчитать стоимость запроса в условных единицах
    
    Args:
        tokens: Общее количество токенов
        model: Название модели
        input_ratio: Доля входных токенов (по умолчанию 50%)
    
    Returns:
        dict с детальной информацией о стоимости
    """
    model_key = model.lower()
    pricing = None
    
    # Ищем подходящую цену
    for key, price in MODEL_PRICING.items():
        if key in model_key:
            pricing = price
            break
    
    if not pricing:
        # Дефолтные цены
        if 'opus' in model_key:
            pricing = {'input': 15.0, 'output': 75.0}
        elif 'gemini-3-flash' in model_key:
            pricing = {'input': 0.50, 'output': 3.00}
        elif 'gemini' in model_key or 'flash' in model_key:
            pricing = {'input': 0.30, 'output': 2.50}
        elif 'sonnet' in model_key:
            pricing = {'input': 3.0, 'output': 15.0}
        else:
            return {'input_tokens': 0, 'output_tokens': 0, 'cost_input': 0, 'cost_output': 0, 'total_cost': 0}
    
    input_tokens = int(tokens * input_ratio)
    output_tokens = tokens - input_tokens
    
    cost_input_usd = (input_tokens / 1_000_000) * pricing['input']
    cost_output_usd = (output_tokens / 1_000_000) * pricing['output']
    total_cost_usd = cost_input_usd + cost_output_usd
    
    return {
        'input_tokens': input_tokens,
        'output_tokens': output_tokens,
        'cost_input': cost_input_usd * USD_TO_RUB,
        'cost_output': cost_output_usd * USD_TO_RUB,
        'total_cost': total_cost_usd * USD_TO_RUB
    }


# Данные из логов
analyses = [
    # Двухэтапный валидированный анализ (Gemini → Opus)
    {
        'type': 'Двухэтапный (Gemini JSON → Opus)',
        'gemini': {'model': 'google/gemini-2.5-flash', 'tokens': 2284, 'input_ratio': 0.7},  # JSON extraction - больше input
        'opus': {'model': 'anthropic/claude-opus-4.5', 'tokens': 709, 'input_ratio': 0.6},  # Validation - больше input
    },
    {
        'type': 'Двухэтапный (Gemini JSON → Opus)',
        'gemini': {'model': 'google/gemini-2.5-flash', 'tokens': 3225, 'input_ratio': 0.7},
        'opus': {'model': 'anthropic/claude-opus-4.5', 'tokens': 988, 'input_ratio': 0.6},
    },
    {
        'type': 'Двухэтапный (Gemini JSON → Opus)',
        'gemini': {'model': 'google/gemini-2.5-flash', 'tokens': 3241, 'input_ratio': 0.7},
        'opus': {'model': 'anthropic/claude-opus-4.5', 'tokens': 877, 'input_ratio': 0.6},
    },
    {
        'type': 'Двухэтапный (Gemini JSON → Opus)',
        'gemini': {'model': 'google/gemini-2.5-flash', 'tokens': 2225, 'input_ratio': 0.7},
        'opus': {'model': 'anthropic/claude-opus-4.5', 'tokens': 826, 'input_ratio': 0.6},
    },
    {
        'type': 'Двухэтапный (Gemini JSON → Opus)',
        'gemini': {'model': 'google/gemini-2.5-flash', 'tokens': 1373, 'input_ratio': 0.7},
        'opus': {'model': 'anthropic/claude-opus-4.5', 'tokens': 0, 'input_ratio': 0.6},  # Не завершен
    },
    {
        'type': 'Двухэтапный (Gemini JSON → Opus)',
        'gemini': {'model': 'google/gemini-2.5-flash', 'tokens': 2353, 'input_ratio': 0.7},
        'opus': {'model': 'anthropic/claude-opus-4.5', 'tokens': 0, 'input_ratio': 0.6},  # Не завершен
    },
    {
        'type': 'Двухэтапный (Gemini JSON → Opus)',
        'gemini': {'model': 'google/gemini-2.5-flash', 'tokens': 1245, 'input_ratio': 0.7},
        'opus': {'model': 'anthropic/claude-opus-4.5', 'tokens': 0, 'input_ratio': 0.6},  # Не завершен
    },
    # Обычный анализ (Gemini Flash → Opus)
    {
        'type': 'Обычный двухэтапный (Gemini Flash → Opus)',
        'gemini': {'model': 'google/gemini-3-flash-preview', 'tokens': 4879, 'input_ratio': 0.6},
        'opus': {'model': 'anthropic/claude-opus-4.5', 'tokens': 0, 'input_ratio': 0.6},  # Streaming, токены не указаны
    },
]

print("=" * 80)
print("📊 ПОДСЧЕТ ТОКЕНОВ И СТОИМОСТИ АНАЛИЗА ИЗОБРАЖЕНИЙ")
print("=" * 80)
print()

# Группировка по типам
by_type = {}
for analysis in analyses:
    atype = analysis['type']
    if atype not in by_type:
        by_type[atype] = []
    by_type[atype].append(analysis)

# Подсчет для каждого типа
total_gemini_tokens = 0
total_opus_tokens = 0
total_gemini_cost = 0
total_opus_cost = 0

for atype, items in by_type.items():
    print(f"### {atype}")
    print("-" * 80)
    
    gemini_tokens = 0
    opus_tokens = 0
    gemini_cost = 0
    opus_cost = 0
    
    for i, analysis in enumerate(items, 1):
        gemini_data = analysis['gemini']
        opus_data = analysis.get('opus', {})
        
        # Gemini
        g_tokens = gemini_data['tokens']
        g_cost_detail = calculate_cost(g_tokens, gemini_data['model'], gemini_data['input_ratio'])
        gemini_tokens += g_tokens
        gemini_cost += g_cost_detail['total_cost']
        
        # Opus
        o_tokens = opus_data.get('tokens', 0)
        if o_tokens > 0:
            o_cost_detail = calculate_cost(o_tokens, opus_data['model'], opus_data['input_ratio'])
            opus_tokens += o_tokens
            opus_cost += o_cost_detail['total_cost']
        
        print(f"  Анализ #{i}:")
        g_cost_detail = calculate_cost(g_tokens, gemini_data['model'], gemini_data['input_ratio'])
        print(f"    Gemini: {g_tokens:,} токенов")
        print(f"      Входных: {g_cost_detail['input_tokens']:,} ({g_cost_detail['cost_input']:.2f} усл. ед.)")
        print(f"      Выходных: {g_cost_detail['output_tokens']:,} ({g_cost_detail['cost_output']:.2f} усл. ед.)")
        print(f"      Всего: {g_cost_detail['total_cost']:.2f} усл. ед.")
        
        if o_tokens > 0:
            o_cost_detail = calculate_cost(o_tokens, opus_data['model'], opus_data['input_ratio'])
            print(f"    Opus: {o_tokens:,} токенов")
            print(f"      Входных: {o_cost_detail['input_tokens']:,} ({o_cost_detail['cost_input']:.2f} усл. ед.)")
            print(f"      Выходных: {o_cost_detail['output_tokens']:,} ({o_cost_detail['cost_output']:.2f} усл. ед.)")
            print(f"      Всего: {o_cost_detail['total_cost']:.2f} усл. ед.")
            print(f"    ИТОГО: {g_tokens + o_tokens:,} токенов → {g_cost_detail['total_cost'] + o_cost_detail['total_cost']:.2f} усл. ед.")
        else:
            print(f"    Opus: не завершен")
        print()
    
    print(f"  📈 Итого по типу '{atype}':")
    print(f"    Gemini: {gemini_tokens:,} токенов → {gemini_cost:.2f} усл. ед.")
    if opus_tokens > 0:
        print(f"    Opus: {opus_tokens:,} токенов → {opus_cost:.2f} усл. ед.")
        print(f"    Всего: {gemini_tokens + opus_tokens:,} токенов → {gemini_cost + opus_cost:.2f} усл. ед.")
    else:
        print(f"    Opus: не завершен")
    print()
    
    total_gemini_tokens += gemini_tokens
    total_opus_tokens += opus_tokens
    total_gemini_cost += gemini_cost
    total_opus_cost += opus_cost

print("=" * 80)
print("💰 ОБЩАЯ СТАТИСТИКА")
print("=" * 80)
print(f"Gemini (все модели):")
print(f"  Токенов: {total_gemini_tokens:,}")
print(f"  Стоимость: {total_gemini_cost:.2f} усл. ед.")
print()
print(f"Opus 4.5:")
print(f"  Токенов: {total_opus_tokens:,}")
print(f"  Стоимость: {total_opus_cost:.2f} усл. ед.")
print()
print(f"ВСЕГО:")
print(f"  Токенов: {total_gemini_tokens + total_opus_tokens:,}")
print(f"  Стоимость: {total_gemini_cost + total_opus_cost:.2f} усл. ед.")
print()

# Средние значения
completed_analyses = [a for a in analyses if a.get('opus', {}).get('tokens', 0) > 0]
if completed_analyses:
    avg_gemini = sum(a['gemini']['tokens'] for a in completed_analyses) / len(completed_analyses)
    avg_opus = sum(a.get('opus', {}).get('tokens', 0) for a in completed_analyses) / len(completed_analyses)
    avg_total = avg_gemini + avg_opus
    
    avg_gemini_cost = sum(calculate_cost(a['gemini']['tokens'], a['gemini']['model'], a['gemini']['input_ratio'])['total_cost']
                          for a in completed_analyses) / len(completed_analyses)
    avg_opus_cost = sum(calculate_cost(a.get('opus', {}).get('tokens', 0), 
                                       a.get('opus', {}).get('model', ''), 
                                       a.get('opus', {}).get('input_ratio', 0.6))['total_cost']
                        for a in completed_analyses if a.get('opus', {}).get('tokens', 0) > 0) / len(completed_analyses)
    avg_total_cost = avg_gemini_cost + avg_opus_cost
    
    print("=" * 80)
    print("📊 СРЕДНИЕ ЗНАЧЕНИЯ (завершенные анализы)")
    print("=" * 80)
    print(f"Среднее на анализ:")
    print(f"  Gemini: {avg_gemini:.0f} токенов → {avg_gemini_cost:.2f} усл. ед.")
    print(f"  Opus: {avg_opus:.0f} токенов → {avg_opus_cost:.2f} усл. ед.")
    print(f"  Всего: {avg_total:.0f} токенов → {avg_total_cost:.2f} усл. ед.")
    print()

