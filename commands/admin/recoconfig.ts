import { ApplicationCommandOptionType, ChannelType } from 'discord.js';
import { CONFIG_KEYS, ConfigRepository } from '../../utils/db';

const keys = { youtube: CONFIG_KEYS.recoChannelYoutube, music: CONFIG_KEYS.recoChannelMusic, game: CONFIG_KEYS.recoChannelGame, movie: CONFIG_KEYS.recoChannelMovie, series: CONFIG_KEYS.recoChannelSeries } as const;

export = {
  name: 'recoconfig', category: 'admin', ownerOnly: false, usage: 'recoconfig type salon', examples: ['recoconfig film #films'],
  description: 'Configurer le salon de publication d’un type de reco.',
  options: [
    { name: 'type', description: 'Type de recommandation', type: ApplicationCommandOptionType.String, required: true, choices: [
      { name: 'Vidéo YouTube', value: 'youtube' }, { name: 'Musique', value: 'music' }, { name: 'Jeu', value: 'game' },
      { name: 'Film', value: 'movie' }, { name: 'Série', value: 'series' },
    ] },
    { name: 'salon', description: 'Salon qui recevra les recommandations', type: ApplicationCommandOptionType.Channel, required: true, channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
  ],
  async runInteraction(client: any, interaction: any) {
    if (!interaction.guildId) return interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    const type = interaction.options.getString('type', true) as keyof typeof keys;
    const channel = interaction.options.getChannel('salon', true);
    new ConfigRepository().upsert(interaction.guildId, keys[type], channel.id);
    return interaction.reply({ content: `Les recos **${type}** seront publiées dans <#${channel.id}>.`, ephemeral: true });
  },
};
