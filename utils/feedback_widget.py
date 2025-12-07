"""
UI компонент для обратной связи от врачей
"""
import streamlit as st
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Optional
from utils.feedback_manager import save_feedback
import logging

logger = logging.getLogger(__name__)

def show_feedback_form(
    analysis_type: str, 
    analysis_result: str, 
    analysis_id: Optional[str] = None,
    input_case: Optional[str] = None
):
    """
    Отображение формы обратной связи для врача
    
    Args:
        analysis_type: Тип анализа (ECG, XRAY, MRI, CT, ULTRASOUND, DERMATOSCOPY, LAB, GENETICS, VIDEO)
        analysis_result: Текст ответа ИИ
        analysis_id: Уникальный идентификатор анализа (опционально, будет сгенерирован если не указан)
        input_case: Входной кейс пациента (опционально, для обучения)
    """
    # Преобразуем в строку
    try:
        if not isinstance(analysis_result, str):
            analysis_result = str(analysis_result) if analysis_result else ""
    except:
        analysis_result = ""
    
    # Генерируем ID если не указан
    if not analysis_id:
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            if analysis_result:
                content_hash = hashlib.md5(analysis_result.encode()).hexdigest()[:8]
                analysis_id = f"{analysis_type}_{timestamp}_{content_hash}"
            else:
                analysis_id = f"{analysis_type}_{timestamp}"
        except:
            analysis_id = f"{analysis_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # Проверка на уже отправленный отзыв (только если есть результат)
    # Используем комбинацию analysis_id + hash результата для уникальности
    feedback_key = f"feedback_sent_{analysis_id}"
    if analysis_result:
        # Добавляем hash результата к ключу, чтобы для разных результатов были разные ключи
        result_hash = hashlib.md5(analysis_result.encode()).hexdigest()[:8]
        feedback_key = f"feedback_sent_{analysis_id}_{result_hash}"
    
    # Проверяем был ли уже отправлен отзыв для этого конкретного результата
    if analysis_result:
        if st.session_state.get(feedback_key, False):
            st.success("✅ Спасибо за ваш отзыв! Он уже сохранён.")
            # Но всё равно показываем форму для возможности изменить отзыв
            st.info("💡 Вы можете оставить дополнительный комментарий ниже.")
        # Если есть результат, не показываем предупреждение
    else:
        # Если результата нет, показываем подсказку
        st.info("💡 Форма станет активной после проведения анализа. Вы можете оставить общий комментарий.")
    
    # ВСЕГДА показываем форму (даже если отзыв уже отправлен)
    with st.expander("📝 Оставить отзыв", expanded=True):
        st.info("💡 Ваш отзыв поможет улучшить систему. Все данные будут анонимизированы.")
        
        col1, col2 = st.columns(2)
        
        with col1:
            # Оценка корректности (новое поле)
            correctness = st.radio(
                "📊 Оценка корректности:",
                ["✅ Полностью верно", "⚠️ Частично верно", "❌ Ошибка"],
                key=f"correctness_{analysis_id}",
                help="Оцените, насколько правильно модель проанализировала кейс"
            )
        
        with col2:
            # Специальность врача (новое поле)
            specialty = st.selectbox(
                "🏥 Ваша специальность:",
                ["Кардиология", "Онкология", "Пульмонология", "Неврология", 
                 "ОВП", "Инфекционные болезни", "Гастроэнтерология", 
                 "Радиология", "Дерматология", "Лабораторная диагностика",
                 "Генетика", "Другое"],
                key=f"specialty_{analysis_id}",
                help="Ваша медицинская специальность"
            )
        
        # Согласие на использование данных (новое поле)
        consent = st.checkbox(
            "✓ Согласен использовать этот случай для улучшения модели (анонимно)",
            key=f"consent_{analysis_id}",
            value=True
        )
        
        # Чекбокс для отметки неправильного диагноза (сохраняем для обратной совместимости)
        is_incorrect = correctness == "❌ Ошибка"
        
        # Поле для правильного диагноза (показывается если диагноз неправильный или частично верно)
        correct_diagnosis = None
        if correctness != "✅ Полностью верно":
            correct_diagnosis = st.text_area(
                "✅ Укажите правильный диагноз/уточнение:",
                placeholder="Введите правильный диагноз, уточнение или исправление...",
                height=100,
                key=f"correct_diagnosis_{analysis_id}"
            )
        
        # Комментарий врача (всегда доступен)
        doctor_comment = st.text_area(
            "💬 Ваш комментарий (опционально):",
            placeholder="Укажите, что можно улучшить, что не хватает, или дополнительные замечания...",
            height=100,
            key=f"comment_{analysis_id}"
        )
        
        # Определяем тип обратной связи (для обратной совместимости)
        if is_incorrect or correctness == "❌ Ошибка":
            feedback_type = "incorrect_diagnosis"
        elif correctness == "⚠️ Частично верно" or doctor_comment:
            feedback_type = "needs_improvement"
        else:
            feedback_type = "correct"
        
        # Кнопка отправки
        col1, col2 = st.columns([1, 3])
        with col1:
            submit_button = st.button("📤 Отправить отзыв", key=f"submit_{analysis_id}", type="primary")
            if submit_button:
                # Проверяем согласие
                if not consent:
                    st.error("❌ Пожалуйста, дайте согласие на использование данных для улучшения модели.")
                    return
                
                # Если есть результат анализа
                if analysis_result:
                    # Сохраняем обратную связь в БД (расширенная версия)
                    success = save_feedback(
                        analysis_type=analysis_type,
                        ai_response=analysis_result[:5000],  # Ограничиваем размер для БД
                        feedback_type=feedback_type or "needs_improvement",
                        doctor_comment=doctor_comment if doctor_comment else None,
                        correct_diagnosis=correct_diagnosis if correct_diagnosis else None,
                        analysis_id=analysis_id,
                        specialty=specialty,
                        correctness=correctness,
                        consent=consent,
                        input_case=input_case[:5000] if input_case else None  # Ограничиваем размер
                    )
                    
                    # Также сохраняем в JSON файл для обучения (если есть согласие)
                    if success and consent:
                        try:
                            _save_feedback_to_file(
                                analysis_type=analysis_type,
                                input_case=input_case or "",
                                model_output=analysis_result,
                                correctness=correctness,
                                correct_answer=correct_diagnosis or "",
                                specialty=specialty,
                                comment=doctor_comment or ""
                            )
                        except Exception as e:
                            logger.warning(f"Не удалось сохранить в файл для обучения: {e}")
                    
                    if success:
                        st.success("✅ Спасибо за ваш отзыв! Он сохранён и будет использован для улучшения системы.")
                        st.session_state[feedback_key] = True
                        st.rerun()
                    else:
                        st.error("❌ Ошибка при сохранении отзыва. Попробуйте ещё раз.")
                else:
                    # Если результата нет, принимаем только комментарий
                    if doctor_comment and consent:
                        success = save_feedback(
                            analysis_type=analysis_type,
                            ai_response="",  # Нет результата анализа
                            feedback_type="general_feedback",
                            doctor_comment=doctor_comment,
                            correct_diagnosis=None,
                            analysis_id=analysis_id,
                            specialty=specialty,
                            correctness=None,
                            consent=consent,
                            input_case=input_case[:5000] if input_case else None
                        )
                        if success:
                            st.success("✅ Спасибо за ваш комментарий! Он сохранён.")
                            st.rerun()
                        else:
                            st.error("❌ Ошибка при сохранении отзыва. Попробуйте ещё раз.")
                    elif not consent:
                        st.error("❌ Пожалуйста, дайте согласие на использование данных.")
                    else:
                        st.warning("⚠️ Пожалуйста, оставьте комментарий.")


def _save_feedback_to_file(
    analysis_type: str,
    input_case: str,
    model_output: str,
    correctness: str,
    correct_answer: str,
    specialty: str,
    comment: str
):
    """Сохраняет отзыв в JSON файл для последующей анонимизации и обучения"""
    try:
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
        
        logger.info(f"Отзыв сохранён в файл: {feedback_file}")
    except Exception as e:
        logger.error(f"Ошибка сохранения отзыва в файл: {e}")
        raise
