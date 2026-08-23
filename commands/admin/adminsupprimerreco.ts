import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { autocompleteRecommendations, recommendationTypeChoices, selectedRecommendationId } from '../../utils/recommendations/autocomplete';
import { deleteRecommendation } from '../../utils/recommendations/delete';

export = {
  name: 'adminsupprimerreco', category: 'admin', ownerOnly: false,
  usage: 'adminsupprimerreco type recommandation', examples: ['adminsupprimerreco film Dune'],
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  description: 'Supprimer une recommandation, quel que soit son auteur.',
  options: [
    { name: 'type', description: 'Type de recommandation à rechercher', type: ApplicationCommandOptionType.String, required: true, choices: recommendationTypeChoices },
    { name: 'recommandation', description: 'Écris le titre de la recommandation', type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
  ],
  async runAutocomplete(client: any, interaction: any) {
    return autocompleteRecommendations(interaction);
  },
  async runInteraction(client: any, interaction: any) {
    if (!interaction.guildId) return interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const id = selectedRecommendationId(interaction);
    if (!id) return interaction.editReply('Sélectionne une recommandation proposée par l’autocomplétion.');
    const message = await deleteRecommendation(client, interaction.guildId, id, interaction.user.id, true);
    return interaction.editReply(message);
  },
};
