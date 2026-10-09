import { notebookSchema } from './notebook-schema.js';

// Conservative preview defaults, not an approved storage quota or permission
// to enable writes. The final budget must be checked inside the Host's single
// mutation queue before handing a candidate to a verified Domain backend.
export const DEFAULT_PREVIEW_SNAPSHOT_BYTES = 1024 * 1024;
export const DEFAULT_PREVIEW_REQUEST_BYTES = 256 * 1024;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const limit = value => { if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_LIMIT'); };

// Refuse non-JSON values and unknown fields before measuring. Never truncate a
// user quote to fit, and never allow a cycle or getter to run through stringify.
export function measureSnapshotBytes(input, { maxBytes = DEFAULT_PREVIEW_SNAPSHOT_BYTES } = {}) {
  limit(maxBytes);
  const snapshot = notebookSchema.parse(input);
  const bytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
  if (bytes > maxBytes) fail('SNAPSHOT_LIMIT');
  return { snapshot, bytes };
}

// DTO admission still needs an operation-specific Schema and authentication.
// This preflight bounds raw JSON before deeper parsing and refuses values that
// JSON.stringify would silently omit or transform.
export function measureRequestBytes(input, { maxBytes = DEFAULT_PREVIEW_REQUEST_BYTES } = {}) {
  limit(maxBytes);
  const seen = new Set();
  function visit(value, depth = 0) {
    if (depth > 16) fail('VALIDATION_FAILED');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (!value || typeof value !== 'object' || seen.has(value)
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null
        && !Array.isArray(value))) fail('VALIDATION_FAILED');
    if (Array.isArray(value) && (Object.keys(value).length !== value.length
      || Reflect.ownKeys(value).some(key => key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key)
        || Number(key) >= value.length)))) fail('VALIDATION_FAILED');
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === 'length') continue;
      if (typeof key !== 'string') fail('VALIDATION_FAILED');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('VALIDATION_FAILED');
      visit(descriptor.value, depth + 1);
    }
    seen.delete(value);
  }
  visit(input);
  const bytes = Buffer.byteLength(JSON.stringify(input), 'utf8');
  if (bytes > maxBytes) fail('REQUEST_LIMIT');
  return bytes;
}
