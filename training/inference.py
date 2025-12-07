"""
inference.py - Использование дообученной модели
"""
import torch
from pathlib import Path
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import logging

logger = logging.getLogger(__name__)


def load_finetuned_model(base_model_name: str, lora_path: str):
    """Загружает базовую модель + LoRA веса"""
    try:
        # Загружаем базовую модель
        print(f"📥 Загружаю базовую модель: {base_model_name}")
        model = AutoModelForCausalLM.from_pretrained(
            base_model_name,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else None,
        )
        
        if not torch.cuda.is_available():
            model = model.to("cpu")

        # Накладываем LoRA веса
        print(f"📥 Загружаю LoRA веса: {lora_path}")
        model = PeftModel.from_pretrained(model, lora_path)

        tokenizer = AutoTokenizer.from_pretrained(base_model_name)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        print("✅ Модель загружена успешно")
        return model, tokenizer
    except Exception as e:
        logger.error(f"Ошибка загрузки модели: {e}")
        raise


def generate_with_finetuned_model(
    input_text: str,
    model,
    tokenizer,
    max_length: int = 512,
    temperature: float = 0.7,
    top_p: float = 0.9,
    instruction: Optional[str] = None
) -> str:
    """Генерирует ответ с дообученной моделью"""
    
    if instruction is None:
        instruction = "You are an experienced physician. Analyze the following medical case and provide a structured diagnosis with differential diagnoses and recommendations."
    
    prompt = f"""Instruction: {instruction}

Input: {input_text}

Output:"""

    try:
        inputs = tokenizer(prompt, return_tensors="pt")
        
        # Перемещаем на устройство модели
        if not torch.cuda.is_available():
            inputs = {k: v.to("cpu") for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_length=max_length,
                temperature=temperature,
                top_p=top_p,
                do_sample=True,
                pad_token_id=tokenizer.pad_token_id
            )

        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Извлекаем только ответ (после "Output:")
        if "Output:" in response:
            response = response.split("Output:")[-1].strip()
        
        return response
    except Exception as e:
        logger.error(f"Ошибка генерации: {e}")
        return f"Ошибка генерации: {str(e)}"


# Кеширование модели для использования в Streamlit
_model_cache = {}
_tokenizer_cache = {}


def get_finetuned_model_cached(base_model: str, lora_path: str):
    """
    Кешированная загрузка модели
    
    Для использования в Streamlit можно обернуть в @st.cache_resource
    """
    cache_key = f"{base_model}_{lora_path}"
    
    if cache_key not in _model_cache:
        model, tokenizer = load_finetuned_model(base_model, lora_path)
        _model_cache[cache_key] = model
        _tokenizer_cache[cache_key] = tokenizer
    
    return _model_cache[cache_key], _tokenizer_cache[cache_key]


def get_finetuned_model_simple(base_model: str, lora_path: str):
    """Простая загрузка модели без кеширования"""
    return load_finetuned_model(base_model, lora_path)

