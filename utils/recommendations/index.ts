import { SteamProvider } from './steam';
import { TmdbProvider } from './tmdb';
import { YouTubeProvider } from './youtube';
import type { RecommendationProvider, RecommendationType } from './types';

export * from './types';

export function getRecommendationProvider(type: RecommendationType): RecommendationProvider {
  switch (type) {
    case 'youtube': return new YouTubeProvider('youtube');
    case 'music': return new YouTubeProvider('music');
    case 'game': return new SteamProvider();
    case 'movie': return new TmdbProvider();
  }
}
