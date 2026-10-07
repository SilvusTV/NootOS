import { EmbedBuilder } from 'discord.js';
export = {
  name: 'aide', description: 'Bienvenue dans votre petit monde à deux.', category: 'noot', ownerOnly: false,
  usage: 'aide', examples: ['aide'],
  async runInteraction(_client: any, i: any) {
    return i.reply({ embeds: [new EmbedBuilder().setColor(0x83d5e8).setTitle('🐧 NootOS · NOOT NOOOOT')
      .setDescription('Vos envies, vos soirées et vos souvenirs, au même endroit.')
      .addFields(
        { name: '🌙 Construire votre monde', value: '`/installer` prépare vos salons.' },
        { name: '🍿 À découvrir', value: '`/carnet ajouter` recherche films, séries, jeux, musiques et vidéos par nom ou lien, puis publie la fiche après confirmation. Pour les dates et idées, ajout libre ; `libre:true` permet aussi une œuvre hors catalogue. `/carnet config` choisit les salons.' },
        { name: '📒 Votre journal', value: '`/carnet liste` explore vos fiches. `/carnet avis` garde votre note sur 5, votre retour et la date. Chacun son avis ; vous pouvez revoir une œuvre et la noter à nouveau. `/carnet delete id` supprime une fiche et ses avis après confirmation.' },
        { name: '💕 Ce soir', value: '`/carnet hasard` pioche une envie. `/carnet statut` suit votre progression. `/carnet fiche` montre les détails et vos derniers avis.' },
        { name: '💬 Parler à NootOS', value: '`/noot message` ou un message dans le salon nootos. « Ajoute un pique-nique au bord du lac », « Note Dune 4/5 pour hier », « Une série courte selon nos goûts ? »\nEnvoyez aussi un message vocal ou une pièce jointe audio. Les échanges adressés à NootOS sont transmis à OpenAI. `/noot oublier` efface votre mémoire de conversation dans ce salon.' },
      ).setFooter({ text: 'Un petit noot, beaucoup de souvenirs.' })] });
  },
};
