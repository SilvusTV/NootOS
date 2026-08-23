import { ApplicationCommandOptionType } from 'discord.js';
import { RecommendationRepository } from '../../utils/db';
import { autocompleteRecommendations, recommendationTypeChoices, selectedRecommendationId } from '../../utils/recommendations/autocomplete';

export = {
  name: 'upvotereco', category: 'recommendations', ownerOnly: false,
  usage: 'upvotereco type recommandation', examples: ['upvotereco série Severance'],
  description: 'Ajouter ou retirer ton upvote sur une recommandation.',
  options: [
    { name: 'type', description: 'Type de recommandation à rechercher', type: ApplicationCommandOptionType.String, required: true, choices: recommendationTypeChoices },
    { name: 'recommandation', description: 'Écris le titre de la recommandation', type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
  ],
  async runAutocomplete(client: any, interaction: any) {
    return autocompleteRecommendations(interaction);
  },
  async runInteraction(client: any, interaction: any) {
    if (!interaction.guildId) return interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    const repository = new RecommendationRepository();
    const id = selectedRecommendationId(interaction);
    if (!id) return interaction.reply({ content: 'Sélectionne une recommandation proposée par l’autocomplétion.', ephemeral: true });
    const recommendation = repository.findById(interaction.guildId, id);
    if (!recommendation) return interaction.reply({ content: 'Cette recommandation est introuvable.', ephemeral: true });
    const added = repository.toggleCommandUpvote(id, interaction.user.id);
    const count = repository.upvoteCount(id);
    return interaction.reply({
      content: `${added ? 'Upvote ajouté à' : 'Upvote retiré de'} **${recommendation.title}**. Total : ⬆️ **${count}**`,
      ephemeral: true,
    });
  },
};
