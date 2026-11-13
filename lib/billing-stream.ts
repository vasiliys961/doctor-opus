import { checkAndDeductBalance, checkAndDeductGuestBalance } from './server-billing';
import { readProviderCostRub, unitsFromProviderRub, unitsFromTokens } from './provider-billing';

function unitsFromSsePayload(payload: string, fallbackModel?: string): number | null {
  if (!payload || payload === '[DONE]') return null;
  try {
    const parsed = JSON.parse(payload);
    const usage = parsed?.usage;
    if (!usage) return null;

    const rub = readProviderCostRub(usage);
    if (rub != null) return unitsFromProviderRub(rub);

    const prompt = Number(usage.prompt_tokens) || 0;
    const completion = Number(usage.completion_tokens) || 0;
    const model = typeof parsed.model === 'string' && parsed.model ? parsed.model : fallbackModel;
    const tokenUnits = prompt + completion > 0 && model
      ? unitsFromTokens(prompt, completion, model)
      : null;
    const stated = usage.total_cost != null && Number.isFinite(Number(usage.total_cost))
      ? Number(usage.total_cost)
      : null;

    if (tokenUnits != null && tokenUnits > 0) {
      if (stated != null && stated >= tokenUnits * 0.5) return stated;
      return tokenUnits;
    }
    return stated != null && stated >= 0 ? stated : null;
  } catch {
    return null;
  }
}

export async function reconcileUsageCharge(params: {
  email?: string | null;
  guestKey?: string | null;
  estimated: number;
  actual: number;
  label: string;
}): Promise<void> {
  if (!Number.isFinite(params.actual) || params.actual < 0) return;
  const delta = Number((params.actual - params.estimated).toFixed(2));
  if (Math.abs(delta) < 0.01) return;

  const operation = delta > 0
    ? `${params.label} (доплата по счёту Polza)`
    : `${params.label} (возврат аванса)`;
  const metadata = {
    estimatedCost: params.estimated,
    actualCost: params.actual,
    adjustment: delta,
  };

  if (params.email) {
    await checkAndDeductBalance(params.email, delta, operation, metadata);
  } else if (params.guestKey) {
    await checkAndDeductGuestBalance(params.guestKey, delta, operation, metadata);
  }
}

/**
 * После потока досписывает или возвращает разницу между авансом и фактом.
 * Факт — рубли Polza, переведённые в единицы по $0,01 прайса (около 1,20 ₽).
 */
export function wrapStreamWithUsageReconcile(
  source: ReadableStream<Uint8Array>,
  params: {
    email?: string | null;
    guestKey?: string | null;
    estimated: number;
    label: string;
    model?: string;
  }
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let actualUnits: number | null = null;
  let reconciled = false;

  const reconcile = async () => {
    if (reconciled) return;
    reconciled = true;
    if (actualUnits == null || !Number.isFinite(actualUnits) || actualUnits < 0) return;

    await reconcileUsageCharge({
      email: params.email,
      guestKey: params.guestKey,
      estimated: params.estimated,
      actual: actualUnits,
      label: params.label,
    });
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          const tail = buffer.trim();
          if (tail.startsWith('data: ')) {
            const payload = tail.slice(6).trim();
            if (payload && payload !== '[DONE]') {
              const cost = unitsFromSsePayload(payload, params.model);
              if (cost != null && cost >= 0) actualUnits = cost;
            }
          }
          await reconcile();
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        let lineEnd = buffer.indexOf('\n');
        while (lineEnd !== -1) {
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim();
            if (payload && payload !== '[DONE]') {
              const cost = unitsFromSsePayload(payload, params.model);
              if (cost != null && cost >= 0) actualUnits = cost;
            }
          }
          lineEnd = buffer.indexOf('\n');
        }

        controller.enqueue(value);
      } catch (error) {
        await reconcile();
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reconcile();
      await reader.cancel(reason);
    },
  });
}
