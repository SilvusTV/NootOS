import { ApplicationCommandOptionType } from 'discord.js';
import { autocompleteRecommendations, recommendationTypeChoices, selectedRecommendationId } from '../../utils/recommendations/autocomplete';
import { deleteRecommendation } from '../../utils/recommendations/delete';

export = {
  name: 'supprimerreco', category: 'recommendations', ownerOnly: false,
  usage: 'supprimerreco type recommandation', examples: ['supprimerreco série Severance'],
  description: 'Supprimer une de tes recommandations.',
  options: [
    { name: 'type', description: 'Type de recommandation à rechercher', type: ApplicationCommandOptionType.String, required: true, choices: recommendationTypeChoices },
    { name: 'recommandation', description: 'Écris le titre de ta recommandation', type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
  ],
  async runAutocomplete(client: any, interaction: any) {
    return autocompleteRecommendations(interaction, interaction.user.id);
  },
  async runInteraction(client: any, interaction: any) {
    if (!interaction.guildId) return interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const id = selectedRecommendationId(interaction);
    if (!id) return interaction.editReply('Sélectionne une recommandation proposée par l’autocomplétion.');
    const message = await deleteRecommendation(client, interaction.guildId, id, interaction.user.id);
    return interaction.editReply(message);
  },
};
