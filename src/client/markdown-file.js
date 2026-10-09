import { downloadTimestamp } from './download-timestamp.js';
const fail = () => { throw Object.assign(new Error('INVALID_MARKDOWN_FILE'),
  { code: 'INVALID_MARKDOWN_FILE' }); };
export const MAX_MARKDOWN_FILE_BYTES = 8 * 1024 * 1024;

/** Convert a validated Host export to one UTF-8 Markdown file. */
export function markdownFile(value, { date = new Date() } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !Number.isSafeInteger(value.revision) || value.revision < 0
    || !Number.isSafeInteger(value.count) || value.count < 1
    || typeof value.content !== 'string' || !Number.isSafeInteger(value.bytes)
    || value.bytes < 1 || value.bytes > MAX_MARKDOWN_FILE_BYTES
    || new TextEncoder().encode(value.content).byteLength !== value.bytes) fail();
  return { filename: `dsh-session-notebook-rev-${value.revision}-${downloadTimestamp(date)}.md`,
    blob: new Blob([value.content], { type: 'text/markdown;charset=utf-8' }), bytes: value.bytes };
}

/** The caller supplies its trusted document and calls this only for a user action. */
export function downloadMarkdownFile(file, { document, URL } = {}) {
  if (!file || typeof file.filename !== 'string'
    || !/^dsh-session-notebook-rev-\d+-\d{14}\.md$/.test(file.filename)
    || !(file.blob instanceof Blob) || file.blob.type !== 'text/markdown;charset=utf-8'
    || !Number.isSafeInteger(file.bytes) || file.bytes < 1
    || file.bytes > MAX_MARKDOWN_FILE_BYTES || file.blob.size !== file.bytes
    || typeof document?.createElement !== 'function'
    || typeof URL?.createObjectURL !== 'function'
    || typeof URL?.revokeObjectURL !== 'function') fail();
  const anchor = document.createElement('a');
  if (typeof anchor?.click !== 'function') fail();
  const href = URL.createObjectURL(file.blob);
  try {
    anchor.href = href; anchor.download = file.filename; anchor.click();
  } finally { URL.revokeObjectURL(href); }
}
