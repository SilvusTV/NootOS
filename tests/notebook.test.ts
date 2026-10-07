import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { closeDb, ensureDatabaseInitialized, RecommendationRepository } from '../utils/db';
import { Notebook, validateDate } from '../utils/noot/notebook';
import { askNoot, executeTool, transcribeAttachment } from '../utils/noot/assistant';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nootos-test-'));
process.env.DB_LOCATION = path.join(dir, 'test.db');
test.before(async () => { await ensureDatabaseInitialized(); });
test.after(() => {
  closeDb();
  if (path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(dir, { recursive: true, force: true });
});

test('two individual reviews, repeated viewings, same-day correction and fractional ratings persist', () => {
  const repo = new Notebook();
  const item = repo.add('couple', 'him', { kind: 'movie', title: 'Dune' });
  repo.review('couple', 'him', item.id, '2026-10-06', 4.5, 'Très beau');
  repo.review('couple', 'her', item.id, '2026-10-06', 3, 'Un peu long');
  repo.review('couple', 'him', item.id, '2026-10-07', 5, 'Encore mieux');
  repo.review('couple', 'him', item.id, '2026-10-06', 4, 'Avis corrigé');
  assert.equal(repo.reviews('couple', item.id).length, 3);
  assert.equal(repo.reviews('couple', item.id).find(x => x.userId === 'her')?.rating, 3);
  repo.review('couple', 'her', item.id, '2026-10-07', 3.5, 'Revu');
  assert.equal(repo.reviews('couple', item.id).find(x => x.userId === 'her' && x.date === '2026-10-07')?.rating, 3.5);
  assert.equal(repo.find('couple', item.id).status, 'wishlist');
  closeDb();
  assert.equal(new Notebook().reviews('couple', item.id).length, 4);
});

test('dates, kinds, URLs, ratings and cross-guild writes are validated', () => {
  const repo = new Notebook();
  const item = repo.add('isolation', 'him', { kind: 'date', title: 'Pique-nique', details: 'Au lac, budget 20 €' });
  assert.throws(() => validateDate('2026-02-30'));
  assert.equal(validateDate('2024-02-29'), '2024-02-29');
  assert.throws(() => repo.review('isolation', 'him', item.id, '2026-01-01', 7, ''));
  assert.throws(() => repo.add('isolation', 'him', { kind: 'constructor', title: 'Bad' }));
  assert.throws(() => repo.add('isolation', 'him', { kind: 'date', title: 'Bad', url: 'javascript:alert(1)' }));
  assert.throws(() => repo.status('another-guild', item.id, 'done'));
  assert.throws(() => repo.review('another-guild', 'him', item.id, '2026-01-01', 5, ''));
  assert.equal(repo.list('another-guild').length, 0);
  assert.equal(repo.find('isolation', item.id).status, 'wishlist');
  repo.status('isolation', item.id, 'done');
  assert.equal(repo.list('isolation', '', 'date', 'done').length, 1);
});

test('BobbyBot catalogue import is repeatable and preserves originals', async () => {
  const original = new RecommendationRepository().create({ guildId: 'legacy', type: 'game', externalId: 'steam-1', title: 'Portal 2', sourceUrl: 'https://store.steampowered.com/app/620/', recommendedById: 'her', recommendedByName: 'Elle', channelId: 'games' });
  const repo = new Notebook();
  repo.syncRecommendations('legacy');
  repo.syncRecommendations('legacy');
  await ensureDatabaseInitialized();
  assert.equal(repo.list('legacy').length, 1);
  assert.equal(repo.list('legacy')[0].sourceKey, `reco:${original.id}`);
  assert.equal(new RecommendationRepository().findById('legacy', original.id)?.title, 'Portal 2');
});

test('conversation memory is scoped and bounded; forgetting leaves the notebook intact', () => {
  const repo = new Notebook();
  repo.add('memory', 'him', { kind: 'idea', title: 'Souvenir' });
  for (let j = 0; j < 12; j++) repo.remember('memory', 'channel', 'him', `input ${j}`, `answer ${j}`);
  repo.remember('memory', 'channel', 'her', 'Bonjour', 'Noot');
  assert.equal(repo.history('memory', 'channel', 'him').length, 12);
  assert.equal(repo.history('memory', 'channel', 'him')[0].content, 'input 6');
  repo.forget('memory', 'channel', 'him');
  assert.equal(repo.history('memory', 'channel', 'him').length, 0);
  assert.equal(repo.history('memory', 'channel', 'her').length, 2);
  assert.equal(repo.list('memory').length, 1);
});

test('JSON export contains all reviews and no other guild data', () => {
  const repo = new Notebook();
  const item = repo.add('export', 'him', { kind: 'movie', title: 'Rewatch' });
  for (let d = 1; d <= 31; d++) repo.review('export', 'him', item.id, `2026-01-${String(d).padStart(2, '0')}`, 4, 'Souvenir');
  const result = repo.export('export');
  assert.equal(result.items.length, 1);
  assert.equal(result.reviews.length, 31);
});

test('assistant tools bind the current author instead of trusting model-supplied identity', () => {
  const repo = new Notebook();
  const item = repo.add('tools', 'him', { kind: 'movie', title: 'Film' });
  executeTool(repo, { guildId: 'tools', channelId: 'c', userId: 'her' }, 'save_review', { id: item.id, date: '2026-10-07', rating: 5, comment: 'Super', userId: 'him', guildId: 'other' });
  assert.equal(repo.reviews('tools', item.id)[0].userId, 'her');
  assert.throws(() => executeTool(repo, { guildId: 'tools', channelId: 'c', userId: 'her' }, 'sql', { query: 'DROP TABLE noot_item' }));
});

test('Responses tool loop records an idea, returns the tool result and remembers the answer', async (t) => {
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only';
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (_url: any, init: any) => {
    const request = JSON.parse(init.body);
    assert.equal(request.store, false);
    if (requests++ === 0) return new Response(JSON.stringify({ output: [{ type: 'function_call', name: 'add_item', call_id: 'call1', arguments: JSON.stringify({ kind: 'date', title: 'Balade au lac', details: 'Dimanche', url: null }) }] }));
    const output = request.input.find((x: any) => x.type === 'function_call_output');
    assert.equal(JSON.parse(output.output).title, 'Balade au lac');
    return new Response(JSON.stringify({ output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Noot ! Balade ajoutée.' }] }] }));
  });
  try {
    const scope = { guildId: 'api-test', channelId: 'c', userId: 'him' };
    assert.equal(await askNoot(scope, 'Ajoute une balade au lac'), 'Noot ! Balade ajoutée.');
    assert.equal(new Notebook().list(scope.guildId).length, 1);
    assert.equal(new Notebook().history(scope.guildId, 'c', 'him').length, 2);
  } finally { if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; }
});

test('a failure after a successful write reports partial completion instead of inviting blind retry', async (t) => {
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only';
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (requests++ === 0) return new Response(JSON.stringify({ output: [{ type: 'function_call', name: 'add_item', call_id: 'call2', arguments: JSON.stringify({ kind: 'idea', title: 'Soirée jeux', details: '', url: null }) }] }));
    return new Response('{}', { status: 429 });
  });
  try {
    await assert.rejects(askNoot({ guildId: 'partial', channelId: 'c', userId: 'him' }, 'Ajoute une soirée jeux'), /modifications ont été enregistrées/);
    assert.equal(new Notebook().list('partial').length, 1);
  } finally { if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; }
});

test('Discord OGG voice attachments are transcribed using multipart without a disk file', async (t) => {
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only';
  t.mock.method(globalThis, 'fetch', async (url: any, init: any) => {
    if (String(url).includes('cdn.discordapp.com')) return new Response(new Uint8Array([1, 2, 3]));
    assert.equal(init.body.get('file').name, 'voice-message.ogg');
    assert.equal(init.body.get('language'), 'fr');
    return new Response(JSON.stringify({ text: 'Ce film était magnifique.' }));
  });
  try {
    assert.equal(await transcribeAttachment({ url: 'https://cdn.discordapp.com/attachments/1/2/voice-message.ogg', size: 3, name: 'voice-message.ogg' }), 'Ce film était magnifique.');
    await assert.rejects(transcribeAttachment({ url: 'http://localhost/a.ogg', size: 3, name: 'a.ogg' }), /joint directement/);
    await assert.rejects(transcribeAttachment({ url: 'https://cdn.discordapp.com/a.ogg', size: 25 * 1024 * 1024, name: 'a.ogg' }), /moins de 24 Mo/);
  } finally { if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; }
});
