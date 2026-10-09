// Temporary passive observer. No RPC/fetch routes, headers, body, credentials, or response mutation.
import { createSummaryWriter } from './summary-writer.js';

const SUMMARY_TARGET = '/Users/didi_1/IdeaProjects/mytest/dsh-session-notebook/diagnostics/desktop-http-observer/result.json';

export function apply(ctx) {
  const writer = createSummaryWriter(SUMMARY_TARGET);
  observe(ctx, writer);
}

// Separate seam keeps unit tests from writing synthetic HTTP statuses to runtime evidence.
export function observe(ctx, writer) {
  const logger = ctx.logger('session-notebook-http-observer');
  const pending = new Set();
  let active = true;
  let completed = 0;
  ctx.effect(() => () => {
    active = false;
    for (const cleanup of [...pending]) cleanup();
    return writer.close();
  });
  ctx.on('connection/request', async (request, response, next) => {
    // Do not parse URLs or keep any query string; only the exact target is observed.
    if (!active || request.method !== 'POST' || request.url !== '/api/settings/describe'
      || pending.size >= 16 || completed + pending.size >= 32) return next();
    let watching = true;
    const cleanup = () => {
      if (!watching) return;
      watching = false;
      response.removeListener('finish', finish);
      response.removeListener('close', cleanup);
      pending.delete(cleanup);
    };
    const finish = () => {
      cleanup();
      if (!active) return;
      completed++;
      // Observation must not make a successful request fail, even if log delivery rejects.
      try {
        const status = Number.isInteger(response.statusCode) && response.statusCode >= 100
          && response.statusCode <= 599 ? response.statusCode : 0;
        writer.record(status);
        logger.info('SETTINGS_HTTP_FINISH count=%d status=%d', completed, status);
      } catch { /* Logging is optional and cannot affect the carrier. */ }
    };
    pending.add(cleanup);
    response.once('finish', finish);
    response.once('close', cleanup);
    try { return await next(); }
    catch (error) { cleanup(); throw error; }
    // A response can finish after next() settles. It stays watched until finish/close/disposal.
  });
}
