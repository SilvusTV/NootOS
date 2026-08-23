import { ApplicationCommandOptionType } from 'discord.js';
import { RecommendationRepository } from '../../utils/db';

export = {
  name: 'upvotereco', category: 'recommendations', ownerOnly: false,
  usage: 'upvotereco id', examples: ['upvotereco 42'],
  description: 'Ajouter ou retirer ton upvote sur une recommandation.',
  options: [{ name: 'id', description: 'Identifiant affiché dans /recos', type: ApplicationCommandOptionType.Integer, required: true, minValue: 1 }],
  async runInteraction(client: any, interaction: any) {
    if (!interaction.guildId) return interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    const repository = new RecommendationRepository();
    const id = interaction.options.getInteger('id', true);
    const recommendation = repository.findById(interaction.guildId, id);
    if (!recommendation) return interaction.reply({ content: `La recommandation #${id} est introuvable.`, ephemeral: true });
    const added = repository.toggleCommandUpvote(id, interaction.user.id);
    const count = repository.upvoteCount(id);
    return interaction.reply({
      content: `${added ? 'Upvote ajouté à' : 'Upvote retiré de'} **#${id} · ${recommendation.title}**. Total : ⬆️ **${count}**`,
      ephemeral: true,
    });
  },
};
