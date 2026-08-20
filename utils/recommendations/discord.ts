import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type Client,
} from 'discord.js';
import { CONFIG_KEYS, ConfigRepository, RecommendationRepository } from '../db';
import type { RecommendationCandidate, RecommendationType } from './types';

type PendingRecommendation = {
  userId: string;
  guildId: string;
  candidates: RecommendationCandidate[];
  selected?: RecommendationCandidate;
  publishing?: boolean;
  expiresAt: number;
};

const labels: Record<RecommendationType, string> = {
  youtube: 'Vidéo YouTube', music: 'Musique', game: 'Jeu', movie: 'Film',
};
const colors: Record<RecommendationType, number> = {
  youtube: 0xff0000, music: 0x1db954, game: 0x1b2838, movie: 0xf5c518,
};
const channelKeys: Record<RecommendationType, keyof typeof CONFIG_KEYS> = {
  youtube: 'recoChannelYoutube', music: 'recoChannelMusic', game: 'recoChannelGame', movie: 'recoChannelMovie',
};

function cache(client: any): Map<string, PendingRecommendation> {
  if (!client.pendingRecommendations) client.pendingRecommendations = new Map<string, PendingRecommendation>();
  return client.pendingRecommendations;
}

export function storePending(
  client: Client,
  guildId: string,
  userId: string,
  candidates: RecommendationCandidate[],
): string {
  const token = Math.random().toString(36).slice(2, 10);
  cache(client).set(token, { userId, guildId, candidates, selected: candidates.length === 1 ? candidates[0] : undefined, expiresAt: Date.now() + 10 * 60_000 });
  return token;
}

function getPending(client: Client, token: string, interaction: any): PendingRecommendation | undefined {
  const pending = cache(client).get(token);
  if (!pending || pending.expiresAt < Date.now()) {
    cache(client).delete(token);
    return undefined;
  }
  if (pending.userId !== interaction.user.id || pending.guildId !== interaction.guildId) return undefined;
  return pending;
}

export function formatDuration(seconds?: number): string | undefined {
  if (!seconds) return undefined;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hours ? `${hours} h ${minutes.toString().padStart(2, '0')} min` : `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function buildRecommendationEmbed(candidate: RecommendationCandidate, recommender?: any): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(colors[candidate.type])
    .setTitle(candidate.title)
    .setURL(candidate.sourceUrl)
    .setAuthor({ name: `Nouvelle reco • ${labels[candidate.type]}` })
    .setTimestamp();
  if (candidate.imageUrl) embed.setThumbnail(candidate.imageUrl);
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];
  if (candidate.creator) fields.push({ name: candidate.type === 'youtube' ? 'Chaîne' : 'Artiste', value: candidate.creator, inline: true });
  if (candidate.year) fields.push({ name: 'Année', value: String(candidate.year), inline: true });
  const duration = formatDuration(candidate.durationSeconds);
  if (duration) fields.push({ name: 'Durée', value: duration, inline: true });
  if (candidate.releaseDate && (candidate.type === 'youtube' || candidate.type === 'game')) {
    fields.push({ name: 'Sortie', value: candidate.releaseDate, inline: true });
  }
  if (candidate.price) fields.push({ name: 'Prix', value: candidate.price, inline: true });
  if (candidate.rating) fields.push({ name: 'Avis Steam', value: candidate.rating, inline: true });
  if (fields.length) embed.addFields(fields);
  if (recommender) embed.setFooter({ text: `Recommandé par ${recommender.displayName || recommender.username}`, iconURL: recommender.displayAvatarURL?.() });
  return embed;
}

export function buildSelection(token: string, candidates: RecommendationCandidate[]) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`reco:select:${token}`)
      .setPlaceholder('Choisis le bon résultat')
      .addOptions(candidates.map((candidate, index) => ({
        label: candidate.title.slice(0, 100),
        description: [candidate.creator, candidate.year].filter(Boolean).join(' • ').slice(0, 100) || labels[candidate.type],
        value: String(index),
      }))),
  );
}

export function buildConfirmation(token: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`reco:confirm:${token}`).setLabel('Publier').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reco:cancel:${token}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
  );
}

export async function handleRecommendationComponent(client: Client, interaction: any): Promise<boolean> {
  if (!interaction.customId?.startsWith('reco:')) return false;
  const [, action, token] = interaction.customId.split(':');
  const pending = getPending(client, token, interaction);
  if (!pending) {
    await interaction.reply({ content: 'Cette sélection a expiré ou ne t’appartient pas.', ephemeral: true });
    return true;
  }

  if (action === 'select') {
    pending.selected = pending.candidates[Number(interaction.values[0])];
    await interaction.update({
      content: 'Vérifie la recommandation avant sa publication.',
      embeds: [buildRecommendationEmbed(pending.selected, interaction.member)],
      components: [buildConfirmation(token)],
    });
    return true;
  }
  if (action === 'cancel') {
    cache(client).delete(token);
    await interaction.update({ content: 'Recommandation annulée.', embeds: [], components: [] });
    return true;
  }
  if (action !== 'confirm' || !pending.selected) return true;
  if (pending.publishing) {
    await interaction.reply({ content: 'La publication est déjà en cours.', ephemeral: true });
    return true;
  }
  pending.publishing = true;

  const candidate = pending.selected;
  const recommendations = new RecommendationRepository();
  const duplicate = recommendations.findDuplicate(pending.guildId, candidate.type, candidate.externalId);
  if (duplicate) {
    cache(client).delete(token);
    await interaction.update({ content: `Cette recommandation existe déjà : <#${duplicate.channelId}>.`, embeds: [], components: [] });
    return true;
  }
  const configs = new ConfigRepository();
  const channelId = configs.getValue(pending.guildId, CONFIG_KEYS[channelKeys[candidate.type]]);
  if (!channelId) {
    pending.publishing = false;
    await interaction.reply({ content: `Aucun salon n’est configuré pour les recos ${labels[candidate.type]}.`, ephemeral: true });
    return true;
  }
  const channel: any = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || typeof channel.send !== 'function') {
    pending.publishing = false;
    await interaction.reply({ content: 'Le salon configuré est introuvable ou non textuel.', ephemeral: true });
    return true;
  }

  const message = await channel.send({ embeds: [buildRecommendationEmbed(candidate, interaction.member)] });
  recommendations.create({
    guildId: pending.guildId, type: candidate.type, externalId: candidate.externalId, title: candidate.title,
    year: candidate.year, creator: candidate.creator, durationSeconds: candidate.durationSeconds,
    releaseDate: candidate.releaseDate, imageUrl: candidate.imageUrl, sourceUrl: candidate.sourceUrl,
    price: candidate.price, rating: candidate.rating, recommendedById: interaction.user.id,
    recommendedByName: interaction.member?.displayName || interaction.user.username, channelId, messageId: message.id,
  });
  cache(client).delete(token);
  await interaction.update({ content: `Recommandation publiée dans <#${channelId}>.`, embeds: [], components: [] });
  return true;
}
