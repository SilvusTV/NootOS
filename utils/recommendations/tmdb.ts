import { getJson } from './http';
import { ProviderError, type RecommendationCandidate, type RecommendationProvider } from './types';

type MovieSummary = { id: number; title: string; release_date?: string; poster_path?: string };
type SearchResponse = { results?: MovieSummary[]; movie_results?: MovieSummary[] };
type DetailsResponse = MovieSummary & { runtime?: number; imdb_id?: string };

function imdbId(value: string): string | undefined {
  return value.match(/(?:imdb\.com\/title\/)?(tt\d{7,10})/i)?.[1];
}

export class TmdbProvider implements RecommendationProvider {
  private headers(): HeadersInit {
    const token = process.env.TMDB_API_TOKEN;
    if (!token) throw new ProviderError('TMDB_API_TOKEN is missing', "L'API TMDB n'est pas configurée.");
    return { Authorization: `Bearer ${token}` };
  }

  async search(queryOrUrl: string): Promise<RecommendationCandidate[]> {
    const imdb = imdbId(queryOrUrl);
    const url = imdb
      ? `https://api.themoviedb.org/3/find/${imdb}?external_source=imdb_id&language=fr-FR`
      : `https://api.themoviedb.org/3/search/movie?${new URLSearchParams({ query: queryOrUrl, language: 'fr-FR', include_adult: 'false' })}`;
    const result = await getJson<SearchResponse>(url, { headers: this.headers() });
    const summaries = (imdb ? result.movie_results : result.results) || [];
    return Promise.all(summaries.slice(0, 5).map((movie) => this.details(movie.id)));
  }

  private async details(id: number): Promise<RecommendationCandidate> {
    const movie = await getJson<DetailsResponse>(`https://api.themoviedb.org/3/movie/${id}?language=fr-FR`, { headers: this.headers() });
    return {
      type: 'movie',
      externalId: String(movie.id),
      title: movie.title,
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : undefined,
      releaseDate: movie.release_date,
      durationSeconds: movie.runtime ? movie.runtime * 60 : undefined,
      imageUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
      sourceUrl: movie.imdb_id ? `https://www.imdb.com/title/${movie.imdb_id}/` : `https://www.themoviedb.org/movie/${movie.id}`,
    };
  }
}
