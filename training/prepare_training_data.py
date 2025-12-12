"""
prepare_training_data.py - Подготовка данных для LoRA дообучения

Запуск:
    python training/prepare_training_data.py
"""

import json
from pathlib import Path


def prepare_sft_data(anonymized_cases_file: Path, output_file: Path):
    """
    Преобразует анонимизированные кейсы в формат для обучения (SFT).

    Формат:
    {
        "instruction": "You are an experienced physician...",
        "input": "Пациент с симптомами...",
        "output": "Диагноз: ..."
    }
    """

    sft_examples = []

    with open(anonymized_cases_file, "r", encoding="utf-8") as f:
        for line in f:
            case = json.loads(line)

            # Берём только случаи с правильными ответами или частичными
            if case["correctness"] in ["✅ Полностью верно", "⚠️ Частично верно"]:
                target = case["correct_answer"] or case["model_output"]
            else:
                # Если ошибка - берём правильный ответ от врача
                target = case["correct_answer"]

            if not target or not case["input"]:
                continue

            sft_examples.append({
                "instruction": "You are an experienced physician. Analyze the following medical case and provide a structured diagnosis with differential diagnoses and recommendations.",
                "input": case["input"],
                "output": target,
                "specialty": case.get("specialty", "general")
            })

    # Сохраняем в jsonl
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        for example in sft_examples:
            f.write(json.dumps(example, ensure_ascii=False) + "\n")

    print(f"✅ Подготовлено {len(sft_examples)} примеров для обучения")
    print(f"📁 Сохранено в: {output_file}")

    return sft_examples


if __name__ == "__main__":
    # Находим последний файл с кейсами
    cases_dir = Path("data/anonymized_cases")

    if not cases_dir.exists():
        print("❌ Папка data/anonymized_cases не найдена!")
        print("Сначала запустите аноним. скрипт")
        exit(1)

    # Ищем все .jsonl файлы и берём новейший
    case_files = sorted(cases_dir.glob("*.jsonl"), reverse=True)

    if not case_files:
        print("❌ Нет anonymized кейсов для обучения!")
        exit(1)

    latest_case_file = case_files[0]
    output_file = Path("data/training_data/flash_sft.jsonl")

    print(f"📥 Обрабатываю: {latest_case_file}")
    prepare_sft_data(latest_case_file, output_file)










