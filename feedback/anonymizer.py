"""
anonymizer.py - Удаление ПИ из медицинских текстов

Запуск:
    python -c "from feedback.anonymizer import MedicalAnonymizer; from pathlib import Path; m = MedicalAnonymizer(); count = m.batch_process(Path('data/raw_feedback'), Path('data/anonymized_cases/cases_latest.jsonl')); print(f'✅ {count} cases processed')"
"""

import json
import re
import uuid
from pathlib import Path
from typing import Dict
from datetime import datetime


class MedicalAnonymizer:
    """Удаляет ПИ (личные данные) из медицинских текстов"""

    PII_PATTERNS = {
        "фио_полное": r"\b[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\b",  # Фамилия Имя Отчество
        "фио_фамилия_отчество": r"\b[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:ович|евич|овна|евна|ич|ична)\b",  # Фамилия Отчество
        "фио_фамилия_имя": r"\b[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\b",  # Фамилия Имя (два слова с заглавной)
        "дата_рождения": r"\b(0?[1-9]|[12]\d|3[01])[/\-\.](0?[1-9]|1[012])[/\-\.]\d{4}\b",
        "медкарта": r"(?:№|N|номер)?\s*[А-Я]{0,2}[-/]?\d{4,10}",
        "телефон": r"\+?\s*7\s*[-\(\)]?\d{3}\s*[-\)]?\d{3}\s*[-]?\d{2}\s*[-]?\d{2}",
        "email": r"\S+@\S+\.\S+",
        "адрес": r"(?:ул\.|улица|пр\.|проспект|площ\.|площадь)\s+[^,\n]+(?:,\s*д\.\s*\d+)?",
        "паспорт": r"(?:паспорт|пасп\.)\s+[А-Я]{2}\s*\d{6}",
    }

    def __init__(self):
        self.stats = {"total": 0, "pii_found": 0}

    def anonymize(self, text: str) -> str:
        """Удаляет ПИ из текста"""
        if not text:
            return ""
        
        anonymized = text
        # Обрабатываем паттерны в порядке от более специфичных к менее специфичным
        # Сначала полное ФИО, потом фамилия+отчество, потом фамилия+имя
        pattern_order = [
            "фио_полное",
            "фио_фамилия_отчество", 
            "фио_фамилия_имя",
            "дата_рождения",
            "медкарта",
            "телефон",
            "email",
            "адрес",
            "паспорт"
        ]
        
        for category in pattern_order:
            if category in self.PII_PATTERNS:
                pattern = self.PII_PATTERNS[category]
                matches = list(re.finditer(pattern, anonymized, re.IGNORECASE))
                if matches:
                    self.stats["pii_found"] += len(matches)
                    anonymized = re.sub(pattern, f"[{category.upper()}]", anonymized, flags=re.IGNORECASE)
        
        return anonymized

    def process_feedback_file(self, feedback_file: Path) -> Dict:
        """Преобразует raw feedback в anonymized case"""
        with open(feedback_file, "r", encoding="utf-8") as f:
            raw = json.load(f)

        return {
            "case_id": str(uuid.uuid4()),
            "created_at": datetime.now().isoformat(),
            "analysis_type": raw.get("analysis_type", "UNKNOWN"),
            "input": self.anonymize(raw.get("input_case", "")),
            "model_output": raw.get("model_output", ""),  # Обычно не содержит ПИ
            "correctness": raw.get("correctness", ""),
            "correct_answer": self.anonymize(raw.get("correct_answer", "")),
            "specialty": raw.get("specialty", ""),
            "comment": self.anonymize(raw.get("comment", "")),
            "anonymization_applied": True
        }

    def batch_process(self, raw_feedback_dir: Path, output_file: Path) -> int:
        """Обрабатывает все feedback файлы и сохраняет в jsonl"""
        count = 0
        output_file.parent.mkdir(parents=True, exist_ok=True)

        if not raw_feedback_dir.exists():
            logger.warning(f"Папка {raw_feedback_dir} не существует")
            return 0

        with open(output_file, "a", encoding="utf-8") as out_f:
            for feedback_file in raw_feedback_dir.glob("*.json"):
                try:
                    case = self.process_feedback_file(feedback_file)
                    out_f.write(json.dumps(case, ensure_ascii=False) + "\n")
                    feedback_file.unlink()  # Удаляем исходный файл
                    count += 1
                    self.stats["total"] += 1
                except Exception as e:
                    import logging
                    logging.error(f"⚠️ Ошибка обработки {feedback_file}: {e}")

        return count


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    anonymizer = MedicalAnonymizer()
    raw_dir = Path("data/raw_feedback")
    output_file = Path(f"data/anonymized_cases/cases_{datetime.now().strftime('%Y%m')}.jsonl")
    output_file.parent.mkdir(parents=True, exist_ok=True)

    count = anonymizer.batch_process(raw_dir, output_file)
    print(f"✅ Обработано {count} кейсов")
    print(f"📊 Удалено ПИ: {anonymizer.stats['pii_found']} вхождений")
    print(f"📁 Сохранено в: {output_file}")


