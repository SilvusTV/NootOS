import { EmbedBuilder } from 'discord.js';
import { CONFIG_KEYS, ConfigRepository } from '../db';
import { Notebook, kinds, type Kind } from './notebook';
import type { NotebookItem } from '../db/schema';

export const notebookChannelKeys = {
  movie: CONFIG_KEYS.recoChannelMovie, series: CONFIG_KEYS.recoChannelSeries, game: CONFIG_KEYS.recoChannelGame,
  music: CONFIG_KEYS.recoChannelMusic, youtube: CONFIG_KEYS.recoChannelYoutube,
  date: CONFIG_KEYS.carnetChannelDate, idea: CONFIG_KEYS.carnetChannelIdea,
} as const;

export function buildFreeItemEmbed(item: NotebookItem, author: string) {
  const embed = new EmbedBuilder().setColor(0x83d5e8).setAuthor({ name: `Nouvelle envie · ${kinds[item.kind as Kind]}` })
    .setTitle(`#${item.id} · ${item.title}`.slice(0, 256)).setDescription(item.details || 'Une nouvelle envie à partager à deux.')
    .setFooter({ text: `Ajouté par ${author} · /carnet fiche id:${item.id}`.slice(0, 2048) }).setTimestamp();
  if (item.url) embed.setURL(item.url);
  return embed;
}

export async function publishFreeItem(client: any, item: NotebookItem, author: string, fallbackChannelId: string) {
  const channelId = new ConfigRepository().getValue(item.guildId, notebookChannelKeys[item.kind as Kind]) || fallbackChannelId;
  const channel = await client.channels.fetch(channelId);
  if (channel?.guildId !== item.guildId || !channel?.isTextBased() || typeof channel.send !== 'function') throw new Error('Salon de publication indisponible.');
  const message = await channel.send({ embeds: [buildFreeItemEmbed(item, author)], allowedMentions: { parse: [] } });
  new Notebook().trackPublication(item.guildId, item.id, channelId, message.id);
  return channelId;
}
