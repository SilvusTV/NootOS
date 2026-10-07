import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown } from 'discord.js';
import { Notebook } from './notebook';

type PendingDelete = { guildId: string; userId: string; itemId: number; expiresAt: number };
const pending = new Map<string, PendingDelete>();
const deleting = new Set<string>();

export function prepareNotebookDelete(guildId: string, userId: string, itemId: number) {
  const item = new Notebook().find(guildId, itemId);
  for (const [token, state] of pending) if (state.expiresAt < Date.now()) pending.delete(token);
  const token = randomUUID();
  pending.set(token, { guildId, userId, itemId, expiresAt: Date.now() + 5 * 60_000 });
  return {
    content: `Supprimer **#${item.id} · ${escapeMarkdown(item.title)}** ? Ses avis et votes seront supprimés, ainsi que les messages de fiche dont NootOS connaît l’emplacement. Cette suppression est définitive.`,
    allowedMentions: { parse: [] as string[] },
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`carnet-delete:confirm:${token}`).setLabel('Supprimer').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`carnet-delete:cancel:${token}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
    )],
  };
}

function alreadyGone(error: unknown) {
  const code = (error as { code?: number })?.code;
  return code === 10008 || code === 10003; // Discord: Unknown Message / Unknown Channel.
}

export async function handleNotebookDeleteComponent(client: any, interaction: any): Promise<boolean> {
  if (!interaction.customId?.startsWith('carnet-delete:')) return false;
  const [, action, token] = interaction.customId.split(':');
  const state = pending.get(token);
  if (!state || state.expiresAt < Date.now() || state.guildId !== interaction.guildId || state.userId !== interaction.user.id) {
    if (state && state.expiresAt < Date.now()) pending.delete(token);
    await interaction.reply({ content: 'Cette confirmation a expiré ou ne t’appartient pas. Relance /carnet delete.', ephemeral: true });
    return true;
  }
  const key = `${state.guildId}:${state.itemId}`;
  if (deleting.has(key)) {
    await interaction.reply({ content: 'La suppression de cette fiche est déjà en cours.', ephemeral: true });
    return true;
  }
  if (action === 'cancel') {
    pending.delete(token);
    await interaction.update({ content: 'Suppression annulée. La fiche reste dans votre carnet.', components: [] });
    return true;
  }
  if (action !== 'confirm') return true;
  deleting.add(key);
  try {
    await interaction.deferUpdate();
    const repo = new Notebook();
    const item = repo.find(state.guildId, state.itemId);
    const publications = repo.publications(state.guildId, state.itemId);
    for (const publication of publications) {
      try {
        const channel = await client.channels.fetch(publication.channelId);
        if (!channel) continue;
        if (channel.guildId !== state.guildId || !channel.messages) throw new Error('Salon de publication inaccessible.');
        const message = await channel.messages.fetch(publication.messageId);
        await message.delete();
      } catch (error) {
        if (!alreadyGone(error)) throw error;
      }
    }
    repo.delete(state.guildId, state.itemId);
    pending.delete(token);
    await interaction.editReply({ content: `🐧 Fiche #${item.id} supprimée, avec ses avis et votes.${publications.length ? ' Ses messages publiés ont également été retirés.' : ' Aucun emplacement de message publié n’était enregistré pour cette fiche.'}`, components: [] });
  } catch (error) {
    let present = false;
    try { new Notebook().find(state.guildId, state.itemId); present = true; } catch {}
    if (present) await interaction.editReply({ content: 'La suppression a échoué. La fiche et ses avis restent dans le carnet. Vérifie les permissions du salon, puis réessaie avec Supprimer.' });
    else {
      pending.delete(token);
      await interaction.editReply({ content: 'Cette fiche n’est plus dans le carnet.', components: [] });
    }
  } finally { deleting.delete(key); }
  return true;
}
