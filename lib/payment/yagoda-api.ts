const YAGODA_HOST = 'https://yagoda.team';

export function getYagodaConfig() {
  const token = (process.env.YAGODA_API_TOKEN || '').trim();
  const integrationType = (process.env.YAGODA_INTEGRATION_TYPE || 'store').trim();
  return { token, integrationType };
}

function ordersBasePath(): string {
  const { integrationType } = getYagodaConfig();
  return `${YAGODA_HOST}/api/integrations/${integrationType}`;
}

export type YagodaCreateOrderResult = {
  payment_url: string;
  qr_url?: string;
};

/**
 * Создание заказа в Yagoda (оплата пополнения баланса).
 * @see https://yagoda.team/integrations/guide
 */
export async function yagodaCreateOrder(params: {
  orderId: string;
  email: string;
  amountRub: number;
  itemName: string;
}): Promise<YagodaCreateOrderResult> {
  const { token } = getYagodaConfig();
  if (!token) {
    throw new Error('YAGODA_API_TOKEN не задан');
  }

  const price = Number(params.amountRub.toFixed(2));
  const url = `${ordersBasePath()}/orders`;
  const body = {
    token,
    order_id: params.orderId,
    email: params.email,
    items: [
      {
        id: params.orderId,
        name: params.itemName.slice(0, 500),
        quantity: 1,
        price,
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
    payment_url?: string;
    qr_url?: string;
  };

  if (!res.ok || data.status === 'error') {
    const msg = data.message || `Yagoda HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (!data.payment_url) {
    throw new Error('Yagoda: в ответе нет payment_url');
  }
  return { payment_url: data.payment_url, qr_url: data.qr_url };
}

export type YagodaOrderStatusRow = {
  external_id: string;
  status: string;
};

/**
 * Статусы заказов по внешним id (для дозачисления, если webhook не дошёл).
 */
export async function yagodaFetchOrderStatuses(orderIds: string[]): Promise<YagodaOrderStatusRow[]> {
  const { token } = getYagodaConfig();
  if (!token || orderIds.length === 0) {
    return [];
  }

  const url = `${ordersBasePath()}/orders/status`;
  const body = { token, orders: orderIds };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    data?: Array<{ external_id?: string; status?: string }>;
  };

  if (!res.ok || data.status === 'error' || !Array.isArray(data.data)) {
    return [];
  }

  return data.data
    .filter((row) => row.external_id && row.status)
    .map((row) => ({
      external_id: String(row.external_id),
      status: String(row.status),
    }));
}
