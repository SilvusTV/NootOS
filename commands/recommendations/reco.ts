import { ApplicationCommandOptionType } from 'discord.js';
import { buildConfirmation, buildRecommendationEmbed, buildSelection, getRecommendationProvider, ProviderError, storePending, type RecommendationType } from '../../utils/recommendations';

const choices = [
  { name: 'Vidéo YouTube', value: 'youtube' }, { name: 'Musique', value: 'music' },
  { name: 'Jeu', value: 'game' }, { name: 'Film', value: 'movie' }, { name: 'Série', value: 'series' },
];

export = {
  name: 'reco', category: 'recommendations', ownerOnly: false,
  usage: 'reco type recherche', examples: ['reco film Dune', 'reco série Severance', 'reco jeu https://store.steampowered.com/app/1091500'],
  description: 'Ajouter une recommandation.',
  options: [
    { name: 'type', description: 'Type de recommandation', type: ApplicationCommandOptionType.String, required: true, choices },
    { name: 'recherche', description: 'Nom ou lien YouTube, Steam ou IMDb', type: ApplicationCommandOptionType.String, required: true },
  ],
  async runInteraction(client: any, interaction: any) {
    if (!interaction.guildId) return interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    try {
      const type = interaction.options.getString('type', true) as RecommendationType;
      const query = interaction.options.getString('recherche', true).trim();
      const candidates = await getRecommendationProvider(type).search(query);
      if (!candidates.length) return interaction.editReply('Aucun résultat trouvé. Essaie avec un lien direct ou une recherche plus précise.');
      const recommender = {
        id: interaction.user.id,
        name: interaction.member?.displayName || interaction.user.username,
        avatarUrl: interaction.user.displayAvatarURL?.(),
      };
      const token = storePending(client, interaction.guildId, interaction.user.id, candidates, recommender);
      if (candidates.length === 1) {
        return interaction.editReply({ content: 'Vérifie la recommandation avant sa publication.', embeds: [buildRecommendationEmbed(candidates[0], recommender)], components: [buildConfirmation(token)] });
      }
      return interaction.editReply({ content: 'Plusieurs résultats correspondent. Lequel veux-tu recommander ?', components: [buildSelection(token, candidates)] });
    } catch (error) {
      console.error(error);
      const message = error instanceof ProviderError ? error.userMessage : 'Impossible de récupérer cette recommandation pour le moment.';
      return interaction.editReply(message);
    }
  },
};
