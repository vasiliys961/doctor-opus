"""
Модуль для хранения и синхронизации обратной связи с GitHub
"""
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
import subprocess

logger = logging.getLogger(__name__)


def save_raw_feedback(
    analysis_type: str,
    input_case: str,
    model_output: str,
    correctness: str,
    correct_answer: str,
    specialty: str,
    comment: str
) -> Path:
    """
    Сохраняет сырой отзыв в JSON файл
    
    Returns:
        Path к сохраненному файлу
    """
    feedback_dir = Path("data/raw_feedback")
    feedback_dir.mkdir(parents=True, exist_ok=True)
    
    feedback_record = {
        "timestamp": datetime.now().isoformat(),
        "analysis_type": analysis_type,
        "input_case": input_case,
        "model_output": model_output,
        "correctness": correctness,
        "correct_answer": correct_answer,
        "specialty": specialty,
        "comment": comment,
        "consent": True
    }
    
    feedback_file = feedback_dir / f"feedback_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{analysis_type.lower()}.json"
    with open(feedback_file, "w", encoding="utf-8") as f:
        json.dump(feedback_record, f, ensure_ascii=False, indent=2)
    
    logger.info(f"Отзыв сохранён: {feedback_file}")
    return feedback_file


def sync_to_github(
    anonymized_file: Path,
    commit_message: Optional[str] = None,
    force: bool = False
) -> bool:
    """
    Синхронизирует анонимизированные данные с GitHub
    
    Args:
        anonymized_file: Путь к файлу с анонимизированными данными
        commit_message: Сообщение коммита (автоматически генерируется если не указано)
        force: Принудительный push (опасно!)
    
    Returns:
        True если синхронизация успешна, False в противном случае
    """
    try:
        if not anonymized_file.exists():
            logger.error(f"Файл {anonymized_file} не существует")
            return False
        
        if not commit_message:
            commit_message = f"Add anonymized feedback cases: {datetime.now().strftime('%Y-%m-%d')}"
        
        # Проверяем что мы в git репозитории
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            logger.warning("Не в git репозитории, пропускаем синхронизацию")
            return False
        
        # Добавляем файл
        subprocess.run(
            ["git", "add", str(anonymized_file)],
            check=True,
            capture_output=True
        )
        
        # Коммитим
        subprocess.run(
            ["git", "commit", "-m", commit_message],
            check=True,
            capture_output=True
        )
        
        # Пушим (если force=True, используем --force, но это опасно!)
        push_cmd = ["git", "push"]
        if force:
            push_cmd.append("--force")
        
        result = subprocess.run(
            push_cmd,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            logger.info(f"✅ Данные синхронизированы с GitHub: {anonymized_file}")
            return True
        else:
            logger.warning(f"⚠️ Push не выполнен: {result.stderr}")
            return False
            
    except subprocess.CalledProcessError as e:
        logger.error(f"Ошибка git команды: {e}")
        return False
    except Exception as e:
        logger.error(f"Ошибка синхронизации с GitHub: {e}", exc_info=True)
        return False


def get_feedback_stats() -> Dict:
    """Получает статистику по файлам обратной связи"""
    stats = {
        "raw_feedback_count": 0,
        "anonymized_files_count": 0,
        "anonymized_cases_count": 0,
        "training_data_count": 0
    }
    
    # Сырые отзывы
    raw_dir = Path("data/raw_feedback")
    if raw_dir.exists():
        stats["raw_feedback_count"] = len(list(raw_dir.glob("*.json")))
    
    # Анонимизированные файлы
    anon_dir = Path("data/anonymized_cases")
    if anon_dir.exists():
        anon_files = list(anon_dir.glob("*.jsonl"))
        stats["anonymized_files_count"] = len(anon_files)
        # Подсчитываем количество кейсов
        for file in anon_files:
            try:
                with open(file, "r", encoding="utf-8") as f:
                    stats["anonymized_cases_count"] += len(f.readlines())
            except:
                pass
    
    # Данные для обучения
    train_file = Path("data/training_data/flash_sft.jsonl")
    if train_file.exists():
        try:
            with open(train_file, "r", encoding="utf-8") as f:
                stats["training_data_count"] = len(f.readlines())
        except:
            pass
    
    return stats








