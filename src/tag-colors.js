// Only the six product colors are written. Older snapshots keep their stored
// values, but the UI maps the previous palette to the nearest current color.
export const TAG_COLORS = ['#FF5FA2', '#FF7A00', '#FFD000', '#00D9A3', '#3A86FF', '#7B61FF'];
const oldColors = {
  '#1d4ed8': '#3A86FF', '#7c3aed': '#7B61FF', '#15803d': '#00D9A3',
  '#b45309': '#FF7A00', '#be123c': '#FF5FA2', '#0f766e': '#00D9A3',
  '#475569': '#3A86FF', '#be185d': '#FF5FA2',
};

export const normalizeTagColor = value => typeof value === 'string'
  ? TAG_COLORS.find(color => color.toLowerCase() === value.toLowerCase()) : undefined;
export const isTagColor = value => normalizeTagColor(value) !== undefined;

export function defaultTagColor(id) {
  const builtins = { builtin_todo: 1, builtin_important: 0, builtin_verify: 5 };
  if (Object.hasOwn(builtins, id)) return TAG_COLORS[builtins[id]];
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

export const resolvedTagColor = (color, id) => {
  const legacy = typeof color === 'string' ? color.toLowerCase() : '';
  return normalizeTagColor(color)
    ?? (Object.hasOwn(oldColors, legacy) ? oldColors[legacy] : undefined)
    ?? defaultTagColor(id);
};
