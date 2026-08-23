import { getJson } from './http';
import { ProviderError, type RecommendationCandidate, type RecommendationProvider } from './types';

type TmdbType = 'movie' | 'series';
type MediaSummary = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
};
type SearchResponse = { results?: MediaSummary[]; movie_results?: MediaSummary[]; tv_results?: MediaSummary[] };
type DetailsResponse = MediaSummary & {
  runtime?: number;
  episode_run_time?: number[];
  imdb_id?: string;
  external_ids?: { imdb_id?: string };
};

function imdbId(value: string): string | undefined {
  return value.match(/(?:imdb\.com\/title\/)?(tt\d{7,10})/i)?.[1];
}

export class TmdbProvider implements RecommendationProvider {
  constructor(private readonly type: TmdbType) {}

  private headers(): HeadersInit {
    const token = process.env.TMDB_API_TOKEN;
    if (!token) throw new ProviderError('TMDB_API_TOKEN is missing', "L'API TMDB n'est pas configurée.");
    return { Authorization: `Bearer ${token}` };
  }

  async search(queryOrUrl: string): Promise<RecommendationCandidate[]> {
    const imdb = imdbId(queryOrUrl);
    const mediaType = this.type === 'series' ? 'tv' : 'movie';
    const url = imdb
      ? `https://api.themoviedb.org/3/find/${imdb}?external_source=imdb_id&language=fr-FR`
      : `https://api.themoviedb.org/3/search/${mediaType}?${new URLSearchParams({ query: queryOrUrl, language: 'fr-FR', include_adult: 'false' })}`;
    const result = await getJson<SearchResponse>(url, { headers: this.headers() });
    const summaries = (imdb ? (this.type === 'series' ? result.tv_results : result.movie_results) : result.results) || [];
    return Promise.all(summaries.slice(0, 5).map((media) => this.details(media.id)));
  }

  private async details(id: number): Promise<RecommendationCandidate> {
    const mediaType = this.type === 'series' ? 'tv' : 'movie';
    const media = await getJson<DetailsResponse>(`https://api.themoviedb.org/3/${mediaType}/${id}?language=fr-FR&append_to_response=external_ids`, { headers: this.headers() });
    const releaseDate = this.type === 'series' ? media.first_air_date : media.release_date;
    const imdb = media.imdb_id || media.external_ids?.imdb_id;
    const runtime = this.type === 'series' ? media.episode_run_time?.[0] : media.runtime;
    return {
      type: this.type,
      externalId: String(media.id),
      title: media.title || media.name || 'Sans titre',
      year: releaseDate ? Number(releaseDate.slice(0, 4)) : undefined,
      releaseDate,
      durationSeconds: runtime ? runtime * 60 : undefined,
      imageUrl: media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : undefined,
      sourceUrl: imdb ? `https://www.imdb.com/title/${imdb}/` : `https://www.themoviedb.org/${mediaType}/${media.id}`,
    };
  }
}
