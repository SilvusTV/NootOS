import { RecommendationRepository } from '../../utils/db';

const supported = new Set(['⬆️', '➕']);

export = {
  name: 'messageReactionAdd', once: false,
  async execute(client: any, reaction: any, user: any) {
    if (user.bot || !supported.has(reaction.emoji.name)) return;
    if (reaction.partial) await reaction.fetch().catch(() => null);
    const guildId = reaction.message.guildId;
    if (!guildId) return;
    const repository = new RecommendationRepository();
    const recommendation = repository.findByMessage(guildId, reaction.message.id);
    if (recommendation) repository.addUpvote(recommendation.id, user.id, `reaction:${reaction.emoji.name}`);
  },
};
