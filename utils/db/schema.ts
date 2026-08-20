import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
export type CustomCommand = typeof customCommand.$inferSelect;
export type NewCustomCommand = typeof customCommand.$inferInsert;
export type Recommendation = typeof recommendation.$inferSelect;
export type NewRecommendation = typeof recommendation.$inferInsert;
