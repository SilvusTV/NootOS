import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { CONFIG_KEYS, ConfigRepository } from '../../utils/db';

const installing = new Set<string>();
const rooms = [
  ['🐧・nootos', 'Discutez avec NootOS. Les messages et vocaux de ce salon sont transmis à OpenAI lorsque la clé est configurée.', CONFIG_KEYS.nootChannel],
  ['🎬・films', 'Vos films à regarder et vos recos.', CONFIG_KEYS.recoChannelMovie],
  ['📺・series', 'Vos séries et prochains épisodes.', CONFIG_KEYS.recoChannelSeries],
  ['🎮・jeux', 'Les jeux à découvrir ensemble.', CONFIG_KEYS.recoChannelGame],
  ['🎵・musique', 'Votre bande-son à deux.', CONFIG_KEYS.recoChannelMusic],
  ['📹・videos', 'Les vidéos à partager.', CONFIG_KEYS.recoChannelYoutube],
  ['💕・dates', 'Des lieux, des balades et des idées de sorties. /carnet ajouter type: Sortie / date', CONFIG_KEYS.carnetChannelDate],
  ['💡・idees', 'Toutes vos petites envies à deux.', CONFIG_KEYS.carnetChannelIdea],
  ['📒・souvenirs', 'Vos notes et retours datés. /carnet avis et /carnet fiche'],
] as const;
export = {
  name: 'installer', description: 'Préparer les salons de votre petit monde NOOT NOOOOT.', category: 'noot', ownerOnly: false,
  usage: 'installer', examples: ['installer'],
  async runInteraction(_client: any, i: any) {
    if (!i.guild) return i.reply({ content: 'Cette commande se lance dans votre serveur.', ephemeral: true });
    if (installing.has(i.guildId)) return i.reply({ content: 'Installation déjà en cours 🐧', ephemeral: true });
    await i.deferReply({ ephemeral: true });
    installing.add(i.guildId);
    try {
      const me = await i.guild.members.fetchMe();
      if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) return i.editReply('Donne à NootOS la permission « Gérer les salons », puis relance /installer.');
      const channels = await i.guild.channels.fetch();
      let category = channels.find((c: any) => c?.type === ChannelType.GuildCategory && c.name === 'NOOT NOOOOT');
      if (!category) category = await i.guild.channels.create({ name: 'NOOT NOOOOT', type: ChannelType.GuildCategory });
      const config = new ConfigRepository();
      for (const [name, topic, key] of rooms) {
        const configured = key ? config.getValue(i.guildId, key) : undefined;
        let channel = configured ? channels.get(configured) : undefined;
        if (channel?.type !== ChannelType.GuildText) channel = undefined;
        if (!channel) channel = channels.find((c: any) => c?.type === ChannelType.GuildText && c.parentId === category.id && c.name === name);
        if (!channel) channel = await i.guild.channels.create({ name, topic, type: ChannelType.GuildText, parent: category.id });
        if (key) config.upsert(i.guildId, key, channel.id);
      }
      return i.editReply('🐧 Noot nooooot ! Vos salons sont prêts. /aide pour découvrir le carnet ; parlez-moi dans le salon nootos. Relancer /installer réutilise vos salons.');
    } catch (e) { return i.editReply('Installation interrompue. Vérifie les permissions de NootOS puis relance /installer : les salons déjà créés seront réutilisés.'); }
    finally { installing.delete(i.guildId); }
  },
};
