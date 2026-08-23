import type { Client } from 'discord.js';
import { RecommendationRepository } from '../db';

export async function deleteRecommendation(client: Client, guildId: string, id: number, requesterId: string, admin = false): Promise<string> {
  const repository = new RecommendationRepository();
  const recommendation = repository.findById(guildId, id);
  if (!recommendation) return `La recommandation #${id} est introuvable.`;
  if (!admin && recommendation.recommendedById !== requesterId) return 'Tu ne peux supprimer que tes propres recommandations.';

  const channel: any = await client.channels.fetch(recommendation.channelId).catch(() => null);
  if (!channel?.isTextBased() || !channel.messages) return 'Le salon de cette recommandation est introuvable. La suppression a été annulée.';
  if (recommendation.messageId) {
    const message = await channel.messages.fetch(recommendation.messageId).catch(() => null);
    if (message) {
      const deleted = await message.delete().then(() => true).catch(() => false);
      if (!deleted) return 'Impossible de supprimer le message de recommandation. Vérifie les permissions du bot.';
    }
  }
  repository.delete(recommendation.id);
  return `La recommandation **#${recommendation.id} · ${recommendation.title}** a été supprimée.`;
}
