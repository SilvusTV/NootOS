import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const config = sqliteTable(
  'config',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guildId: text('guild_id').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    guildKeyUnique: uniqueIndex('config_guild_key_unique').on(table.guildId, table.key),
  }),
);

export const customCommand = sqliteTable(
  'customCommand',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guildId: text('guild_id').notNull(),
    title: text('title').notNull(),
    command: text('command').notNull(),
    description: text('description').notNull(),
    response: text('response').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    guildCommandUnique: uniqueIndex('customCommand_guild_command_unique').on(table.guildId, table.command),
  }),
);

export const recommendation = sqliteTable(
  'recommendation',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guildId: text('guild_id').notNull(),
    type: text('type').notNull(),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    year: integer('year'),
    creator: text('creator'),
    durationSeconds: integer('duration_seconds'),
    releaseDate: text('release_date'),
    imageUrl: text('image_url'),
    sourceUrl: text('source_url').notNull(),
    price: text('price'),
    rating: text('rating'),
    recommendedById: text('recommended_by_id').notNull(),
    recommendedByName: text('recommended_by_name').notNull(),
    channelId: text('channel_id').notNull(),
    messageId: text('message_id'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    guildTypeExternalUnique: uniqueIndex('recommendation_guild_type_external_unique').on(
      table.guildId,
      table.type,
      table.externalId,
    ),
  }),
);

export const recommendationUpvote = sqliteTable(
  'recommendation_upvote',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    recommendationId: integer('recommendation_id').notNull().references(() => recommendation.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    source: text('source').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    recommendationUserSourceUnique: uniqueIndex('recommendation_upvote_recommendation_user_source_unique').on(
      table.recommendationId,
      table.userId,
      table.source,
    ),
  }),
);

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
export type CustomCommand = typeof customCommand.$inferSelect;
export type NewCustomCommand = typeof customCommand.$inferInsert;
export type Recommendation = typeof recommendation.$inferSelect;
export type NewRecommendation = typeof recommendation.$inferInsert;
export type RecommendationUpvote = typeof recommendationUpvote.$inferSelect;

export const notebookItem = sqliteTable('noot_item', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guildId: text('guild_id').notNull(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  details: text('details').notNull().default(''),
  url: text('url'),
  status: text('status').notNull().default('wishlist'),
  createdBy: text('created_by').notNull(),
  sourceKey: text('source_key'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, t => ({ sourceUnique: uniqueIndex('noot_item_source').on(t.guildId, t.sourceKey) }));

export const notebookReview = sqliteTable('noot_review', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: integer('item_id').notNull().references(() => notebookItem.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  date: text('date').notNull(),
  rating: real('rating'),
  comment: text('comment').notNull().default(''),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, t => ({ entryUnique: uniqueIndex('noot_review_entry').on(t.itemId, t.userId, t.date) }));

export const nootConversation = sqliteTable('noot_conversation', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guildId: text('guild_id').notNull(),
  channelId: text('channel_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
});

export type NotebookItem = typeof notebookItem.$inferSelect;

export const notebookPublication = sqliteTable('noot_publication', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: integer('item_id').notNull().references(() => notebookItem.id, { onDelete: 'cascade' }),
  channelId: text('channel_id').notNull(),
  messageId: text('message_id').notNull(),
}, t => ({ messageUnique: uniqueIndex('noot_publication_message').on(t.channelId, t.messageId) }));
