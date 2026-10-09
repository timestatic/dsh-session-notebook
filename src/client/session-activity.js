// Read only Host-catalogued rows from the supported Client Sessions snapshot.
// Retained byId fallbacks are not catalog membership or current Host activity.
export function sessionActivityCatalog(snapshot) {
  const fail = () => { throw Object.assign(new Error('SESSION_ACTIVITY_UNAVAILABLE'),
    { code: 'SESSION_ACTIVITY_UNAVAILABLE' }); };
  if (!snapshot || snapshot.phase !== 'ready' || !Array.isArray(snapshot.ids)
    || snapshot.ids.length > 10000 || !snapshot.byId || typeof snapshot.byId !== 'object') fail();
  const seen = new Set();
  return snapshot.ids.map(id => {
    if (typeof id !== 'string' || !id || id.length > 4096 || seen.has(id)
      || !Object.hasOwn(snapshot.byId, id)) fail();
    seen.add(id);
    const row = snapshot.byId[id];
    if (!row || row.id !== id || !Number.isSafeInteger(row.updatedAt) || row.updatedAt < 0) fail();
    return { sessionId: id, updatedAt: row.updatedAt };
  });
}
