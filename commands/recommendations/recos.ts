import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { RecommendationRepository } from '../../utils/db';

const choices = [
  { name: 'Toutes', value: 'all' }, { name: 'Vidéos YouTube', value: 'youtube' },
  { name: 'Musiques', value: 'music' }, { name: 'Jeux', value: 'game' }, { name: 'Films', value: 'movie' }, { name: 'Séries', value: 'series' },
];

const labels: Record<string, string> = {
  youtube: 'Vidéo YouTube', music: 'Musique', game: 'Jeu', movie: 'Film', series: 'Série',
};

export = {
  name: 'recos', category: 'recommendations', ownerOnly: false, usage: 'recos [type]', examples: ['recos', 'recos music'],
  description: 'Afficher les dernières recommandations.',
  options: [{ name: 'type', description: 'Filtrer la liste', type: ApplicationCommandOptionType.String, required: false, choices }],
  async runInteraction(client: any, interaction: any) {
    if (!interaction.guildId) return interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    const selected = interaction.options.getString('type') || 'all';
    const rows = new RecommendationRepository().list(interaction.guildId, selected === 'all' ? undefined : selected, 25);
    if (!rows.length) return interaction.reply('Aucune recommandation enregistrée pour ce filtre.');
    const lines = rows.map((row, index) => {
      const metadata = [selected === 'all' ? labels[row.type] || row.type : undefined, row.year, row.type === 'music' ? row.creator : undefined].filter(Boolean).join(' • ');
      return `${index + 1}. [${row.title}](${row.sourceUrl})${metadata ? ` — ${metadata}` : ''}`;
    });
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('Les dernières recos').setDescription(lines.join('\n')).setFooter({ text: `${rows.length} recommandation${rows.length > 1 ? 's' : ''}` });
    return interaction.reply({ embeds: [embed] });
  },
};
