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
import { Notebook } from '../noot/notebook';
import { getDb } from '../db/client';

type PendingRecommendation = {
  userId: string;
  guildId: string;
  candidates: RecommendationCandidate[];
  recommender?: Recommender;
  selected?: RecommendationCandidate;
  publishing?: boolean;
  expiresAt: number;
  notebook?: { details: string; fallbackChannelId: string };
};

export type Recommender = {
  id: string;
  name: string;
  avatarUrl?: string;
};

const labels: Record<RecommendationType, string> = {
  youtube: 'Vidéo YouTube', music: 'Musique', game: 'Jeu', movie: 'Film', series: 'Série',
};
const colors: Record<RecommendationType, number> = {
  youtube: 0xff0000, music: 0x1db954, game: 0x1b2838, movie: 0xf5c518, series: 0x01b4e4,
};
const channelKeys: Record<RecommendationType, keyof typeof CONFIG_KEYS> = {
  youtube: 'recoChannelYoutube', music: 'recoChannelMusic', game: 'recoChannelGame', movie: 'recoChannelMovie', series: 'recoChannelSeries',
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
  recommender?: Recommender,
  notebook?: { details: string; fallbackChannelId: string },
): string {
  const token = Math.random().toString(36).slice(2, 10);
  cache(client).set(token, { userId, guildId, candidates, recommender, notebook, selected: candidates.length === 1 ? candidates[0] : undefined, expiresAt: Date.now() + 10 * 60_000 });
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

export function buildRecommendationEmbed(candidate: RecommendationCandidate, recommender?: Recommender): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(colors[candidate.type])
    .setTitle(candidate.title.slice(0, 256))
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
  if (recommender) embed.setFooter({ text: `Recommandé par ${recommender.name}`, iconURL: recommender.avatarUrl });
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
    const candidate = pending.candidates[Number(interaction.values[0])];
    if (!candidate) { await interaction.reply({ content: 'Résultat invalide.', ephemeral: true }); return true; }
    pending.selected = candidate;
    const preview = buildRecommendationEmbed(candidate, pending.recommender);
    if (pending.notebook?.details) preview.setDescription(pending.notebook.details);
    await interaction.update({
      content: pending.notebook ? 'Vérifie la fiche avant son ajout au carnet et sa publication.' : 'Vérifie la recommandation avant sa publication.',
      embeds: [preview],
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
  await interaction.deferUpdate();

  try {

  const candidate = pending.selected;
  const recommendations = new RecommendationRepository();
  const duplicate = recommendations.findDuplicate(pending.guildId, candidate.type, candidate.externalId);
  if (duplicate) {
    const notebook = new Notebook(); notebook.syncRecommendations(pending.guildId);
    const item = notebook.linkedRecommendation(pending.guildId, duplicate.id);
    cache(client).delete(token);
    await interaction.editReply({ content: `Cette œuvre est déjà dans le carnet${item ? ` : #${item.id}` : ''}, dans <#${duplicate.channelId}>.`, embeds: [], components: [] });
    return true;
  }
  const configs = new ConfigRepository();
  const channelId = configs.getValue(pending.guildId, CONFIG_KEYS[channelKeys[candidate.type]]) || pending.notebook?.fallbackChannelId;
  if (!channelId) {
    pending.publishing = false;
    await interaction.editReply({ content: `Choisis un salon avec /carnet config pour ${labels[candidate.type]}, puis clique à nouveau sur Publier.` });
    return true;
  }
  const channel: any = await client.channels.fetch(channelId).catch(() => null);
  if (channel?.guildId !== pending.guildId || !channel?.isTextBased() || typeof channel.send !== 'function') {
    pending.publishing = false;
    await interaction.editReply({ content: 'Le salon configuré est introuvable. Corrige /carnet config puis clique à nouveau sur Publier.' });
    return true;
  }

  const recommender = pending.recommender || {
    id: interaction.user.id,
    name: interaction.member?.displayName || interaction.user.username,
    avatarUrl: interaction.user.displayAvatarURL?.(),
  };
  // Reserve both records atomically before publishing, so simultaneous selections cannot duplicate a work.
  const stored = getDb().transaction(() => {
  const recommendation = recommendations.create({
    guildId: pending.guildId, type: candidate.type, externalId: candidate.externalId, title: candidate.title,
    year: candidate.year, creator: candidate.creator, durationSeconds: candidate.durationSeconds,
    releaseDate: candidate.releaseDate, imageUrl: candidate.imageUrl, sourceUrl: candidate.sourceUrl,
    price: candidate.price, rating: candidate.rating, recommendedById: recommender.id,
    recommendedByName: recommender.name, channelId,
  });
  const item = new Notebook().add(pending.guildId, recommender.id, { kind: candidate.type, title: candidate.title.slice(0, 200), details: pending.notebook?.details || '', url: candidate.sourceUrl, sourceKey: `reco:${recommendation.id}` });
  return { recommendation, item };
  });
  const embed = buildRecommendationEmbed(candidate, recommender).setAuthor({ name: `Nouvelle envie · ${labels[candidate.type]}` })
    .setTitle(`#${stored.item.id} · ${candidate.title}`.slice(0, 256));
  if (pending.notebook?.details) embed.setDescription(pending.notebook.details);
  embed.setFooter({ text: `Ajouté par ${recommender.name} · /carnet fiche id:${stored.item.id}`.slice(0, 2048), iconURL: recommender.avatarUrl });
  let message: any;
  try {
    message = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    // Remove only this unannounced reservation; retain the selection for a retry.
    const { notebookItem } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    getDb().transaction(() => {
      getDb().delete(notebookItem).where(eq(notebookItem.id, stored.item.id)).run();
      recommendations.delete(stored.recommendation.id);
    });
    throw error;
  }
  recommendations.setMessageId(stored.recommendation.id, message.id);
  cache(client).delete(token);
  await interaction.editReply({ content: `🐧 Fiche #${stored.item.id} ajoutée au carnet et publiée dans <#${channelId}>.`, embeds: [], components: [] });
  } catch (error) {
    pending.publishing = false;
    await interaction.editReply({ content: 'L’ajout a échoué. Vérifie les permissions du salon et réessaie avec Publier, ou consulte /carnet liste si la fiche a déjà été ajoutée.' });
  }
  return true;
}
