import { createHash } from 'node:crypto';
import { snapshotCoordinator } from './snapshot-coordinator.js';
import { notebookSchema } from './notebook-schema.js';
import { createNote, changeNotes, previewNoteChange, permanentlyDeleteNotes } from './note-domain.js';
import { tagUsage, previewTagChange, createTag, createTaggedNote, renameTag, mergeTags, deleteTag } from './tag-domain.js';
import { queryNotes } from './query.js';
import { backupJson, previewBackupReplacement } from './json-backup.js';
import { restoreUpload } from './restore-upload.js';
import { exportMarkdown } from './markdown-export.js';
import { measureRequestBytes, measureSnapshotBytes, DEFAULT_PREVIEW_SNAPSHOT_BYTES } from './snapshot-budget.js';
import { prepareBackupReplacement } from './restore-candidate.js';
import { resolvedTagColor } from './tag-colors.js';

// Unmounted Step 3A business slice. A verified single-Host Domain owner must
// supply the handle; importing this module never opens storage or registers a route.
const fail = code => { throw Object.assign(new Error(code), { code }); };
const keys = (value, allowed, required) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !allowed.includes(key))
    || required.some(key => !Object.hasOwn(value, key))) fail('VALIDATION_FAILED');
  measureRequestBytes(value);
};
const safe = error => {
  if (['VALIDATION_FAILED', 'VERSION_CONFLICT', 'EPOCH_CONFLICT', 'COMMIT_UNKNOWN',
    'READ_UNAVAILABLE', 'SNAPSHOT_LIMIT', 'REQUEST_LIMIT', 'RECEIPT_LIMIT',
    'REQUEST_ID_REUSED', 'CLOSED', 'NAME_CONFLICT', 'CONFIRM_REQUIRED',
    'UPLOAD_BUSY', 'UPLOAD_NOT_FOUND', 'UPLOAD_CONFLICT', 'UPLOAD_INCOMPLETE',
    'INVALID_BACKUP', 'UNSUPPORTED_BACKUP', 'BACKUP_TOO_LARGE',
    'SESSION_ACTIVITY_UNAVAILABLE'].includes(error?.code)) return error;
  return Object.assign(new Error('VALIDATION_FAILED'), { code: 'VALIDATION_FAILED' });
};
const validate = value => notebookSchema.parse(value);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const noteId = (epoch, requestId) => `manual_${createHash('sha256')
  .update(`${epoch}\0${requestId}`).digest('hex').slice(0, 32)}`;
const tagId = (epoch, requestId) => `tag_${createHash('sha256')
  .update(`${epoch}\0${requestId}`).digest('hex').slice(0, 32)}`;
const confirmed = (current, action, intent) => {
  const preview = previewTagChange(current, { action, sourceId: intent.sourceId, targetId: intent.targetId });
  if (!intent.preview || typeof intent.preview !== 'object' || Array.isArray(intent.preview)
    || Object.keys(intent.preview).length !== Object.keys(preview).length
    || Object.entries(preview).some(([key, value]) => intent.preview[key] !== value)) fail('CONFIRM_REQUIRED');
};
const confirmedNotes = (current, intent) => {
  const supplied = intent.preview;
  if (!supplied || !Array.isArray(supplied.entries) || supplied.confirmed !== undefined
    || supplied.action !== intent.action || supplied.count !== supplied.entries.length) fail('CONFIRM_REQUIRED');
  const fresh = previewNoteChange(current, intent.action, supplied.entries.map(entry => entry?.id));
  if (Object.keys(supplied).length !== Object.keys(fresh).length
    || Object.entries(fresh).some(([key, value]) => key !== 'entries' && supplied[key] !== value)
    || fresh.entries.some((entry, index) => {
      const seen = supplied.entries[index];
      return !seen || typeof seen !== 'object' || Array.isArray(seen)
        || Object.keys(seen).length !== Object.keys(entry).length
        || Object.entries(entry).some(([key, value]) => seen[key] !== value);
    })) fail('CONFIRM_REQUIRED');
  return fresh;
};

export function manualNotebookService({ domain, now = () => new Date().toISOString(), ...limits }) {
  const store = snapshotCoordinator({ domain, ...limits });
  const uploads = restoreUpload();
  return {
    anchors(request) {
      try {
        keys(request, ['sessionId', 'offset', 'limit'], ['sessionId']);
        const { sessionId, offset = 0, limit = 50 } = request;
        if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 4096
          || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit)
          || limit < 1 || limit > 50) fail('VALIDATION_FAILED');
        const current = store.read();
        const notes = Object.values(current.notes).filter(note => !note.deletedAt && note.anchor
          && note.source?.sessionId === sessionId && ['note', 'highlight'].includes(note.kind));
        return { epoch: current.epoch, revision: current.revision, total: notes.length,
          items: notes.slice(offset, offset + limit).map(note => ({ id: note.id, kind: note.kind,
            anchor: note.anchor, source: { sessionId } })) };
      } catch (error) { throw safe(error); }
    },
    excerpt(request) {
      try {
        keys(request, ['requestId', 'epoch', 'expectedRevision', 'kind', 'bodyMarkdown',
          'quote', 'anchor', 'source', 'tagIds', 'newTagName'],
        ['requestId', 'epoch', 'expectedRevision', 'kind', 'quote', 'anchor', 'source', 'tagIds']);
        keys(request.quote, ['format', 'content'], ['format', 'content']);
        keys(request.anchor, ['exact', 'prefix', 'suffix', 'startOffset', 'endOffset'], ['exact']);
        keys(request.source, ['sessionId', 'sessionTitle', 'workspacePath', 'workspaceTitle'], ['sessionId']);
        if (!['highlight', 'note'].includes(request.kind) || request.quote.format !== 'plain_text'
          || typeof request.quote.content !== 'string' || request.anchor.exact !== request.quote.content
          || typeof request.source.sessionId !== 'string' || !request.source.sessionId.trim()
          || (request.kind === 'highlight' && Object.hasOwn(request, 'bodyMarkdown')))
          fail('VALIDATION_FAILED');
        const intentWithId = { ...request, id: noteId(request.epoch, request.requestId) };
        if (Object.hasOwn(request, 'newTagName') && (typeof request.newTagName !== 'string' || !request.newTagName.trim())) fail('VALIDATION_FAILED');
        return store.mutate(intentWithId, (current, intent) => {
          const draft = { kind: intent.kind, tagIds: intent.tagIds, ...(intent.kind === 'note' ? { bodyMarkdown: intent.bodyMarkdown } : {}) };
          const provenance = { quote: intent.quote, anchor: intent.anchor, source: intent.source };
          if (Object.hasOwn(intent, 'newTagName')) return createTaggedNote(current, draft, {
            tagId: `tag_${createHash('sha256').update(intent.epoch + ':' + intent.requestId).digest('hex').slice(0, 32)}`,
            tagName: intent.newTagName, noteId: intent.id, time: now(), expectedRevision: intent.expectedRevision, provenance,
          }, validate);
          return createNote(current, {
          kind: intent.kind, tagIds: intent.tagIds,
          ...(intent.kind === 'note' ? { bodyMarkdown: intent.bodyMarkdown } : {}),
        }, { id: intent.id, time: now(), expectedRevision: intent.expectedRevision,
          // Client text anchors carry no claim of official message identity.
          provenance }, validate);
        });
      } catch (error) { return Promise.reject(safe(error)); }
    },
    backupBegin(actor, request) {
      try {
        keys(request, ['uploadId', 'bytes'], ['uploadId', 'bytes']);
        return uploads.begin({ actor, ...request });
      } catch (error) { throw safe(error); }
    },
    backupChunk(actor, request) {
      try {
        keys(request, ['token', 'index', 'base64'], ['token', 'index', 'base64']);
        return uploads.append({ actor, ...request });
      } catch (error) { throw safe(error); }
    },
    backupFinish(actor, request) {
      try {
        keys(request, ['token'], ['token']);
        return uploads.finish({ actor, ...request });
      } catch (error) { throw safe(error); }
    },
    backupPreview(actor, request) {
      try {
        keys(request, ['token'], ['token']);
        const current = store.read();
        const imported = uploads.candidate({ actor, ...request });
        // Reserve the maximum supported epoch length. This is a conservative
        // preflight; the actual replacement must be measured again at commit.
        const newEpoch = ['0', '1', '2'].map(value => value.repeat(128))
          .find(value => value !== current.epoch && value !== imported.snapshot.epoch);
        const candidate = prepareBackupReplacement(current, imported, { newEpoch });
        const bytes = typeof domain.estimateBytes === 'function' ? domain.estimateBytes(candidate)
          : measureSnapshotBytes(candidate, { maxBytes: Number.MAX_SAFE_INTEGER }).bytes;
        const limitBytes = limits.maxSnapshotBytes ?? DEFAULT_PREVIEW_SNAPSHOT_BYTES;
        return { token: request.token, ...previewBackupReplacement(current, imported),
          capacity: { estimatedBytes: bytes, limitBytes, fits: bytes <= limitBytes } };
      } catch (error) { throw safe(error); }
    },
    backupCancel(actor, request) {
      try {
        keys(request, ['token', 'uploadId'], []);
        uploads.cancel({ actor, ...request });
        return { cancelled: true };
      } catch (error) { throw safe(error); }
    },
    list(filter = {}) {
      try {
        keys(filter, ['search', 'offset', 'limit'], []);
        const snapshot = store.read();
        const { pageIds, total, ids } = queryNotes(snapshot, { kind: 'manual', ...filter });
        return { epoch: snapshot.epoch, revision: snapshot.revision, total, ids,
          items: pageIds.map(id => {
            const { title, bodyMarkdown, version, updatedAt } = snapshot.notes[id];
            return { id, title: title ?? '', excerpt: bodyMarkdown.slice(0, 240), version, updatedAt };
          }) };
      } catch (error) { throw safe(error); }
    },
    library(filter = {}) {
      try {
        keys(filter, ['scope', 'sessionId', 'workspacePath', 'kind', 'tagIds', 'tagMode',
          'untagged', 'search', 'includeDeleted', 'trashOnly', 'timeField', 'from', 'to',
          'sort', 'sessionActivity', 'offset', 'limit', 'selectedIds'], []);
        const snapshot = store.read();
        const match = queryNotes(snapshot, filter);
        return { epoch: snapshot.epoch, revision: snapshot.revision, ...match,
          tags: Object.values(snapshot.tags).filter(tag => !tag.deletedAt)
            .map(tag => ({ id: tag.id, name: tag.name,
              color: resolvedTagColor(tag.color, tag.id), ...tagUsage(snapshot, tag.id) }))
            .sort((a, b) => compare(a.name.normalize('NFKC'), b.name.normalize('NFKC')) || compare(a.id, b.id)),
          items: match.pageIds.map(id => {
            const note = snapshot.notes[id];
            const excerpt = note.bodyMarkdown ?? note.quote?.content ?? '';
            return { id, kind: note.kind, title: note.title ?? '',
              excerpt: [...excerpt].slice(0, 240).join(''),
              quoteFormat: note.quote?.format ?? null,
              quoteExcerpt: [...(note.quote?.content ?? '')].slice(0, 240).join(''), tagIds: note.tagIds,
              source: note.source ?? null, createdAt: note.createdAt, updatedAt: note.updatedAt,
              deletedAt: note.deletedAt ?? null, version: note.version };
          }) };
      } catch (error) { throw safe(error); }
    },
    tagList() {
      try {
        const snapshot = store.read();
        return { epoch: snapshot.epoch, revision: snapshot.revision,
          items: Object.values(snapshot.tags).filter(tag => !tag.deletedAt)
            .map(tag => ({ id: tag.id, name: tag.name, version: tag.version,
              isBuiltin: tag.isBuiltin === true,
              isQuickTag: snapshot.settings.quickTagIds.includes(tag.id),
              color: resolvedTagColor(tag.color, tag.id), ...tagUsage(snapshot, tag.id) }))
            .sort((a, b) => compare(a.name.normalize('NFKC'), b.name.normalize('NFKC')) || compare(a.id, b.id)) };
      } catch (error) { throw safe(error); }
    },
    tagPreview(request) {
      try {
        keys(request, ['action', 'sourceId', 'targetId'], ['action', 'sourceId']);
        return previewTagChange(store.read(), request);
      } catch (error) { throw safe(error); }
    },
    tagCreate(request) {
      try {
        keys(request, ['requestId', 'epoch', 'expectedRevision', 'name', 'color'],
          ['requestId', 'epoch', 'expectedRevision', 'name']);
        return store.mutate(request, (current, intent) => createTag(current,
          { id: tagId(intent.epoch, intent.requestId), name: intent.name, color: intent.color,
            expectedRevision: intent.expectedRevision, time: now() }, validate));
      } catch (error) { return Promise.reject(safe(error)); }
    },
    tagRename(request) {
      try {
        keys(request, ['requestId', 'epoch', 'expectedRevision', 'tagId', 'expectedVersion', 'name', 'color'],
          ['requestId', 'epoch', 'expectedRevision', 'tagId', 'expectedVersion', 'name']);
        return store.mutate(request, (current, intent) => renameTag(current,
          { id: intent.tagId, name: intent.name, color: intent.color, expectedRevision: intent.expectedRevision,
            expectedVersion: intent.expectedVersion, time: now() }, validate));
      } catch (error) { return Promise.reject(safe(error)); }
    },
    tagMerge(request) {
      try {
        keys(request, ['requestId', 'epoch', 'expectedRevision', 'sourceId', 'targetId', 'preview'],
          ['requestId', 'epoch', 'expectedRevision', 'sourceId', 'targetId', 'preview']);
        return store.mutate(request, (current, intent) => {
          confirmed(current, 'merge', intent);
          return mergeTags(current, { sourceId: intent.sourceId, targetId: intent.targetId,
            expectedRevision: intent.expectedRevision, time: now() }, validate);
        });
      } catch (error) { return Promise.reject(safe(error)); }
    },
    tagDelete(request) {
      try {
        keys(request, ['requestId', 'epoch', 'expectedRevision', 'sourceId', 'preview'],
          ['requestId', 'epoch', 'expectedRevision', 'sourceId', 'preview']);
        return store.mutate(request, (current, intent) => {
          confirmed(current, 'delete', intent);
          return deleteTag(current, { id: intent.sourceId,
            expectedRevision: intent.expectedRevision, time: now() }, validate);
        });
      } catch (error) { return Promise.reject(safe(error)); }
    },
    notePreview(request) {
      try {
        keys(request, ['action', 'ids'], ['action', 'ids']);
        return previewNoteChange(store.read(), request.action, request.ids);
      } catch (error) { throw safe(error); }
    },
    noteApply(request) {
      try {
        keys(request, ['requestId', 'epoch', 'expectedRevision', 'action', 'preview', 'confirmed'],
          ['requestId', 'epoch', 'expectedRevision', 'action', 'preview', 'confirmed']);
        if (request.confirmed !== true) fail('CONFIRM_REQUIRED');
        return store.mutate(request, (current, intent) => {
          const fresh = confirmedNotes(current, intent);
          if (intent.action === 'purge')
            return permanentlyDeleteNotes(current, fresh, { confirmed: true }, validate);
          return changeNotes(current, { expectedRevision: intent.expectedRevision, time: now(),
            changes: fresh.entries.map(entry => ({ id: entry.id, expectedVersion: entry.version,
              action: intent.action })) }, validate);
        });
      } catch (error) { return Promise.reject(safe(error)); }
    },
    noteGet(id) {
      try {
        if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)
          || ['__proto__', 'constructor', 'prototype'].includes(id)) fail('VALIDATION_FAILED');
        const snapshot = store.read();
        const note = Object.hasOwn(snapshot.notes, id) ? snapshot.notes[id] : undefined;
        return note ? { epoch: snapshot.epoch, revision: snapshot.revision, note } : null;
      } catch (error) { throw safe(error); }
    },
    noteEdit(request) {
      try {
        keys(request, ['requestId', 'epoch', 'expectedRevision', 'id', 'expectedVersion',
          'title', 'bodyMarkdown', 'tagIds'],
        ['requestId', 'epoch', 'expectedRevision', 'id', 'expectedVersion']);
        if (!['title', 'bodyMarkdown', 'tagIds'].some(field => Object.hasOwn(request, field)))
          fail('VALIDATION_FAILED');
        return store.mutate(request, (current, intent) => changeNotes(current, {
          expectedRevision: intent.expectedRevision, time: now(), changes: [{
            id: intent.id, action: 'edit', expectedVersion: intent.expectedVersion,
            ...(Object.hasOwn(intent, 'title') ? { title: intent.title } : {}),
            ...(Object.hasOwn(intent, 'bodyMarkdown') ? { bodyMarkdown: intent.bodyMarkdown } : {}),
            ...(Object.hasOwn(intent, 'tagIds') ? { tagIds: intent.tagIds } : {}),
          }],
        }, validate));
      } catch (error) { return Promise.reject(safe(error)); }
    },
    noteConvert(request) {
      try {
        keys(request, ['requestId', 'epoch', 'expectedRevision', 'id', 'expectedVersion',
          'kind', 'bodyMarkdown', 'confirmRemoveBody'],
        ['requestId', 'epoch', 'expectedRevision', 'id', 'expectedVersion', 'kind']);
        if (request.kind === 'highlight' ? Object.hasOwn(request, 'bodyMarkdown')
          : !Object.hasOwn(request, 'bodyMarkdown') || Object.hasOwn(request, 'confirmRemoveBody'))
          fail('VALIDATION_FAILED');
        return store.mutate(request, (current, intent) => {
          const note = Object.hasOwn(current.notes, intent.id) ? current.notes[intent.id] : undefined;
          if (!note || note.kind === intent.kind) fail('VALIDATION_FAILED');
          return changeNotes(current, { expectedRevision: intent.expectedRevision, time: now(), changes: [{
            id: intent.id, action: 'convert', expectedVersion: intent.expectedVersion,
            kind: intent.kind,
            ...(intent.kind === 'highlight'
              ? { confirmRemoveBody: intent.confirmRemoveBody === true }
              : { bodyMarkdown: intent.bodyMarkdown }),
          }] }, validate);
        });
      } catch (error) { return Promise.reject(safe(error)); }
    },
    get(id) {
      try {
        if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)
          || ['__proto__', 'constructor', 'prototype'].includes(id)) fail('VALIDATION_FAILED');
        const snapshot = store.read();
        const note = Object.hasOwn(snapshot.notes, id) ? snapshot.notes[id] : undefined;
        if (!note || note.kind !== 'manual' || note.deletedAt) return null;
        return { epoch: snapshot.epoch, revision: snapshot.revision, note };
      } catch (error) { throw safe(error); }
    },
    create(request) {
      try {
        keys(request, ['requestId', 'epoch', 'expectedRevision', 'title', 'bodyMarkdown', 'tagIds'],
          ['requestId', 'epoch', 'expectedRevision', 'bodyMarkdown']);
        if (typeof request.epoch !== 'string' || typeof request.requestId !== 'string'
          || !/^[A-Za-z0-9_-]{1,128}$/.test(request.requestId)
          || ['__proto__', 'constructor', 'prototype'].includes(request.requestId)) fail('VALIDATION_FAILED');
        // ID is derived from the persistent intent, not from a fresh random value
        // on retry. The Client cannot choose ID, provenance, kind, or creation time.
        const id = noteId(request.epoch, request.requestId);
        return store.mutate({ ...request, id }, (current, intent) => createNote(current,
          { kind: 'manual', bodyMarkdown: intent.bodyMarkdown, tagIds: intent.tagIds ?? [],
            ...(intent.title === undefined ? {} : { title: intent.title }) },
          { id: intent.id, time: now(), expectedRevision: intent.expectedRevision }, validate));
      } catch (error) { return Promise.reject(safe(error)); }
    },
    update(request) {
      try {
        keys(request, ['requestId', 'epoch', 'expectedRevision', 'id', 'expectedVersion', 'title', 'bodyMarkdown', 'tagIds'],
          ['requestId', 'epoch', 'expectedRevision', 'id', 'expectedVersion']);
        if (!['title', 'bodyMarkdown', 'tagIds'].some(field => Object.hasOwn(request, field))) fail('VALIDATION_FAILED');
        return store.mutate(request, (current, intent) => {
          const note = Object.hasOwn(current.notes, intent.id) ? current.notes[intent.id] : undefined;
          if (!note || note.kind !== 'manual' || note.quote || note.deletedAt) fail('VALIDATION_FAILED');
          return changeNotes(current, { expectedRevision: intent.expectedRevision, time: now(), changes: [{
            id: intent.id, action: 'edit', expectedVersion: intent.expectedVersion,
            ...(Object.hasOwn(intent, 'title') ? { title: intent.title } : {}),
            ...(Object.hasOwn(intent, 'bodyMarkdown') ? { bodyMarkdown: intent.bodyMarkdown } : {}),
            ...(Object.hasOwn(intent, 'tagIds') ? { tagIds: intent.tagIds } : {}),
          }] }, validate);
        });
      } catch (error) { return Promise.reject(safe(error)); }
    },
    exportJson() {
      try { return backupJson(store.read()); } catch (error) { throw safe(error); }
    },
    exportMarkdown(request) {
      try {
        keys(request, ['epoch', 'expectedRevision', 'ids', 'options'],
          ['epoch', 'expectedRevision', 'ids']);
        const snapshot = store.read();
        if (request.epoch !== snapshot.epoch) fail('EPOCH_CONFLICT');
        if (request.expectedRevision !== snapshot.revision) fail('VERSION_CONFLICT');
        const options = request.options ?? {};
        if (!options || typeof options !== 'object' || Array.isArray(options)
          || Object.hasOwn(options, 'exportedAt')) fail('VALIDATION_FAILED');
        const output = exportMarkdown(snapshot, request.ids, request.ids,
          { ...options, exportedAt: now() });
        return { epoch: snapshot.epoch, ...output,
          bytes: new TextEncoder().encode(output.content).byteLength };
      } catch (error) { throw safe(error); }
    },
    close: () => { uploads.close(); return store.close(); },
  };
}
