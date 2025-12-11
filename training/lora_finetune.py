"""
lora_finetune.py - LoRA дообучение для медицинской модели

Главный скрипт для локального дообучения на MacBook.
Работает ~6-7 минут на M1/M3 с 30-50 примерами.

Запуск:
    python training/lora_finetune.py
"""

import torch
import json
from pathlib import Path
from datasets import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, TaskType
import warnings

warnings.filterwarnings("ignore")


def load_training_data(filepath: Path) -> Dataset:
    """Загружает training data из jsonl файла"""
    examples = []

    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            example = json.loads(line)
            # Формируем текст для обучения
            text = f"""Instruction: {example['instruction']}

Input: {example['input']}

Output: {example['output']}"""
            examples.append({"text": text})

    if not examples:
        print("❌ Нет данных для обучения!")
        return None

    return Dataset.from_list(examples)


def setup_lora(model, lora_rank: int = 8, lora_alpha: int = 32):
    """Настраивает LoRA для модели"""
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=lora_rank,
        lora_alpha=lora_alpha,
        lora_dropout=0.1,
        bias="none",
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    )

    model = get_peft_model(model, lora_config)
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())

    print(f"🎓 LoRA конфиг:")
    print(f"   Обучаемых параметров: {trainable_params:,}")
    print(f"   Всего параметров: {total_params:,}")
    print(f"   % обучаемых: {100 * trainable_params / total_params:.2f}%")

    return model


def finetune_flash(
    data_path: Path,
    model_name: str = "google/gemma-2-2b-it",
    output_dir: str = "data/models/flash_lora_v1",
    epochs: int = 3,
    batch_size: int = 1,
    learning_rate: float = 5e-4,
    max_length: int = 512,
):
    """
    Основная функция дообучения.

    Args:
        data_path: путь к training_data/flash_sft.jsonl
        model_name: модель из HF (gemma-2, mistral, llama и т.д.)
        output_dir: где сохранить веса
        epochs: количество эпох
        batch_size: размер батча (1 для MacBook)
        learning_rate: скорость обучения
        max_length: максимальная длина последовательности
    """

    print("🔄 Загружаем данные...")
    dataset = load_training_data(data_path)

    if dataset is None or len(dataset) == 0:
        print("❌ Нет данных для обучения!")
        return None

    print(f"✅ Загружено {len(dataset)} примеров")

    # Загружаем модель
    print(f"📥 Загружаем модель {model_name}...")
    try:
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else None,
            load_in_8bit=False
        )
        
        if not torch.cuda.is_available():
            # Для CPU/MacBook
            model = model.to("cpu")
        
    except Exception as e:
        print(f"❌ Ошибка загрузки модели: {e}")
        print("💡 Попробуйте другую модель или проверьте подключение к HuggingFace")
        return None

    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Токенизируем
    print("🔤 Токенизируем данные...")

    def tokenize_function(examples):
        return tokenizer(
            examples["text"],
            padding="max_length",
            truncation=True,
            max_length=max_length
        )

    tokenized_dataset = dataset.map(
        tokenize_function,
        batched=True,
        remove_columns=["text"]
    )

    # Настраиваем LoRA
    print("⚙️ Настраиваем LoRA...")
    model = setup_lora(model, lora_rank=8, lora_alpha=32)

    # Обучаем
    print("🚀 Начинаем обучение...")
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    training_args = TrainingArguments(
        output_dir=str(output_path),
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=1,
        learning_rate=learning_rate,
        weight_decay=0.01,
        save_strategy="epoch",
        logging_steps=5,
        save_total_limit=2,
        bf16=False,
        tf32=False,
        report_to=None,  # Не отправляем в wandb/tensorboard
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset,
        data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
    )

    try:
        trainer.train()
    except Exception as e:
        print(f"❌ Ошибка во время обучения: {e}")
        return None

    # Сохраняем финальные веса
    final_dir = Path(output_dir) / "final"
    final_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"💾 Сохраняем веса в {final_dir}...")
    model.save_pretrained(str(final_dir))
    tokenizer.save_pretrained(str(final_dir))

    print("✅ Дообучение завершено!")
    print(f"📁 Веса сохранены в: {final_dir}")

    return model


if __name__ == "__main__":
    # Пример использования:
    data_file = Path("data/training_data/flash_sft.jsonl")

    if not data_file.exists():
        print(f"❌ Файл {data_file} не найден!")
        print("Сначала запустите prepare_training_data.py")
        exit(1)

    print(f"🚀 Начинаем дообучение модели...")
    print(f"📁 Данные: {data_file}")
    
    model = finetune_flash(
        data_path=data_file,
        output_dir="data/models/flash_lora_v1",
        epochs=3,
        batch_size=1,
        learning_rate=5e-4
    )
    
    if model:
        print("\n✅ Дообучение успешно завершено!")
        print("💡 Теперь можно использовать модель через training/inference.py")
    else:
        print("\n❌ Дообучение не удалось. Проверьте ошибки выше.")








