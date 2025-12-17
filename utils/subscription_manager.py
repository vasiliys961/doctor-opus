"""
Простая система управления балансом и режимами подписки.

ЦЕЛИ:
- Работает поверх централизованных настроек из config.py.
- Учитывает режимы APP_MODE и SUBSCRIPTION_ENABLED.
- Гарантирует, что владелец (OWNER) всегда имеет доступ, даже при нулевом балансе.

ВАЖНО:
- Сейчас баланс хранится только в st.session_state (временный, на сессию).
- Для продакшена можно будет заменить на хранение в БД.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Dict

import streamlit as st

try:
    from config import (
        SUBSCRIPTION_ENABLED,
        APP_MODE,
        KILL_SWITCH_ENABLED,
        OWNER_IDS,
        VIP_USER_IDS,
        FREE_TRIAL_CREDITS,
        BETA_MAX_FREE_USERS,
        CREDIT_PACKAGES,
    )
except Exception:
    # Безопасные значения по умолчанию, если config недоступен
    SUBSCRIPTION_ENABLED = False
    APP_MODE = "OFF"
    KILL_SWITCH_ENABLED = False
    OWNER_IDS = []
    VIP_USER_IDS = []
    FREE_TRIAL_CREDITS = 50.0
    BETA_MAX_FREE_USERS = 100
    CREDIT_PACKAGES: Dict[int, int] = {100: 200, 500: 1000, 1000: 2000}


@dataclass
class SubscriptionState:
    """Состояние подписки для текущей сессии."""

    balance: float = 0.0
    total_used: float = 0.0
    free_credits_used: float = 0.0
    mode: str = APP_MODE
    is_owner: bool = False
    is_vip: bool = False


SESSION_KEY = "subscription_state"


def _get_current_user_id() -> Optional[str]:
    """
    Получение идентификатора пользователя.

    Простой вариант: берем email из st.session_state['user_email'],
    который задается через UI (поле ввода email в приложении).
    """
    return st.session_state.get("user_email")


def _is_dev_mode() -> bool:
    """Проверка наличия файла .dev_mode в корне проекта."""
    import os

    try:
        return os.path.exists(".dev_mode")
    except Exception:
        return False


def init_subscription() -> SubscriptionState:
    """
    Инициализация состояния подписки в session_state.
    Вызывается один раз при запуске приложения.
    """
    if SESSION_KEY in st.session_state:
        return st.session_state[SESSION_KEY]

    user_id = _get_current_user_id()
    is_owner = bool(user_id and user_id in OWNER_IDS) or _is_dev_mode()
    is_vip = bool(user_id and user_id in VIP_USER_IDS)

    # Базовый стартовый баланс:
    # - OWNER и dev_mode: очень большой "виртуальный" баланс
    # - VIP: увеличенный
    # - остальным: в TEST/BETA режиме можно выдать бесплатные кредиты
    if is_owner:
        start_balance = 1_000_000.0
    elif is_vip:
        start_balance = 10_000.0
    elif APP_MODE in ("TEST", "BETA"):
        start_balance = FREE_TRIAL_CREDITS
    else:
        start_balance = 0.0

    state = SubscriptionState(
        balance=start_balance,
        total_used=0.0,
        free_credits_used=0.0,
        mode=APP_MODE,
        is_owner=is_owner,
        is_vip=is_vip,
    )
    st.session_state[SESSION_KEY] = state
    return state


def get_state() -> SubscriptionState:
    """Получить текущее состояние подписки."""
    if SESSION_KEY not in st.session_state:
        return init_subscription()
    return st.session_state[SESSION_KEY]


def is_subscription_active() -> bool:
    """
    Активна ли вообще логика подписки.
    Если SUBSCRIPTION_ENABLED = False – все проверки баланса пропускаются.
    """
    return bool(SUBSCRIPTION_ENABLED and APP_MODE in ("TEST", "BETA", "PRODUCTION"))


def is_access_blocked() -> bool:
    """
    Глобальная блокировка доступа (kill switch).
    OWNER и dev_mode игнорируют блокировку.
    """
    state = get_state()
    if state.is_owner:
        return False
    return bool(KILL_SWITCH_ENABLED)


def get_balance() -> float:
    """Текущий баланс единиц."""
    return float(get_state().balance)


def can_afford_operation(cost: float = 1.0) -> bool:
    """
    Проверка, можно ли выполнить операцию с учетом баланса.
    Владелец и dev_mode всегда могут.
    Если подписка выключена – всегда можно.
    """
    state = get_state()

    if not is_subscription_active():
        return True

    if state.is_owner:
        return True

    if is_access_blocked():
        return False

    return state.balance >= cost


def deduct_balance(cost: float = 1.0) -> None:
    """
    Списать единицы за операцию.
    Для OWNER и при неактивной подписке баланс не трогаем.
    """
    state = get_state()

    if not is_subscription_active():
        return

    if state.is_owner:
        return

    new_balance = max(0.0, state.balance - cost)
    state.balance = new_balance
    state.total_used += cost
    st.session_state[SESSION_KEY] = state


def add_credits(amount: float) -> None:
    """
    Ручное пополнение баланса (например, вы пополнили врачу после перевода).
    Можно вызывать из админ‑интерфейса.
    """
    state = get_state()
    state.balance += max(0.0, amount)
    st.session_state[SESSION_KEY] = state

