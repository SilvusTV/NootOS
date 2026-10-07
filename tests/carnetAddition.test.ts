import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import carnet = require('../commands/noot/carnet');
import CommandUtil from '../utils/handlers/CommandUtil';
import { Collection } from 'discord.js';
import { closeDb, ensureDatabaseInitialized, ConfigRepository, CONFIG_KEYS, RecommendationRepository } from '../utils/db';
import { Notebook } from '../utils/noot/notebook';
import { handleRecommendationComponent } from '../utils/recommendations/discord';
import { TmdbProvider } from '../utils/recommendations/tmdb';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noot-add-test-'));
process.env.DB_LOCATION = path.join(dir, 'bot.db');
test.before(async () => { await ensureDatabaseInitialized(); });
test.after(() => { closeDb(); if (path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(dir, { recursive: true, force: true }); });
function interaction(guildId: string, values: Record<string, any>) {
  const replies: any[] = [];
  return {
    guildId, channelId: 'fallback', user: { id: 'him', username: 'Him', displayAvatarURL: () => undefined },
    options: { getSubcommand: () => 'ajouter', getString: (key: string) => values[key] ?? null, getInteger: () => null, getBoolean: (key: string) => values[key] ?? null },
    deferReply: async (_options?: any) => {}, editReply: async (value: any) => { replies.push(value); }, replies,
  };
}
const candidate = { type: 'movie' as const, externalId: '123', title: 'Dune', year: 2021, imageUrl: 'https://example.com/dune.jpg', sourceUrl: 'https://www.themoviedb.org/movie/123' };

test('carnet name/link search publishes exactly one linked notebook item with metadata and details', async (t) => {
  t.mock.method(TmdbProvider.prototype, 'search', async (query: string) => { assert.equal(query, 'https://www.imdb.com/title/tt1160419/'); return [candidate]; });
  const posts: any[] = [];
  const client: any = { channels: { fetch: async (id: string) => ({ guildId: 'add', isTextBased: () => true, send: async (value: any) => { posts.push(value); return { id: 'published' }; } }) } };
  new ConfigRepository().upsert('add', CONFIG_KEYS.recoChannelMovie, 'films');
  const i = interaction('add', { type: 'movie', recherche: 'Dune', lien: 'https://www.imdb.com/title/tt1160419/', details: 'Pour samedi soir' });
  await carnet.runInteraction(client, i);
  assert.equal(posts.length, 0, 'selection is a preview until confirmed');
  const token = i.replies[0].components[0].components[0].data.custom_id.split(':')[2];
  const confirmations: any[] = [];
  const confirm = { customId: `reco:confirm:${token}`, guildId: 'add', user: i.user, deferUpdate: async () => {}, editReply: async (v: any) => { confirmations.push(v); }, reply: async () => {} };
  await handleRecommendationComponent(client, confirm);
  const repo = new Notebook();
  const item = repo.list('add')[0];
  assert.equal(repo.list('add').length, 1);
  assert.equal(item.details, 'Pour samedi soir');
  assert.equal(repo.metadata('add', item.id)?.year, 2021);
  assert.equal(repo.metadata('add', item.id)?.messageId, 'published');
  assert.match(posts[0].embeds[0].data.title, new RegExp(`#${item.id}`));
  assert.equal(posts[0].embeds[0].data.thumbnail.url, candidate.imageUrl);
  assert.match(confirmations[0].content, /ajoutée au carnet/);
  await carnet.runInteraction(client, interaction('add', { type: 'movie', recherche: 'Dune', lien: 'https://www.imdb.com/title/tt1160419/' }));
  const duplicateToken = [...client.pendingRecommendations.keys()][0];
  await handleRecommendationComponent(client, { ...confirm, customId: `reco:confirm:${duplicateToken}` });
  assert.equal(posts.length, 1);
  assert.equal(repo.list('add').length, 1);
  assert.match(confirmations[1].content, /déjà dans le carnet/);
});

test('free date addition publishes to its configured room; failed send still reports the saved item', async () => {
  new ConfigRepository().upsert('date-add', CONFIG_KEYS.carnetChannelDate, 'dates');
  const posts: any[] = [];
  const client: any = { channels: { fetch: async (id: string) => { assert.equal(id, 'dates'); return { guildId: 'date-add', isTextBased: () => true, send: async (v: any) => { posts.push(v); return { id: 'date-message' }; } }; } } };
  const i = interaction('date-add', { type: 'date', recherche: 'Pique-nique', details: 'Au lac, 20 €' });
  await carnet.runInteraction(client, i);
  assert.equal(posts.length, 1);
  assert.equal(new Notebook().list('date-add')[0].details, 'Au lac, 20 €');
  const failed = interaction('free-failed', { type: 'idea', recherche: 'Soirée jeux' });
  await carnet.runInteraction({ channels: { fetch: async () => { throw new Error('Permission'); } } }, failed);
  assert.equal(new Notebook().list('free-failed').length, 1);
  assert.match(failed.replies[0], /enregistrée.*n’a pas pu être publié/);
});

test('failed media publication releases its reservation and lets the same selection retry', async (t) => {
  t.mock.method(TmdbProvider.prototype, 'search', async () => [candidate]);
  let fail = true;
  const client: any = { channels: { fetch: async () => ({ guildId: 'retry', isTextBased: () => true, send: async () => { if (fail) throw new Error('Missing permissions'); return { id: 'ok' }; } }) } };
  const i = interaction('retry', { type: 'movie', recherche: 'Dune' });
  await carnet.runInteraction(client, i);
  const token = [...client.pendingRecommendations.keys()][0];
  const confirm = { customId: `reco:confirm:${token}`, guildId: 'retry', user: i.user, deferUpdate: async () => {}, editReply: async () => {}, reply: async () => {} };
  await handleRecommendationComponent(client, confirm);
  assert.equal(new Notebook().list('retry').length, 0);
  assert.equal(new RecommendationRepository().list('retry').length, 0);
  fail = false;
  await handleRecommendationComponent(client, confirm);
  assert.equal(new Notebook().list('retry').length, 1);
});

test('NootOS exposes only carnet commands instead of parallel reco commands', async () => {
  const client: any = { commands: new Collection() };
  await CommandUtil(client);
  assert.equal(client.commands.has('carnet'), true);
  for (const name of ['reco', 'recos', 'recoconfig', 'supprimerreco', 'upvotereco']) assert.equal(client.commands.has(name), false);
});
