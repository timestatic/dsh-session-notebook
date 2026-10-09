import { randomUUID } from 'node:crypto';
import { notebookSchema } from './notebook-schema.js';
import { defaultTagColor } from './tag-colors.js';

const builtins = [
  { id: 'builtin_todo', name: 'TODO' },
  { id: 'builtin_important', name: '重要' },
  { id: 'builtin_verify', name: '待验证' },
];

// Call only after the Host has proved that its dedicated medium is absent.
// Reopening an existing Domain must use its stored Snapshot instead.
export function createInitialSnapshot({ epoch = randomUUID(), time = new Date().toISOString() } = {}) {
  const tags = Object.fromEntries(builtins.map(({ id, name }) => [id, {
    id, schemaVersion: 1, name, normalizedKey: name.normalize('NFKC').trim().toLowerCase(),
    isBuiltin: true, color: defaultTagColor(id), createdAt: time, updatedAt: time, version: 1,
  }]));
  return notebookSchema.parse({
    schemaVersion: 1, epoch, revision: 0, notes: {}, tags,
    settings: { quickTagIds: builtins.map(tag => tag.id), maxQuoteLength: 8000 },
    operationReceipts: {},
  });
}
