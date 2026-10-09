import { manualNotebookService } from '../manual-notebook-service.js';
import { registerPreviewRoutes } from './preview-routes.js';

// Assembly only: caller transfers an already-opened snapshot store. The
// production JSON adapter owns media; this function owns Service and routes.
export function manualRuntime(ctx, domain, options = {}) {
  if (typeof ctx?.effect !== 'function' || typeof domain?.close !== 'function')
    throw Object.assign(new Error('INVALID_CONFIG'), { code: 'INVALID_CONFIG' });
  const service = manualNotebookService({ ...options, domain });
  let stopRoutes = () => Promise.resolve();
  let closing;
  const close = () => {
    if (closing) return closing;
    // close marks the coordinator closed synchronously before its first await,
    // so even a retained Service reference cannot enqueue a late mutation.
    const drained = service.close();
    const routesStopped = stopRoutes();
    closing = (async () => {
      const outcomes = await Promise.allSettled([routesStopped, drained]);
      // Keep trying to release only our own handle even if route disposal fails.
      try { await domain.close(); }
      catch { outcomes.push({ status: 'rejected' }); }
      if (outcomes.some(outcome => outcome.status === 'rejected'))
        throw Object.assign(new Error('CLOSE_FAILED'), { code: 'CLOSE_FAILED' });
    })();
    return closing;
  };
  ctx.effect(() => close);
  stopRoutes = registerPreviewRoutes(ctx, service);
  return { service, close };
}
