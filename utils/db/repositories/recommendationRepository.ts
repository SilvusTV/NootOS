import { and, desc, eq } from 'drizzle-orm';
import { getDb, type AppDb } from '../client';
import { recommendation, type NewRecommendation, type Recommendation } from '../schema';

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
