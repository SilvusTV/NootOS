import { RecommendationRepository } from '../db';

export const recommendationTypeChoices = [
  { name: 'Tous les types', value: 'all' },
  { name: 'Vidéo YouTube', value: 'youtube' },
  { name: 'Musique', value: 'music' },
  { name: 'Jeu', value: 'game' },
  { name: 'Film', value: 'movie' },
  { name: 'Série', value: 'series' },
];

const labels: Record<string, string> = {
  youtube: 'Vidéo YouTube', music: 'Musique', game: 'Jeu', movie: 'Film', series: 'Série',
};

export async function autocompleteRecommendations(interaction: any, onlyUserId?: string): Promise<void> {
  if (!interaction.guildId) return interaction.respond([]);
  const selectedType = interaction.options.getString('type');
  const query = String(interaction.options.getFocused() || '').trim();
  const repository = new RecommendationRepository();
  const rows = repository.search(
    interaction.guildId,
    query,
    selectedType && selectedType !== 'all' ? selectedType : undefined,
    onlyUserId,
    25,
  );
  await interaction.respond(rows.map((row) => {
    const details = [labels[row.type] || row.type, row.year, `par ${row.recommendedByName}`, `⬆ ${repository.upvoteCount(row.id)}`].filter(Boolean).join(' • ');
    return { name: `${row.title} — ${details}`.slice(0, 100), value: String(row.id) };
  }));
}

export function selectedRecommendationId(interaction: any): number | undefined {
  const value = interaction.options.getString('recommandation', true);
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}
