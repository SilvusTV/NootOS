import { ProviderError } from './types';

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    throw new ProviderError(`HTTP ${response.status} for ${url}`, 'La source externe ne répond pas correctement.');
  }
  return (await response.json()) as T;
}
