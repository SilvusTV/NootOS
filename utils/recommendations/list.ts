import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Client } from 'discord.js';
import { RecommendationRepository } from '../db';

const PAGE_SIZE = 20;
const labels: Record<string, string> = {
  youtube: 'Vidéos YouTube', music: 'Musiques', game: 'Jeux', movie: 'Films', series: 'Séries',
};

type ListState = { guildId: string; userId: string; type?: string; page: number; expiresAt: number };

function cache(client: any): Map<string, ListState> {
  if (!client.recommendationLists) client.recommendationLists = new Map<string, ListState>();
  return client.recommendationLists;
}

function render(state: ListState, token: string) {
  const repository = new RecommendationRepository();
  const total = repository.count(state.guildId, state.type);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages - 1);
  const rows = repository.list(state.guildId, state.type, PAGE_SIZE, state.page * PAGE_SIZE);
  const lines = rows.map((row, index) => {
    const metadata = [!state.type ? labels[row.type] || row.type : undefined, row.year, row.type === 'music' ? row.creator : undefined].filter(Boolean).join(' • ');
    const votes = repository.upvoteCount(row.id);
    return `[${row.title}](${row.sourceUrl})${metadata ? ` — ${metadata}` : ''} · ⬆️ **${votes}**`;
  });
  const title = state.type ? `Les dernières recos • ${labels[state.type] || state.type}` : 'Les dernières recos';
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(lines.join('\n') || 'Aucune recommandation enregistrée pour ce filtre.')
    .setFooter({ text: `${total} recommandation${total > 1 ? 's' : ''} • Page ${state.page + 1}/${totalPages}` });
  const components = totalPages > 1 ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`recos:prev:${token}`).setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(state.page === 0),
    new ButtonBuilder().setCustomId(`recos:next:${token}`).setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(state.page >= totalPages - 1),
  )] : [];
  return { embeds: [embed], components };
}

export function createRecommendationList(client: Client, guildId: string, userId: string, type?: string) {
  const token = Math.random().toString(36).slice(2, 10);
  const state: ListState = { guildId, userId, type, page: 0, expiresAt: Date.now() + 15 * 60_000 };
  cache(client).set(token, state);
  return render(state, token);
}

export async function handleRecommendationListComponent(client: Client, interaction: any): Promise<boolean> {
  if (!interaction.customId?.startsWith('recos:')) return false;
  const [, action, token] = interaction.customId.split(':');
  const state = cache(client).get(token);
  if (!state || state.expiresAt < Date.now() || state.guildId !== interaction.guildId || state.userId !== interaction.user.id) {
    await interaction.reply({ content: 'Cette liste a expiré ou ne t’appartient pas.', ephemeral: true });
    return true;
  }
  state.page += action === 'next' ? 1 : -1;
  state.expiresAt = Date.now() + 15 * 60_000;
  await interaction.update(render(state, token));
  return true;
}
