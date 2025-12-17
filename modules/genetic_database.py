# -*- coding: utf-8 -*-
"""
База данных клинически значимых генетических вариантов
"""
from typing import Dict, Any
from .genetic_models import ClinicalVariant, PharmacogeneticVariant, VariantPathogenicity


class GeneticDatabase:
    """База данных клинически значимых генетических вариантов"""
    
    def __init__(self):
        self.pathogenic_variants = self._load_pathogenic_variants()
        self.pharmacogenetic_variants = self._load_pharmacogenetic_variants()
        self.trait_variants = self._load_trait_variants()
        self.gene_disease_associations = self._load_gene_disease_associations()
    
    def _load_pathogenic_variants(self) -> Dict[str, ClinicalVariant]:
        """Загрузка патогенных вариантов"""
        variants = {}
        
        # BRCA1 варианты
        variants["17:43094464:C:T"] = ClinicalVariant(
            gene="BRCA1",
            variant_name="c.5266dupC",
            protein_change="p.Gln1756ProfsTer74",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Наследственный рак молочной железы и яичников",
            inheritance_pattern="аутосомно-доминантный",
            penetrance="высокая (60-80%)",
            clinical_action="усиленное наблюдение, профилактическая хирургия",
            evidence_level="очень сильная",
            population_frequency=0.0002
        )
        
        variants["17:43091434:A:G"] = ClinicalVariant(
            gene="BRCA1", 
            variant_name="c.185delAG",
            protein_change="p.Glu62ValfsTer19",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Наследственный рак молочной железы и яичников",
            inheritance_pattern="аутосомно-доминантный",
            penetrance="высокая (60-80%)",
            clinical_action="усиленное наблюдение, профилактическая хирургия",
            evidence_level="очень сильная",
            population_frequency=0.00015
        )
        
        # BRCA2 варианты
        variants["13:32890665:A:G"] = ClinicalVariant(
            gene="BRCA2",
            variant_name="c.2808_2811delACAA", 
            protein_change="p.Ala936ProfsTer39",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Наследственный рак молочной железы и яичников",
            inheritance_pattern="аутосомно-доминантный",
            penetrance="высокая (55-85%)",
            clinical_action="усиленное наблюдение, профилактическая хирургия",
            evidence_level="очень сильная",
            population_frequency=0.0001
        )
        
        # CFTR варианты
        variants["7:117230206:CTT:C"] = ClinicalVariant(
            gene="CFTR",
            variant_name="c.1521_1523delCTT",
            protein_change="p.Phe508del",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Муковисцидоз",
            inheritance_pattern="аутосомно-рецессивный",
            penetrance="полная при гомозиготности",
            clinical_action="генетическое консультирование, носительство",
            evidence_level="очень сильная",
            population_frequency=0.025
        )
        
        # HFE варианты (гемохроматоз)
        variants["6:26090951:G:A"] = ClinicalVariant(
            gene="HFE",
            variant_name="c.845G>A",
            protein_change="p.Cys282Tyr",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Наследственный гемохроматоз",
            inheritance_pattern="аутосомно-рецессивный",
            penetrance="неполная (мужчины > женщины)",
            clinical_action="мониторинг железа, флеботомия при необходимости",
            evidence_level="сильная",
            population_frequency=0.065
        )
        
        # LDLR (семейная гиперхолестеринемия)
        variants["19:45051059:T:C"] = ClinicalVariant(
            gene="LDLR",
            variant_name="c.2312delG",
            protein_change="p.Cys771TrpfsTer22",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Семейная гиперхолестеринемия",
            inheritance_pattern="аутосомно-доминантный",
            penetrance="высокая",
            clinical_action="агрессивная липидснижающая терапия",
            evidence_level="очень сильная",
            population_frequency=0.002
        )
        
        # TP53 (синдром Ли-Фраумени)
        variants["17:7673803:G:A"] = ClinicalVariant(
            gene="TP53",
            variant_name="c.524G>A",
            protein_change="p.Arg175His",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Синдром Ли-Фраумени",
            inheritance_pattern="аутосомно-доминантный",
            penetrance="очень высокая (90%)",
            clinical_action="интенсивное онкологическое наблюдение",
            evidence_level="очень сильная",
            population_frequency=0.00001
        )
        
        return variants
    
    def _load_pharmacogenetic_variants(self) -> Dict[str, PharmacogeneticVariant]:
        """Загрузка фармакогенетических вариантов"""
        variants = {}
        
        # CYP2D6 варианты
        variants["22:42522613:G:A"] = PharmacogeneticVariant(
            gene="CYP2D6",
            variant="*4",
            phenotype="медленный метаболизатор",
            drugs=["кодеин", "трамадол", "метопролол", "рисперидон", "атомоксетин"],
            recommendation="избегать кодеин (неэффективен), снизить дозы других субстратов",
            evidence_level="сильная",
            clinical_annotation="повышенный риск побочных эффектов"
        )
        
        variants["22:42523805:C:T"] = PharmacogeneticVariant(
            gene="CYP2D6",
            variant="*3",
            phenotype="медленный метаболизатор",
            drugs=["кодеин", "трамадол", "метопролол"],
            recommendation="избегать кодеин, коррекция доз других препаратов",
            evidence_level="сильная",
            clinical_annotation="полная потеря функции фермента"
        )
        
        # CYP2C19 варианты
        variants["10:94762706:G:A"] = PharmacogeneticVariant(
            gene="CYP2C19",
            variant="*2",
            phenotype="медленный метаболизатор",
            drugs=["клопидогрел", "омепразол", "эсциталопрам", "вориконазол"],
            recommendation="альтернативная антиагрегантная терапия, увеличение дозы ИПП",
            evidence_level="очень сильная",
            clinical_annotation="снижение эффективности клопидогрела"
        )
        
        variants["10:94775489:G:A"] = PharmacogeneticVariant(
            gene="CYP2C19",
            variant="*3",
            phenotype="медленный метаболизатор", 
            drugs=["клопидогрел", "омепразол"],
            recommendation="альтернативная антиагрегантная терапия",
            evidence_level="сильная",
            clinical_annotation="полная потеря функции"
        )
        
        # DPYD варианты
        variants["1:97740410:G:A"] = PharmacogeneticVariant(
            gene="DPYD",
            variant="c.1679T>G",
            phenotype="дефицит дигидропиримидиндегидрогеназы",
            drugs=["5-фторурацил", "капецитабин", "тегафур"],
            recommendation="ПРОТИВОПОКАЗАНЫ - высокий риск тяжелой токсичности",
            evidence_level="очень сильная",
            clinical_annotation="риск летального исхода при стандартных дозах"
        )
        
        # HLA-B варианты
        variants["6:31353872:G:A"] = PharmacogeneticVariant(
            gene="HLA-B",
            variant="*57:01",
            phenotype="предрасположенность к гиперчувствительности",
            drugs=["абакавир"],
            recommendation="ПРОТИВОПОКАЗАН - высокий риск тяжелых аллергических реакций",
            evidence_level="очень сильная",
            clinical_annotation="обязательное тестирование перед назначением"
        )
        
        variants["6:31353876:T:C"] = PharmacogeneticVariant(
            gene="HLA-B",
            variant="*58:01",
            phenotype="предрасположенность к СJS/TEN",
            drugs=["аллопуринол"],
            recommendation="избегать аллопуринол, альтернативные урикозурики",
            evidence_level="сильная",
            clinical_annotation="риск синдрома Стивенса-Джонсона"
        )
        
        # VKORC1 варианты (варфарин)
        variants["16:31093557:C:T"] = PharmacogeneticVariant(
            gene="VKORC1",
            variant="c.-1639G>A",
            phenotype="повышенная чувствительность к варфарину",
            drugs=["варфарин"],
            recommendation="снижение начальной дозы на 25-50%",
            evidence_level="сильная",
            clinical_annotation="требуется частый мониторинг МНО"
        )
        
        return variants
    
    def _load_trait_variants(self) -> Dict[str, Dict[str, Any]]:
        """Загрузка вариантов, связанных с полигенными признаками"""
        variants = {}
        
        # Сердечно-сосудистые заболевания
        variants["9:22125504:C:G"] = {
            "gene": "CDKN2A/CDKN2B",
            "trait": "ишемическая болезнь сердца",
            "risk": "повышенный",
            "odds_ratio": 1.29,
            "population_frequency": 0.47,
            "effect_size": "умеренный",
            "evidence": "геномные ассоциативные исследования"
        }
        
        variants["1:55053079:C:T"] = {
            "gene": "PCSK9",
            "trait": "уровень холестерина ЛПНП",
            "risk": "пониженный",
            "odds_ratio": 0.85,
            "population_frequency": 0.02,
            "effect_size": "большой",
            "evidence": "функциональные исследования"
        }
        
        # Диабет 2 типа
        variants["10:114758349:C:T"] = {
            "gene": "TCF7L2",
            "trait": "сахарный диабет 2 типа",
            "risk": "повышенный",
            "odds_ratio": 1.37,
            "population_frequency": 0.28,
            "effect_size": "умеренный",
            "evidence": "множественные исследования"
        }
        
        # Болезнь Альцгеймера
        variants["19:45411941:T:C"] = {
            "gene": "APOE",
            "variant": "ε4",
            "trait": "болезнь Альцгеймера",
            "risk": "значительно повышенный",
            "odds_ratio": 3.68,
            "population_frequency": 0.14,
            "effect_size": "большой",
            "evidence": "десятилетия исследований"
        }
        
        # Венозная тромбоэмболия
        variants["1:169519049:T:C"] = {
            "gene": "F5",
            "variant": "Лейденская мутация",
            "trait": "венозная тромбоэмболия",
            "risk": "повышенный",
            "odds_ratio": 4.9,
            "population_frequency": 0.05,
            "effect_size": "большой",
            "evidence": "клинические исследования"
        }
        
        return variants
    
    def _load_gene_disease_associations(self) -> Dict[str, Dict[str, Any]]:
        """Загрузка ассоциаций ген-заболевание"""
        return {
            "BRCA1": {
                "diseases": ["рак молочной железы", "рак яичников", "рак поджелудочной железы"],
                "surveillance": ["МРТ молочных желез", "трансвагинальное УЗИ", "CA-125"],
                "prevention": ["профилактическая мастэктомия", "овариэктомия"]
            },
            "BRCA2": {
                "diseases": ["рак молочной железы", "рак яичников", "рак простаты", "меланома"],
                "surveillance": ["МРТ молочных желез", "трансвагинальное УЗИ", "ПСА"],
                "prevention": ["профилактическая мастэктомия", "овариэктомия"]
            },
            "TP53": {
                "diseases": ["саркомы", "рак молочной железы", "опухоли мозга", "лейкемия"],
                "surveillance": ["МРТ всего тела", "маммография", "МРТ мозга"],
                "prevention": ["избегание радиации", "регулярные обследования"]
            },
            "CFTR": {
                "diseases": ["муковисцидоз"],
                "surveillance": ["функция легких", "панкреатическая функция"],
                "prevention": ["генетическое консультирование"]
            }
        }
