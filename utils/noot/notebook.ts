import { and, desc, eq, like } from 'drizzle-orm';
import { getDb, type AppDb } from '../db/client';
import { notebookItem, notebookReview, notebookPublication, nootConversation, recommendation, recommendationUpvote } from '../db/schema';

export const kinds = { movie: '🎬 Film', series: '📺 Série', game: '🎮 Jeu', date: '💕 Sortie / date', idea: '💡 Idée', music: '🎵 Musique', youtube: '📹 Vidéo' };
export const statuses = { wishlist: 'À faire', ongoing: 'En cours', done: 'Terminé' };
export type Kind = keyof typeof kinds;
export type Status = keyof typeof statuses;
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.NOOT_TIMEZONE || 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function validateDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Date invalide : utilise AAAA-MM-JJ.');
  return value;
}
function text(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Texte invalide (maximum ${max} caractères).`);
  return value.trim();
}

export class Notebook {
  constructor(private db: AppDb = getDb()) {}
  add(guildId: string, userId: string, values: { kind: string; title: string; details?: string; url?: string | null; sourceKey?: string }) {
    if (!Object.hasOwn(kinds, values.kind)) throw new Error('Catégorie inconnue.');
    const url = values.url ? text(values.url, 1000) : null;
    if (url && !/^https?:\/\//i.test(url)) throw new Error('Le lien doit commencer par https:// ou http://.');
    return this.db.insert(notebookItem).values({ guildId, createdBy: userId, kind: values.kind, title: text(values.title, 200, true), details: text(values.details || '', 2000), url, sourceKey: values.sourceKey }).returning().get();
  }
  find(guildId: string, id: number) {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Identifiant invalide.');
    const item = this.db.select().from(notebookItem).where(and(eq(notebookItem.guildId, guildId), eq(notebookItem.id, id))).get();
    if (!item) throw new Error('Fiche introuvable dans votre carnet.');
    return item;
  }
  linkedRecommendation(guildId: string, recommendationId: number) {
    return this.db.select().from(notebookItem).where(and(eq(notebookItem.guildId, guildId), eq(notebookItem.sourceKey, `reco:${recommendationId}`))).get();
  }
  metadata(guildId: string, id: number) {
    const item = this.find(guildId, id);
    if (!item.sourceKey?.startsWith('reco:')) return undefined;
    return this.db.select().from(recommendation).where(and(eq(recommendation.guildId, guildId), eq(recommendation.id, Number(item.sourceKey.slice(5))))).get();
  }
  trackPublication(guildId: string, id: number, channelId: string, messageId: string) {
    this.find(guildId, id);
    this.db.insert(notebookPublication).values({ itemId: id, channelId, messageId }).onConflictDoNothing().run();
  }
  publications(guildId: string, id: number) {
    this.find(guildId, id);
    const rows = this.db.select({ channelId: notebookPublication.channelId, messageId: notebookPublication.messageId }).from(notebookPublication).where(eq(notebookPublication.itemId, id)).all();
    const metadata = this.metadata(guildId, id);
    if (metadata?.messageId && !rows.some(x => x.channelId === metadata.channelId && x.messageId === metadata.messageId)) rows.push({ channelId: metadata.channelId, messageId: metadata.messageId });
    return rows;
  }
  delete(guildId: string, id: number) {
    return this.db.transaction(() => {
      const item = this.find(guildId, id);
      const metadata = this.metadata(guildId, id);
      this.db.delete(notebookReview).where(eq(notebookReview.itemId, id)).run();
      this.db.delete(notebookPublication).where(eq(notebookPublication.itemId, id)).run();
      this.db.delete(notebookItem).where(and(eq(notebookItem.guildId, guildId), eq(notebookItem.id, id))).run();
      if (metadata) {
        this.db.delete(recommendationUpvote).where(eq(recommendationUpvote.recommendationId, metadata.id)).run();
        this.db.delete(recommendation).where(and(eq(recommendation.guildId, guildId), eq(recommendation.id, metadata.id))).run();
      }
      return item;
    });
  }
  list(guildId: string, query = '', kind?: string | null, status?: string | null, page = 1) {
    if (!Number.isSafeInteger(page) || page < 1) throw new Error('Page invalide.');
    if (kind && !Object.hasOwn(kinds, kind)) throw new Error('Catégorie inconnue.');
    if (status && !Object.hasOwn(statuses, status)) throw new Error('Statut inconnu.');
    return this.db.select().from(notebookItem).where(and(eq(notebookItem.guildId, guildId), query ? like(notebookItem.title, `%${text(query, 200)}%`) : undefined,
      kind ? eq(notebookItem.kind, kind) : undefined, status ? eq(notebookItem.status, status) : undefined)).orderBy(desc(notebookItem.id)).limit(15).offset((page - 1) * 15).all();
  }
  reviews(guildId: string, id: number) {
    this.find(guildId, id);
    return this.db.select().from(notebookReview).where(eq(notebookReview.itemId, id)).orderBy(desc(notebookReview.date), desc(notebookReview.id)).limit(30).all();
  }
  review(guildId: string, userId: string, id: number, date: string, rating: number | null, comment: string) {
    this.find(guildId, id); validateDate(date);
    if (rating !== null && (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 0 || rating > 5)) throw new Error('La note doit être comprise entre 0 et 5.');
    const values = { itemId: id, userId, date, rating, comment: text(comment, 2000) };
    return this.db.insert(notebookReview).values(values).onConflictDoUpdate({ target: [notebookReview.itemId, notebookReview.userId, notebookReview.date], set: { rating, comment: values.comment } }).returning().get();
  }
  status(guildId: string, id: number, status: string) {
    this.find(guildId, id);
    if (!Object.hasOwn(statuses, status)) throw new Error('Statut inconnu.');
    return this.db.update(notebookItem).set({ status }).where(and(eq(notebookItem.guildId, guildId), eq(notebookItem.id, id))).returning().get();
  }
  export(guildId: string) {
    const items = this.db.select().from(notebookItem).where(eq(notebookItem.guildId, guildId)).orderBy(desc(notebookItem.id)).all();
    const reviews = this.db.select({ id: notebookReview.id, itemId: notebookReview.itemId, userId: notebookReview.userId, date: notebookReview.date, rating: notebookReview.rating, comment: notebookReview.comment, createdAt: notebookReview.createdAt }).from(notebookReview)
      .innerJoin(notebookItem, eq(notebookItem.id, notebookReview.itemId)).where(eq(notebookItem.guildId, guildId)).orderBy(desc(notebookReview.date)).all();
    return { version: 1, exportedAt: new Date().toISOString(), guildId, items, reviews };
  }
  syncRecommendations(guildId: string) {
    // Keep BobbyBot's existing records intact; import only missing catalogue links.
    this.db.transaction(() => {
      const linked = new Set(this.db.select({ key: notebookItem.sourceKey }).from(notebookItem).where(eq(notebookItem.guildId, guildId)).all().map(x => x.key));
      for (const r of this.db.select().from(recommendation).where(eq(recommendation.guildId, guildId)).all()) {
        const key = `reco:${r.id}`;
        if (!linked.has(key) && Object.hasOwn(kinds, r.type)) this.add(guildId, r.recommendedById, { kind: r.type, title: r.title, url: r.sourceUrl, sourceKey: key });
      }
    });
  }
  history(guildId: string, channelId: string, userId: string) {
    return this.db.select().from(nootConversation).where(and(eq(nootConversation.guildId, guildId), eq(nootConversation.channelId, channelId), eq(nootConversation.userId, userId))).orderBy(desc(nootConversation.id)).limit(12).all().reverse().map(x => ({ role: x.role, content: x.content }));
  }
  remember(guildId: string, channelId: string, userId: string, input: string, output: string) {
    this.db.transaction(() => {
      this.db.insert(nootConversation).values([{ guildId, channelId, userId, role: 'user', content: input }, { guildId, channelId, userId, role: 'assistant', content: output }]).run();
      const rows = this.db.select({ id: nootConversation.id }).from(nootConversation).where(and(eq(nootConversation.guildId, guildId), eq(nootConversation.channelId, channelId), eq(nootConversation.userId, userId))).orderBy(desc(nootConversation.id)).all();
      for (const row of rows.slice(12)) this.db.delete(nootConversation).where(eq(nootConversation.id, row.id)).run();
    });
  }
  forget(guildId: string, channelId: string, userId: string) {
    this.db.delete(nootConversation).where(and(eq(nootConversation.guildId, guildId), eq(nootConversation.channelId, channelId), eq(nootConversation.userId, userId))).run();
  }
}
