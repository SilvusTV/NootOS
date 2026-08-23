import { ApplicationCommandOptionType } from 'discord.js';
import { createRecommendationList } from '../../utils/recommendations/list';

const choices = [
  { name: 'Toutes', value: 'all' }, { name: 'Vidéos YouTube', value: 'youtube' },
  { name: 'Musiques', value: 'music' }, { name: 'Jeux', value: 'game' }, { name: 'Films', value: 'movie' }, { name: 'Séries', value: 'series' },
];

export = {
  name: 'recos', category: 'recommendations', ownerOnly: false, usage: 'recos [type]', examples: ['recos', 'recos music'],
  description: 'Afficher les dernières recommandations.',
  options: [{ name: 'type', description: 'Filtrer la liste', type: ApplicationCommandOptionType.String, required: false, choices }],
  async runInteraction(client: any, interaction: any) {
    if (!interaction.guildId) return interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    const selected = interaction.options.getString('type') || 'all';
    return interaction.reply(createRecommendationList(client, interaction.guildId, interaction.user.id, selected === 'all' ? undefined : selected));
  },
};
