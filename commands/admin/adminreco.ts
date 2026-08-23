import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import {
  buildConfirmation,
  buildRecommendationEmbed,
  buildSelection,
  getRecommendationProvider,
  ProviderError,
  storePending,
  type RecommendationType,
} from '../../utils/recommendations';

const choices = [
  { name: 'Vidéo YouTube', value: 'youtube' }, { name: 'Musique', value: 'music' },
  { name: 'Jeu', value: 'game' }, { name: 'Film', value: 'movie' }, { name: 'Série', value: 'series' },
];

export = {
  name: 'adminreco', category: 'admin', ownerOnly: false,
  usage: 'adminreco membre type recherche', examples: ['adminreco @Bobby série Severance'],
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  description: 'Ajouter une recommandation au nom d’un membre.',
  options: [
    { name: 'membre', description: 'Personne à qui attribuer la recommandation', type: ApplicationCommandOptionType.User, required: true },
    { name: 'type', description: 'Type de recommandation', type: ApplicationCommandOptionType.String, required: true, choices },
    { name: 'recherche', description: 'Nom ou lien YouTube, Steam ou IMDb', type: ApplicationCommandOptionType.String, required: true },
  ],
  async runInteraction(client: any, interaction: any) {
    if (!interaction.guildId) return interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    try {
      const user = interaction.options.getUser('membre', true);
      const member = interaction.options.getMember('membre');
      const recommender = {
        id: user.id,
        name: member?.displayName || user.globalName || user.username,
        avatarUrl: user.displayAvatarURL(),
      };
      const type = interaction.options.getString('type', true) as RecommendationType;
      const query = interaction.options.getString('recherche', true).trim();
      const candidates = await getRecommendationProvider(type).search(query);
      if (!candidates.length) return interaction.editReply('Aucun résultat trouvé. Essaie avec un lien direct ou une recherche plus précise.');
      const token = storePending(client, interaction.guildId, interaction.user.id, candidates, recommender);
      if (candidates.length === 1) {
        return interaction.editReply({
          content: `Vérifie la recommandation attribuée à <@${user.id}> avant sa publication.`,
          embeds: [buildRecommendationEmbed(candidates[0], recommender)],
          components: [buildConfirmation(token)],
        });
      }
      return interaction.editReply({
        content: `Plusieurs résultats correspondent pour la recommandation de <@${user.id}>. Lequel veux-tu publier ?`,
        components: [buildSelection(token, candidates)],
      });
    } catch (error) {
      console.error(error);
      const message = error instanceof ProviderError ? error.userMessage : 'Impossible de récupérer cette recommandation pour le moment.';
      return interaction.editReply(message);
    }
  },
};
