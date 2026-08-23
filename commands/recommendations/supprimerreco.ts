import { ApplicationCommandOptionType } from 'discord.js';
import { deleteRecommendation } from '../../utils/recommendations/delete';

export = {
  name: 'supprimerreco', category: 'recommendations', ownerOnly: false,
  usage: 'supprimerreco id', examples: ['supprimerreco 42'],
  description: 'Supprimer une de tes recommandations.',
  options: [{ name: 'id', description: 'Identifiant affiché dans /recos', type: ApplicationCommandOptionType.Integer, required: true, minValue: 1 }],
  async runInteraction(client: any, interaction: any) {
    if (!interaction.guildId) return interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const message = await deleteRecommendation(client, interaction.guildId, interaction.options.getInteger('id', true), interaction.user.id);
    return interaction.editReply(message);
  },
};
