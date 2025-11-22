"""
Автоматическое определение профиля специалиста на основе типа исследования
"""
from modules.medical_ai_analyzer import ImageType
from typing import Dict

SPECIALIST_PROFILES = {
    ImageType.ECG: {
        "role": "врач-кардиолог-электрофизиолог",
        "experience": "20-летним стажем работы в университетской клинике",
        "specialization": "аритмология, электрофизиология сердца"
    },
    ImageType.XRAY: {
        "role": "врач-рентгенолог",
        "experience": "15-летним стажем работы в стационаре уровня I",
        "specialization": "рентгенодиагностика органов грудной клетки"
    },
    ImageType.MRI: {
        "role": "врач-нейрорадиолог",
        "experience": "20-летним опытом работы в нейрорадиологическом отделении",
        "specialization": "МРТ-диагностика заболеваний головного мозга"
    },
    ImageType.CT: {
        "role": "врач-радиолог, специалист по компьютерной томографии",
        "experience": "15-летним стажем работы",
        "specialization": "КТ-диагностика, онкорадиология"
    },
    ImageType.ULTRASOUND: {
        "role": "врач ультразвуковой диагностики",
        "experience": "12-летним стажем работы",
        "specialization": "УЗИ-диагностика внутренних органов"
    },
    ImageType.DERMATOSCOPY: {
        "role": "врач-дерматоонколог",
        "experience": "15-летним опытом работы в онкологическом диспансере",
        "specialization": "дерматоскопия, ранняя диагностика меланомы"
    },
    ImageType.HISTOLOGY: {
        "role": "врач-патологоанатом",
        "experience": "20-летним опытом в онкоморфологии",
        "specialization": "гистологическая диагностика, онкопатология"
    },
    ImageType.RETINAL: {
        "role": "врач-офтальмолог, специалист по сетчатке",
        "experience": "15-летним стажем работы",
        "specialization": "диагностика заболеваний сетчатки"
    },
    ImageType.MAMMOGRAPHY: {
        "role": "врач-маммолог, специалист по маммографии",
        "experience": "15-летним опытом работы с системой BI-RADS",
        "specialization": "маммографическая диагностика"
    }
}

def get_specialist_prompt(image_type: ImageType, base_prompt: str = "") -> str:
    """Получение промпта от имени специалиста"""
    profile = SPECIALIST_PROFILES.get(image_type, {
        "role": "врач-специалист",
        "experience": "с большим опытом работы",
        "specialization": "медицинская диагностика"
    })
    
    # Добавляем ключевые слова для правильного определения типа изображения
    type_keywords = {
        ImageType.ECG: "ЭКГ электрокардиограмма",
        ImageType.XRAY: "рентген рентгенограмма",
        ImageType.MRI: "МРТ магнитно-резонансная томография",
        ImageType.CT: "КТ компьютерная томография",
        ImageType.ULTRASOUND: "УЗИ ультразвуковое исследование",
        ImageType.DERMATOSCOPY: "дерматоскопия",
        ImageType.HISTOLOGY: "гистология",
        ImageType.RETINAL: "сетчатка ретина",
        ImageType.MAMMOGRAPHY: "маммография"
    }
    
    keyword = type_keywords.get(image_type, "")
    
    prompt = f"""Вы — {profile['role']} с {profile['experience']}, 
специализирующийся в области {profile['specialization']}.

"""
    if keyword:
        prompt += f"Проанализируйте {keyword} максимально подробно. "
    else:
        prompt += "Проанализируйте изображение максимально подробно. "
    
    prompt += base_prompt if base_prompt else ""
    
    return prompt

def get_specialist_info(image_type: ImageType) -> Dict:
    """Получение информации о специалисте"""
    return SPECIALIST_PROFILES.get(image_type, {
        "role": "врач-специалист",
        "experience": "с большим опытом работы",
        "specialization": "медицинская диагностика"
    })
