import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { closeDb, ensureDatabaseInitialized, RecommendationRepository } from '../utils/db';
import { Notebook } from '../utils/noot/notebook';
import { prepareNotebookDelete, handleNotebookDeleteComponent } from '../utils/noot/delete';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noot-delete-test-'));
process.env.DB_LOCATION = path.join(dir, 'test.db');
test.before(async () => { await ensureDatabaseInitialized(); });
test.after(() => { closeDb(); if (path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(dir, { recursive: true, force: true }); });
function confirmation(guildId: string, itemId: number) {
  const preview = prepareNotebookDelete(guildId, 'him', itemId);
  const replies: any[] = [];
  const data = preview.components[0].components[0].data as { custom_id: string };
  return { customId: data.custom_id, guildId, user: { id: 'him' }, replies,
    deferUpdate: async () => {}, editReply: async (value: any) => { replies.push(value); }, update: async (value: any) => { replies.push(value); }, reply: async (value: any) => { replies.push(value); } };
}

test('deleting a linked work removes all reviews, votes and the source so sync cannot recreate it', async () => {
  const recs = new RecommendationRepository();
  const r = recs.create({ guildId: 'delete-media', type: 'movie', externalId: 'dune', title: 'Dune', sourceUrl: 'https://example.com', recommendedById: 'her', recommendedByName: 'Her', channelId: 'films', messageId: 'film-message' });
  recs.addUpvote(r.id, 'him', 'command');
  const repo = new Notebook(); repo.syncRecommendations('delete-media');
  const item = repo.list('delete-media')[0];
  repo.review('delete-media', 'him', item.id, '2026-10-07', 4, 'Bien');
  repo.review('delete-media', 'her', item.id, '2026-10-07', 5, 'Super');
  let deleted = 0;
  const client = { channels: { fetch: async (id: string) => {
    assert.equal(id, 'films'); return { guildId: 'delete-media', messages: { fetch: async (id: string) => { assert.equal(id, 'film-message'); return { delete: async () => { deleted++; } }; } } };
  } } };
  const i = confirmation('delete-media', item.id);
  await handleNotebookDeleteComponent(client, i);
  assert.equal(deleted, 1);
  assert.equal(repo.export('delete-media').reviews.length, 0);
  assert.equal(recs.upvoteCount(r.id), 0);
  assert.equal(recs.findById('delete-media', r.id), undefined);
  repo.syncRecommendations('delete-media');
  assert.equal(repo.list('delete-media').length, 0);
  assert.match(i.replies[0].content, /supprimée/);
});

test('free publication is removed even after changing the configured room', async () => {
  const repo = new Notebook();
  const item = repo.add('delete-free', 'her', { kind: 'date', title: 'Balade' });
  repo.trackPublication('delete-free', item.id, 'original-room', 'original-message');
  let removed = false;
  const client = { channels: { fetch: async (id: string) => { assert.equal(id, 'original-room'); return { guildId: 'delete-free', messages: { fetch: async (id: string) => { assert.equal(id, 'original-message'); return { delete: async () => { removed = true; } }; } } }; } } };
  await handleNotebookDeleteComponent(client, confirmation('delete-free', item.id));
  assert.equal(removed, true);
  assert.throws(() => repo.find('delete-free', item.id));
});

test('cancellation and another member’s click leave the item intact', async () => {
  const repo = new Notebook(); const item = repo.add('cancel', 'him', { kind: 'idea', title: 'Jeux' });
  const i = confirmation('cancel', item.id);
  await handleNotebookDeleteComponent({}, { ...i, user: { id: 'her' } });
  assert.match(i.replies[0].content, /ne t’appartient pas/);
  await handleNotebookDeleteComponent({}, { ...i, customId: i.customId.replace(':confirm:', ':cancel:') });
  assert.equal(repo.find('cancel', item.id).title, 'Jeux');
  assert.throws(() => repo.delete('other-guild', item.id));
});

test('missing Discord messages are tolerated; denied permissions preserve the data and allow retry', async () => {
  const repo = new Notebook(); const item = repo.add('retry-delete', 'him', { kind: 'idea', title: 'Soirée' });
  repo.review('retry-delete', 'her', item.id, '2026-10-07', 5, 'Oui');
  repo.trackPublication('retry-delete', item.id, 'room', 'message');
  let code = 50013;
  const client = { channels: { fetch: async () => ({ guildId: 'retry-delete', messages: { fetch: async () => { throw { code }; } } }) } };
  const i = confirmation('retry-delete', item.id);
  await handleNotebookDeleteComponent(client, i);
  assert.equal(repo.reviews('retry-delete', item.id).length, 1);
  assert.match(i.replies[0].content, /restent dans le carnet/);
  code = 10008;
  await handleNotebookDeleteComponent(client, i);
  assert.throws(() => repo.find('retry-delete', item.id));
});
