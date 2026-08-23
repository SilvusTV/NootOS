import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { deleteRecommendation } from '../../utils/recommendations/delete';

export = {
  name: 'adminsupprimerreco', category: 'admin', ownerOnly: false,
  usage: 'adminsupprimerreco id', examples: ['adminsupprimerreco 42'],
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  description: 'Supprimer une recommandation, quel que soit son auteur.',
  options: [{ name: 'id', description: 'Identifiant affiché dans /recos', type: ApplicationCommandOptionType.Integer, required: true, minValue: 1 }],
  async runInteraction(client: any, interaction: any) {
    if (!interaction.guildId) return interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const message = await deleteRecommendation(client, interaction.guildId, interaction.options.getInteger('id', true), interaction.user.id, true);
    return interaction.editReply(message);
  },
};
