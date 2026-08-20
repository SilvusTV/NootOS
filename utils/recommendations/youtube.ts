import { getJson } from './http';
import { ProviderError, type RecommendationCandidate, type RecommendationProvider, type RecommendationType } from './types';

type SearchResponse = { items?: Array<{ id: { videoId?: string } }> };
type VideosResponse = {
  items?: Array<{
    id: string;
    snippet: { title: string; channelTitle: string; publishedAt: string; thumbnails?: { high?: { url: string }; medium?: { url: string } } };
    contentDetails: { duration: string };
  }>;
};

function videoIdFromUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0] || undefined;
    if (url.hostname.endsWith('youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v') || undefined;
      const match = url.pathname.match(/^\/(?:shorts|embed)\/([^/?]+)/);
      return match?.[1];
    }
  } catch { /* input is a search term */ }
  return undefined;
}

function isoDurationToSeconds(value: string): number {
  const match = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
}

export class YouTubeProvider implements RecommendationProvider {
  constructor(private readonly type: Extract<RecommendationType, 'youtube' | 'music'>) {}

  async search(queryOrUrl: string): Promise<RecommendationCandidate[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new ProviderError('YOUTUBE_API_KEY is missing', "L'API YouTube n'est pas configurée.");

    const directId = videoIdFromUrl(queryOrUrl.trim());
    let ids = directId ? [directId] : [];
    if (!directId) {
      const params = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '5', q: queryOrUrl, key: apiKey });
      const result = await getJson<SearchResponse>(`https://www.googleapis.com/youtube/v3/search?${params}`);
      ids = result.items?.flatMap((item) => item.id.videoId ? [item.id.videoId] : []) || [];
    }
    if (!ids.length) return [];

    const params = new URLSearchParams({ part: 'snippet,contentDetails', id: ids.join(','), key: apiKey });
    const result = await getJson<VideosResponse>(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    return (result.items || []).map((video) => {
      const published = video.snippet.publishedAt;
      return {
        type: this.type,
        externalId: video.id,
        title: video.snippet.title,
        creator: video.snippet.channelTitle,
        year: Number(published.slice(0, 4)) || undefined,
        releaseDate: published.slice(0, 10),
        durationSeconds: isoDurationToSeconds(video.contentDetails.duration),
        imageUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url,
        sourceUrl: `https://www.youtube.com/watch?v=${video.id}`,
      };
    });
  }
}
