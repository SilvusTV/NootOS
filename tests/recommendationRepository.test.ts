import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { closeDb, ensureDatabaseInitialized, RecommendationRepository } from '../utils/db';

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bobbybot-test-'));
process.env.DB_LOCATION = path.join(testDir, 'bot.db');

test('RecommendationRepository stores, detects and lists recommendations', async () => {
  await ensureDatabaseInitialized();
  const repository = new RecommendationRepository();
  const created = repository.create({
    guildId: 'guild-1', type: 'music', externalId: 'video-1', title: 'A Song', year: 2026,
    creator: 'An Artist', sourceUrl: 'https://youtube.com/watch?v=video-1', recommendedById: 'user-1',
    recommendedByName: 'Bobby', channelId: 'channel-1',
  });

  assert.equal(created.title, 'A Song');
  assert.equal(repository.findDuplicate('guild-1', 'music', 'video-1')?.id, created.id);
  assert.equal(repository.findDuplicate('guild-2', 'music', 'video-1'), undefined);
  assert.deepEqual(repository.list('guild-1', 'music').map((row) => row.title), ['A Song']);

  repository.addUpvote(created.id, 'user-2', 'command');
  repository.addUpvote(created.id, 'user-2', 'reaction:⬆️');
  repository.addUpvote(created.id, 'user-3', 'reaction:➕');
  assert.equal(repository.upvoteCount(created.id), 2, 'a member must only count once across vote sources');
  repository.removeUpvote(created.id, 'user-2', 'reaction:⬆️');
  assert.equal(repository.upvoteCount(created.id), 2, 'the command vote remains active');

  repository.delete(created.id);
  assert.equal(repository.findById('guild-1', created.id), undefined);
  assert.equal(repository.upvoteCount(created.id), 0);
});

test.after(() => {
  closeDb();
  const resolved = path.resolve(testDir);
  if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(resolved, { recursive: true, force: true });
});
