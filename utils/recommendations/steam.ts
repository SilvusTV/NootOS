import { getJson } from './http';
import { type RecommendationCandidate, type RecommendationProvider } from './types';

type SearchResponse = { items?: Array<{ id: number }> };
type AppDetails = {
  name: string;
  steam_appid: number;
  header_image?: string;
  release_date?: { date?: string };
  price_overview?: { final_formatted?: string };
  is_free?: boolean;
};
type AppResponse = Record<string, { success: boolean; data?: AppDetails }>;
type ReviewResponse = { query_summary?: { total_positive: number; total_reviews: number; review_score_desc?: string } };

function appId(value: string): string | undefined {
  return value.match(/store\.steampowered\.com\/app\/(\d+)/i)?.[1] || (/^\d+$/.test(value.trim()) ? value.trim() : undefined);
}

export class SteamProvider implements RecommendationProvider {
  async search(queryOrUrl: string): Promise<RecommendationCandidate[]> {
    const directId = appId(queryOrUrl);
    let ids = directId ? [directId] : [];
    if (!directId) {
      const params = new URLSearchParams({ term: queryOrUrl, l: 'french', cc: 'FR' });
      const result = await getJson<SearchResponse>(`https://store.steampowered.com/api/storesearch/?${params}`);
      ids = (result.items || []).slice(0, 5).map((item) => String(item.id));
    }
    const candidates = await Promise.all(ids.map((id) => this.details(id)));
    return candidates.filter((candidate): candidate is RecommendationCandidate => Boolean(candidate));
  }

  private async details(id: string): Promise<RecommendationCandidate | undefined> {
    const [apps, reviews] = await Promise.all([
      getJson<AppResponse>(`https://store.steampowered.com/api/appdetails?appids=${id}&cc=FR&l=french`),
      getJson<ReviewResponse>(`https://store.steampowered.com/appreviews/${id}?json=1&language=all&purchase_type=all&num_per_page=0`),
    ]);
    const app = apps[id]?.data;
    if (!apps[id]?.success || !app) return undefined;
    const summary = reviews.query_summary;
    const percent = summary?.total_reviews ? Math.round((summary.total_positive / summary.total_reviews) * 100) : undefined;
    const releaseDate = app.release_date?.date;
    const year = releaseDate?.match(/\d{4}/)?.[0];
    return {
      type: 'game',
      externalId: id,
      title: app.name,
      year: year ? Number(year) : undefined,
      releaseDate,
      imageUrl: app.header_image,
      sourceUrl: `https://store.steampowered.com/app/${id}`,
      price: app.is_free ? 'Gratuit' : app.price_overview?.final_formatted || 'Indisponible',
      rating: percent === undefined ? summary?.review_score_desc : `${percent}% positifs`,
    };
  }
}
