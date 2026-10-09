import * as fs from 'node:fs/promises';

const client = new URL('../src/client/', import.meta.url);
const marker = '/*__NOTEBOOK_CLIENT_MODULES__*/';
const modules = [
  ['preview-api.js', 'previewApi'],
  ['manual-save-controller.js', 'manualSaveController'],
];

async function inlineModule(file, exported) {
  const source = await fs.readFile(new URL(file, client), 'utf8');
  const declaration = `export function ${exported}(`;
  if (source.includes('\r') || /^\s*import\b/m.test(source)
    || source.split(declaration).length !== 2
    || /^\s*export\b/m.test(source.replace(declaration, 'function ' + exported + '('))) {
    throw new Error(`UNSUPPORTED_CLIENT_MODULE:${file}`);
  }
  const body = source.replace(declaration, `function ${exported}(`);
  return `const ${exported} = (() => {\n${body}\nreturn ${exported};\n})();`;
}

async function inlineKnownModule(file, importLine, exports, binding, dependencies = []) {
  let source = await fs.readFile(new URL(file, client), 'utf8');
  if (source.includes('\r') || (importLine && !source.startsWith(`${importLine}\n`)))
    throw new Error(`UNSUPPORTED_CLIENT_MODULE:${file}`);
  if (importLine) source = source.slice(importLine.length + 1);
  const found = [...source.matchAll(/^export (?:const|(?:async )?function) (\w+)/gm)].map(match => match[1]);
  if (found.length !== exports.length || exports.some(name => !found.includes(name)))
    throw new Error(`UNSUPPORTED_CLIENT_MODULE:${file}`);
  source = source.replace(/^export /gm, '');
  if (/^\s*(?:import|export)\b/m.test(source)) throw new Error(`UNSUPPORTED_CLIENT_MODULE:${file}`);
  const names = exports.join(', ');
  return `const ${binding} = ((${dependencies.join(', ')}) => {\n${source}\nreturn { ${names} };\n})(${dependencies.join(', ')});`;
}

const template = await fs.readFile(new URL('index.template.js', client), 'utf8');
if (template.split(marker).length !== 2) throw new Error('CLIENT_TEMPLATE_MARKER_MISSING');
const inlined = [
  ...await Promise.all(modules.map(([file, exported]) => inlineModule(file, exported))),
  await inlineKnownModule('../tag-colors.js', null,
    ['TAG_COLORS', 'normalizeTagColor', 'isTagColor', 'defaultTagColor', 'resolvedTagColor'],
    '{ TAG_COLORS, normalizeTagColor, isTagColor, defaultTagColor, resolvedTagColor }'),
  await inlineKnownModule('../notebook-schema.js', null, ['notebookSchema'], '{ notebookSchema }'),
  await inlineKnownModule('../json-backup.js', "import { notebookSchema } from './notebook-schema.js';",
    ['DEFAULT_BACKUP_BYTES', 'BACKUP_VERSION', 'backupJson', 'inspectBackupJson', 'previewBackupReplacement'],
    '{ DEFAULT_BACKUP_BYTES, inspectBackupJson, previewBackupReplacement }', ['notebookSchema']),
  await inlineKnownModule('download-timestamp.js', null, ['downloadTimestamp'], '{ downloadTimestamp }'),
  await inlineKnownModule('backup-file.js', "import { inspectBackupJson, DEFAULT_BACKUP_BYTES } from '../json-backup.js';\nimport { downloadTimestamp } from './download-timestamp.js';",
    ['readBackupFile', 'backupFile', 'downloadBackupFile'], '{ readBackupFile, backupFile, downloadBackupFile }',
    ['inspectBackupJson', 'DEFAULT_BACKUP_BYTES', 'downloadTimestamp']),
  await inlineKnownModule('restore-transfer.js', "import { readBackupFile } from './backup-file.js';",
    ['stageBackupFile'], '{ stageBackupFile }', ['readBackupFile']),
  await inlineKnownModule('markdown-file.js', "import { downloadTimestamp } from './download-timestamp.js';",
    ['MAX_MARKDOWN_FILE_BYTES', 'markdownFile', 'downloadMarkdownFile'],
    '{ markdownFile, downloadMarkdownFile }', ['downloadTimestamp']),
  await inlineKnownModule('input-draft.js', null,
    ['MAX_INPUT_INSERT_BYTES', 'currentInput', 'writeInput'],
    '{ currentInput, writeInput }'),
  await inlineKnownModule('message-text-index.js', null,
    ['messageTextIndex', 'foldedTextMap'], '{ messageTextIndex }'),
  await inlineKnownModule('text-anchor.js', null,
    ['locateTextAnchor'], '{ locateTextAnchor }'),
  await inlineKnownModule('conversation-annotations.js', "import { messageTextIndex } from './message-text-index.js';\nimport { locateTextAnchor } from './text-anchor.js';",
    ['conversationAnnotations', 'renderedConversationBodies'], '{ conversationAnnotations, renderedConversationBodies }',
    ['messageTextIndex', 'locateTextAnchor']),
  await inlineKnownModule('session-activity.js', null,
    ['sessionActivityCatalog'], '{ sessionActivityCatalog }'),
]
  .join('\n\n').split('\n').map(line => line ? `    ${line}` : '').join('\n');
const contents = template.replace(marker,
  `// Generated from Client ESM modules by scripts/build-client.mjs.\n${inlined}`);
const output = new URL('index.js', client);
if (process.argv.slice(2).join(' ') === '--check') {
  if (await fs.readFile(output, 'utf8') !== contents) throw new Error('CLIENT_BUNDLE_STALE');
} else if (process.argv.length === 2) {
  if (await fs.readFile(output, 'utf8') !== contents) await fs.writeFile(output, contents);
} else throw new Error('INVALID_BUILD_ARGUMENT');
