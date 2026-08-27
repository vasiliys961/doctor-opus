interface AnalyzeImageRequestOptions {
  formData: FormData;
  mode: string;
  validatedModelPreference?: 'auto' | 'opus' | 'fable';
}

interface ModelOfferPayload {
  recommendedModel: 'fable' | 'opus';
  defaultModel: 'opus';
  estimatedCostOpus: number;
  estimatedCostFable: number;
  estimatedDifference: number;
}

const VALIDATED_PREFERENCE_STORAGE_KEY = 'validated-model-preference';

function getValidatedPreference(options: AnalyzeImageRequestOptions): 'auto' | 'opus' | 'fable' {
  if (options.validatedModelPreference) {
    return options.validatedModelPreference;
  }
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(VALIDATED_PREFERENCE_STORAGE_KEY);
    if (saved === 'fable' || saved === 'opus' || saved === 'auto') return saved;
  } catch {}
  return 'auto';
}

async function askUserForFableUpgrade(modelOffer: ModelOfferPayload): Promise<'fable' | 'opus'> {
  return new Promise((resolve) => {
    (async () => {
      try {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const React = await import('react');
        const { createRoot } = await import('react-dom/client');
        const { default: FableUpgradeModal } = await import('@/components/FableUpgradeModal');

        const root = createRoot(container);
        const finalize = (choice: 'fable' | 'opus') => {
          root.unmount();
          container.remove();
          resolve(choice);
        };

        root.render(
          React.createElement(FableUpgradeModal, {
            estimatedCostOpus: modelOffer.estimatedCostOpus,
            estimatedCostFable: modelOffer.estimatedCostFable,
            estimatedDifference: modelOffer.estimatedDifference,
            onSelect: finalize,
          })
        );
      } catch {
        resolve('opus');
      }
    })();
  });
}

async function sendAnalyzeImage(formData: FormData): Promise<Response> {
  return fetch('/api/analyze/image', { method: 'POST', body: formData });
}

export async function postAnalyzeImageWithModelConsent(options: AnalyzeImageRequestOptions): Promise<Response> {
  if (typeof window === 'undefined' || options.mode !== 'validated') {
    return sendAnalyzeImage(options.formData);
  }

  const userPreference = getValidatedPreference(options);
  if (userPreference === 'fable' || userPreference === 'opus') {
    options.formData.set('validatedModelChoice', userPreference);
    options.formData.set('allowValidatedOffer', 'true');
    return sendAnalyzeImage(options.formData);
  }

  options.formData.set('allowValidatedOffer', 'true');
  options.formData.delete('validatedModelChoice');
  const firstResponse = await sendAnalyzeImage(options.formData);

  if (firstResponse.status !== 409) {
    return firstResponse;
  }

  let payload: any = null;
  try {
    payload = await firstResponse.json();
  } catch {
    return firstResponse;
  }

  if (!payload?.requiresModelSelection || !payload?.modelOffer) {
    return firstResponse;
  }

  const choice = await askUserForFableUpgrade(payload.modelOffer as ModelOfferPayload);
  options.formData.set('validatedModelChoice', choice);
  return sendAnalyzeImage(options.formData);
}

