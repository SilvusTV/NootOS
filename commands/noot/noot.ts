import { ApplicationCommandOptionType as O } from 'discord.js';
import { askNoot, chunks, transcribeAttachment } from '../../utils/noot/assistant';
import { Notebook } from '../../utils/noot/notebook';
export = {
  name: 'noot', description: 'Parler à NootOS, avec un message ou un vocal.', category: 'noot', ownerOnly: false,
  usage: 'noot message | oublier', examples: ['noot message texte: Ajoute une soirée jeux'],
  options: [
    { name: 'message', description: 'Discuter, demander une reco ou enregistrer un souvenir', type: O.Subcommand, options: [
      { name: 'texte', description: 'Ce que tu veux dire à NootOS', type: O.String, maxLength: 6000 },
      { name: 'vocal', description: 'Un fichier audio à transcrire', type: O.Attachment },
    ] },
    { name: 'oublier', description: 'Effacer ta mémoire de conversation dans ce salon (le carnet reste)', type: O.Subcommand },
  ],
  async runInteraction(_client: any, i: any) {
    if (!i.guildId) return i.reply({ content: 'Retrouve-moi dans votre serveur 🐧', ephemeral: true });
    await i.deferReply();
    try {
      const scope = { guildId: i.guildId, channelId: i.channelId, userId: i.user.id };
      if (i.options.getSubcommand() === 'oublier') {
        new Notebook().forget(scope.guildId, scope.channelId, scope.userId);
        return i.editReply('Mémoire de cette conversation effacée. Vos fiches et avis restent dans le carnet.');
      }
      let question = i.options.getString('texte') || '';
      const audio = i.options.getAttachment('vocal');
      if (audio) question += `\n${await transcribeAttachment(audio)}`;
      if (!question.trim()) return i.editReply('Ajoute un texte ou un vocal pour me parler 🐧');
      const parts = chunks(await askNoot(scope, question));
      await i.editReply({ content: parts[0], allowedMentions: { parse: [] } });
      for (const content of parts.slice(1)) await i.followUp({ content, allowedMentions: { parse: [] } });
    } catch (e) { return i.editReply({ content: e instanceof Error ? e.message : 'NootOS rencontre un souci.', allowedMentions: { parse: [] } }); }
  },
};
