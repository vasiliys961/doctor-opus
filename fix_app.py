#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Скрипт для удаления некорректного блока кода из app.py"""

with open('app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Найдем индексы строк с комментарием о show_statistics_page
indices = []
for i, line in enumerate(lines):
    if '# Функция show_statistics_page() вынесена в pages/statistics_page.py' in line:
        indices.append(i)

print(f'Найдено вхождений: {len(indices)}')
for idx in indices:
    print(f'Строка {idx+1}: {lines[idx].strip()[:60]}')

# Второе вхождение (около строки 914) - начало блока для удаления
# Третье вхождение (около строки 1704) - конец блока для удаления
if len(indices) >= 3:
    start_idx = indices[1]  # Второе вхождение (строка 914)
    end_idx = indices[2]     # Третье вхождение (строка 1704)
    
    print(f'\nУдаляем строки от {start_idx+1} до {end_idx}')
    print(f'Первая строка для удаления: {repr(lines[start_idx+1][:60])}')
    print(f'Последняя строка для удаления: {repr(lines[end_idx-1][:60])}')
    
    # Удаляем строки от start_idx+1 до end_idx (не включая end_idx, так как это комментарий который нужно оставить)
    new_lines = lines[:start_idx+1] + lines[end_idx:]
    
    with open('app.py', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print(f'\nУдалено {end_idx - start_idx - 1} строк')
    print(f'Файл теперь содержит {len(new_lines)} строк')
else:
    print('Не найдено достаточно вхождений для удаления')
