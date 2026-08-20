export const RECOMMENDATION_TYPES = ['youtube', 'music', 'game', 'movie'] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export interface RecommendationCandidate {
  type: RecommendationType;
  externalId: string;
  title: string;
  year?: number;
  creator?: string;
  durationSeconds?: number;
  releaseDate?: string;
  imageUrl?: string;
  sourceUrl: string;
  price?: string;
  rating?: string;
}

export interface RecommendationProvider {
  search(queryOrUrl: string): Promise<RecommendationCandidate[]>;
}

export class ProviderError extends Error {
  constructor(message: string, public readonly userMessage = message) {
    super(message);
    this.name = 'ProviderError';
  }
}
