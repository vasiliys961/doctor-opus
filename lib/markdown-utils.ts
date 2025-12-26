/**
 * Утилиты для нормализации markdown текста
 * Аналогично функции normalize_markdown из бэкенда
 */

export function normalizeMarkdown(text: string): string {
  if (!text) {
    return "";
  }
  
  let s = text.trim();

  // Если ответ завернут в ```...```, убираем эти границы
  if (s.startsWith("```")) {
    const lines = s.split("\n");
    if (lines.length > 0 && lines[0].trim().startsWith("```")) {
      lines.shift();
    }
    if (lines.length > 0 && lines[lines.length - 1].trim().startsWith("```")) {
      lines.pop();
    }
    s = lines.join("\n").trim();
  }

  // Преобразуем строки, которые начинаются с '* ' в маркеры списка '- '
  const lines = s.split("\n");
  const normalizedLines: string[] = [];
  
  for (const line of lines) {
    const stripped = line.trimStart();
    
    // Обрабатываем списки (строки, начинающиеся с '* ')
    if (stripped.startsWith("* ")) {
      const indent = line.slice(0, line.length - stripped.length);
      // Гарантируем пустую строку перед списком для корректного рендера markdown
      if (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1].trim() !== "") {
        normalizedLines.push("");
      }
      // Убираем звездочку из начала и заменяем на дефис
      let listText = stripped.slice(2);
      // Убираем все звездочки из текста списка (жирный текст, курсив и т.д.)
      listText = listText.replace(/\*\*/g, '').replace(/\*/g, '');
      normalizedLines.push(indent + "- " + listText);
    } else {
      // Для обычных строк убираем все звездочки
      let normalizedLine = line;
      // Сначала убираем двойные звездочки для жирного текста (**текст** -> текст)
      normalizedLine = normalizedLine.replace(/\*\*/g, '');
      // Затем убираем все оставшиеся одиночные звездочки
      normalizedLine = normalizedLine.replace(/\*/g, '');
      normalizedLines.push(normalizedLine);
    }
  }

  s = normalizedLines.join("\n").trim();

  return s;
}

