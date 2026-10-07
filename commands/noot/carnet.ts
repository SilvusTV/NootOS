import { ApplicationCommandOptionType as O, AttachmentBuilder, ChannelType, EmbedBuilder, escapeMarkdown } from 'discord.js';
import { Notebook, kinds, statuses, today, type Kind, type Status } from '../../utils/noot/notebook';
import { buildConfirmation, buildRecommendationEmbed, buildSelection, getRecommendationProvider, ProviderError, RECOMMENDATION_TYPES, storePending, type RecommendationType, type RecommendationCandidate } from '../../utils/recommendations';
import { ConfigRepository, RecommendationRepository } from '../../utils/db';
import { notebookChannelKeys, publishFreeItem } from '../../utils/noot/publication';
import { prepareNotebookDelete } from '../../utils/noot/delete';

const kindChoices = Object.entries(kinds).map(([value, name]) => ({ name, value }));
const statusChoices = Object.entries(statuses).map(([value, name]) => ({ name, value }));
const id = { name: 'id', description: 'Identifiant de la fiche, visible dans /carnet liste', type: O.Integer, required: true, minValue: 1 };
const str = (name: string, description: string, required = false, maxLength = 2000) => ({ name, description, type: O.String, required, maxLength });
export = {
  name: 'carnet', description: 'Votre bibliothèque, vos souvenirs et vos idées à deux.', category: 'noot', ownerOnly: false,
  usage: 'carnet liste | ajouter | avis | fiche | statut | hasard', examples: ['carnet ajouter', 'carnet avis'],
  options: [
    { name: 'delete', description: 'Supprimer une fiche, ses avis et son message après confirmation', type: O.Subcommand, options: [id] },
    { name: 'config', description: 'Choisir le salon de publication d’une catégorie', type: O.Subcommand, options: [
      { ...str('type', 'Catégorie', true), choices: kindChoices }, { name: 'salon', description: 'Salon de publication', type: O.Channel, required: true, channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
    ] },
    { name: 'voter', description: 'Ajouter ou retirer ton vote pour une œuvre du carnet', type: O.Subcommand, options: [id] },
    { name: 'export', description: 'Télécharger toutes vos fiches et tous vos avis en JSON', type: O.Subcommand },
    { name: 'ajouter', description: 'Chercher une œuvre par nom ou lien, ou ajouter une idée libre', type: O.Subcommand, options: [
      { ...str('type', 'Catégorie', true), choices: kindChoices }, str('recherche', 'Nom, lien Steam / IMDb / YouTube, ou titre de votre idée', true, 1000), str('details', 'Envie, adresse, budget, pourquoi…'), str('lien', 'Lien prioritaire pour la recherche ; lien facultatif pour une idée', false, 1000),
      { name: 'libre', description: 'Ajouter sans recherche de métadonnées (œuvre introuvable, jeu hors Steam…)', type: O.Boolean },
    ] },
    { name: 'liste', description: 'Explorer vos envies et souvenirs', type: O.Subcommand, options: [
      { ...str('type', 'Catégorie'), choices: kindChoices }, { ...str('statut', 'À faire, en cours ou terminé'), choices: statusChoices }, str('recherche', 'Chercher un titre', false, 200), { name: 'page', description: 'Page de 15 fiches', type: O.Integer, minValue: 1 },
    ] },
    { name: 'fiche', description: 'Voir les détails et vos avis datés', type: O.Subcommand, options: [id] },
    { name: 'avis', description: 'Ajouter ou corriger ton avis pour une date', type: O.Subcommand, options: [id,
      { name: 'note', description: 'Ta note sur 5 (demi-étoiles possibles)', type: O.Number, minValue: 0, maxValue: 5 }, str('retour', 'Ton ressenti'), str('date', 'AAAA-MM-JJ ; aujourd’hui par défaut', false, 10),
    ] },
    { name: 'statut', description: 'Changer le statut commun d’une fiche', type: O.Subcommand, options: [id, { ...str('valeur', 'Nouveau statut', true), choices: statusChoices }] },
    { name: 'hasard', description: 'Piocher une envie au hasard', type: O.Subcommand, options: [{ ...str('type', 'Catégorie'), choices: kindChoices }] },
  ],
  async runInteraction(client: any, i: any) {
    if (!i.guildId) return i.reply({ content: 'Retrouve-moi dans NOOT NOOOOT 🐧', ephemeral: true });
    const sub = i.options.getSubcommand();
    await i.deferReply({ ephemeral: sub === 'ajouter' || sub === 'config' || sub === 'delete' });
    try {
      const repo = new Notebook(); repo.syncRecommendations(i.guildId);
      const itemId = i.options.getInteger('id');
      if (sub === 'delete') return i.editReply(prepareNotebookDelete(i.guildId, i.user.id, itemId));
      if (sub === 'config') {
        const kind = i.options.getString('type') as Kind;
        const channel = i.options.getChannel('salon');
        new ConfigRepository().upsert(i.guildId, notebookChannelKeys[kind], channel.id);
        return i.editReply(`Les fiches ${kinds[kind]} seront publiées dans <#${channel.id}>.`);
      }
      if (sub === 'voter') {
        const metadata = repo.metadata(i.guildId, itemId);
        if (!metadata) return i.editReply('Les votes sont disponibles sur les œuvres trouvées par la recherche.');
        const added = new RecommendationRepository().toggleCommandUpvote(metadata.id, i.user.id);
        return i.editReply(`🐧 Vote ${added ? 'ajouté' : 'retiré'} pour #${itemId}.`);
      }
      if (sub === 'export') return i.editReply({ content: '📒 Votre carnet complet, à conserver précieusement.', files: [new AttachmentBuilder(Buffer.from(JSON.stringify(repo.export(i.guildId), null, 2), 'utf8'), { name: 'nootos-carnet.json' })] });
      if (sub === 'ajouter') {
        const kind = i.options.getString('type') as Kind;
        const query = i.options.getString('recherche').trim();
        const details = i.options.getString('details') || '';
        const link = i.options.getString('lien');
        const author = i.member?.displayName || i.user.username;
        if (RECOMMENDATION_TYPES.includes(kind as RecommendationType) && !i.options.getBoolean('libre')) {
          const candidates = await getRecommendationProvider(kind as RecommendationType).search(link || query);
          if (!candidates.length) return i.editReply('Aucun résultat trouvé. Essaie un lien direct ou une recherche plus précise ; libre:true permet un ajout sans recherche.');
          const recommender = { id: i.user.id, name: author, avatarUrl: i.user.displayAvatarURL?.() };
          const token = storePending(client, i.guildId, i.user.id, candidates, recommender, { details, fallbackChannelId: i.channelId });
          if (candidates.length === 1) {
            const embed = buildRecommendationEmbed(candidates[0], recommender);
            if (details) embed.setDescription(details);
            return i.editReply({ content: 'Vérifie la fiche avant son ajout au carnet et sa publication.', embeds: [embed], components: [buildConfirmation(token)] });
          }
          return i.editReply({ content: 'Quelle œuvre veux-tu ajouter au carnet ?', components: [buildSelection(token, candidates)] });
        }
        const item = repo.add(i.guildId, i.user.id, { kind, title: query, details, url: link });
        try {
          const channelId = await publishFreeItem(client, item, author, i.channelId);
          return i.editReply({ content: `🐧 Fiche #${item.id} ajoutée au carnet et publiée dans <#${channelId}>.`, allowedMentions: { parse: [] } });
        } catch {
          return i.editReply(`La fiche #${item.id} est enregistrée dans le carnet, mais son message n’a pas pu être publié. Vérifie le salon et les permissions du bot. Ne refais pas l’ajout : la fiche est déjà conservée.`);
        }
      }
      if (sub === 'avis') {
        const date = i.options.getString('date') || today();
        repo.review(i.guildId, i.user.id, itemId, date, i.options.getNumber('note'), i.options.getString('retour') || '');
        return i.editReply(`🐧 Ton avis du ${date} est enregistré pour #${itemId}. Ton partenaire peut ajouter le sien avec /carnet avis.`);
      }
      if (sub === 'statut') { repo.status(i.guildId, itemId, i.options.getString('valeur')); return i.editReply(`🐧 Statut de #${itemId} mis à jour.`); }
      let embed = new EmbedBuilder().setColor(0x83d5e8).setFooter({ text: 'NOOT NOOOOT · votre petit monde à deux' });
      if (sub === 'fiche') {
        const item = repo.find(i.guildId, itemId);
        const metadata = repo.metadata(i.guildId, itemId);
        if (metadata) {
          const candidate = Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== null)) as unknown as RecommendationCandidate;
          embed = buildRecommendationEmbed(candidate, { id: metadata.recommendedById, name: metadata.recommendedByName });
          embed.addFields({ name: 'Vos votes', value: String(new RecommendationRepository().upvoteCount(metadata.id)), inline: true });
        }
        embed.setTitle(`#${item.id} · ${item.title}`).setDescription(`${kinds[item.kind as Kind]} · ${statuses[item.status as Status]}\n\n${item.details || 'Une envie à partager.'}`);
        if (item.url) embed.setURL(item.url);
        const reviews = repo.reviews(i.guildId, itemId);
        // Discord caps embeds at 6000 characters; newest eight reviews remain accessible in DB.
        for (const r of reviews.slice(0, 8)) embed.addFields({ name: `${r.date} · ${r.rating === null ? 'Sans note' : `${r.rating}/5`}`, value: `<@${r.userId}>\n${escapeMarkdown(r.comment).slice(0, 300) || 'Souvenir enregistré.'}` });
        if (!reviews.length) embed.addFields({ name: 'Votre journal', value: 'Ajoutez chacun votre ressenti avec /carnet avis.' });
      } else if (sub === 'hasard') {
        const candidates = [];
        for (let page = 1; ; page++) {
          const rows = repo.list(i.guildId, '', i.options.getString('type'), 'wishlist', page);
          candidates.push(...rows); if (rows.length < 15) break;
        }
        if (!candidates.length) return i.editReply('Votre liste d’envies est vide. Ajoutez-en avec /carnet ajouter 🐧');
        const item = candidates[Math.floor(Math.random() * candidates.length)];
        embed.setTitle(`Ce soir, pourquoi pas… ${item.title}`.slice(0, 256)).setDescription(`#${item.id} · ${kinds[item.kind as Kind]}\n${item.details || 'Une envie de votre carnet.'}`);
        if (item.url) embed.setURL(item.url);
      } else {
        const page = i.options.getInteger('page') || 1;
        const rows = repo.list(i.guildId, i.options.getString('recherche') || '', i.options.getString('type'), i.options.getString('statut'), page);
        embed.setTitle(`📒 Votre carnet · page ${page}`).setDescription(rows.map(x => `**#${x.id} · ${escapeMarkdown(x.title).slice(0, 120)}**\n${kinds[x.kind as Kind]} · ${statuses[x.status as Status]}`).join('\n\n') || 'Aucune fiche ici. Essayez une autre recherche ou /carnet ajouter.');
      }
      return i.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (e) { return i.editReply({ content: e instanceof ProviderError ? e.userMessage : e instanceof Error ? e.message : 'Impossible de consulter le carnet.', allowedMentions: { parse: [] } }); }
  },
};
