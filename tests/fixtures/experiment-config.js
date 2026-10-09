import { checkedTestRoot } from './test-root.js';

// Workspace-only experiment configuration, never exported from the production Bundle.
// No default root, environment fallback, implicit mkdir, or caller-chosen backend/domain.
export async function experimentConfig(config) {
  const invalid = () => Object.assign(new Error('INVALID_EXPERIMENT_CONFIG'), { code: 'INVALID_EXPERIMENT_CONFIG' });
  if (!config || typeof config !== 'object' || Array.isArray(config)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(config))) throw invalid();
  const keys = Reflect.ownKeys(config);
  if (keys.length !== 1 || keys[0] !== 'root') throw invalid();
  const rootField = Object.getOwnPropertyDescriptor(config, 'root');
  if (!rootField || !Object.hasOwn(rootField, 'value') || typeof rootField.value !== 'string') throw invalid();
  const root = await checkedTestRoot(rootField.value);
  return Object.freeze({ root, backend: 'notebook_probe_v1', domain: 'notebook_probe_v1' });
}
