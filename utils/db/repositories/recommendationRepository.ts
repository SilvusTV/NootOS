import { and, count, countDistinct, desc, eq } from 'drizzle-orm';
import { getDb, type AppDb } from '../client';
import { recommendation, recommendationUpvote, type NewRecommendation, type Recommendation } from '../schema';

export class RecommendationRepository {
  constructor(private readonly db: AppDb = getDb()) {}

  create(values: NewRecommendation): Recommendation {
    return this.db.insert(recommendation).values(values).returning().get();
  }

  findDuplicate(guildId: string, type: string, externalId: string): Recommendation | undefined {
    return this.db
      .select()
      .from(recommendation)
      .where(
        and(
          eq(recommendation.guildId, guildId),
          eq(recommendation.type, type),
          eq(recommendation.externalId, externalId),
        ),
      )
      .get();
  }

  setMessageId(id: number, messageId: string): void {
    this.db.update(recommendation).set({ messageId }).where(eq(recommendation.id, id)).run();
  }

  findById(guildId: string, id: number): Recommendation | undefined {
    return this.db.select().from(recommendation).where(and(eq(recommendation.guildId, guildId), eq(recommendation.id, id))).get();
  }

  findByMessage(guildId: string, messageId: string): Recommendation | undefined {
    return this.db.select().from(recommendation).where(and(eq(recommendation.guildId, guildId), eq(recommendation.messageId, messageId))).get();
  }

  count(guildId: string, type?: string): number {
    const condition = type
      ? and(eq(recommendation.guildId, guildId), eq(recommendation.type, type))
      : eq(recommendation.guildId, guildId);
    return this.db.select({ value: count() }).from(recommendation).where(condition).get()?.value || 0;
  }

  delete(id: number): void {
    this.db.delete(recommendationUpvote).where(eq(recommendationUpvote.recommendationId, id)).run();
    this.db.delete(recommendation).where(eq(recommendation.id, id)).run();
  }

  addUpvote(recommendationId: number, userId: string, source: string): void {
    this.db.insert(recommendationUpvote).values({ recommendationId, userId, source }).onConflictDoNothing().run();
  }

  removeUpvote(recommendationId: number, userId: string, source: string): void {
    this.db.delete(recommendationUpvote).where(and(
      eq(recommendationUpvote.recommendationId, recommendationId),
      eq(recommendationUpvote.userId, userId),
      eq(recommendationUpvote.source, source),
    )).run();
  }

  toggleCommandUpvote(recommendationId: number, userId: string): boolean {
    const existing = this.db.select().from(recommendationUpvote).where(and(
      eq(recommendationUpvote.recommendationId, recommendationId),
      eq(recommendationUpvote.userId, userId),
      eq(recommendationUpvote.source, 'command'),
    )).get();
    if (existing) {
      this.removeUpvote(recommendationId, userId, 'command');
      return false;
    }
    this.addUpvote(recommendationId, userId, 'command');
    return true;
  }

  upvoteCount(recommendationId: number): number {
    return this.db.select({ value: countDistinct(recommendationUpvote.userId) })
      .from(recommendationUpvote)
      .where(eq(recommendationUpvote.recommendationId, recommendationId))
      .get()?.value || 0;
  }

  list(guildId: string, type?: string, limit = 25, offset = 0): Recommendation[] {
    const condition = type
      ? and(eq(recommendation.guildId, guildId), eq(recommendation.type, type))
      : eq(recommendation.guildId, guildId);
    return this.db
      .select()
      .from(recommendation)
      .where(condition)
      .orderBy(desc(recommendation.createdAt))
      .limit(limit)
      .offset(offset)
      .all();
  }
}
