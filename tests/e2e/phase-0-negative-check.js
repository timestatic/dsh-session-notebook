// Run only on an existing authorized, authenticated Harness page via playwright-cli run-code.
// Read-only probes: no Notebook writes, credentials inspection, install, disable, or restart.
async page => {
  return await page.evaluate(async () => {
    if (location.origin !== 'http://127.0.0.1:3080') throw new Error('PHASE0_NEGATIVE_FAILED:targetWebOrigin');
    const results = [];
    const probe = async (name, path, init, expectedStatus, validate) => {
      const response = await fetch(path, { ...init, signal: AbortSignal.timeout(5000) });
      const status = response.status;
      let valid = status === expectedStatus;
      if (validate) {
        const body = await response.json();
        valid = valid && validate(body);
      } else {
        await response.body?.cancel();
      }
      results.push({ name, status, pass: valid });
      if (!valid) throw new Error(`PHASE0_NEGATIVE_FAILED:${name}`);
    };
    const endpoint = '/api/dsh-session-notebook/health';
    const envelope = {
      type: 'client-request', rpcId: 'notebook-negative-check',
      method: 'dsh-session-notebook/health', payload: {},
    };
    const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const validationFailure = body => body.type === 'server-response'
      && body.rpcId === envelope.rpcId && body.result?.ok === false
      && body.result?.error?.code === 'VALIDATION_FAILED';
    await probe('getUnexpectedQuery', `${endpoint}?unexpected=1`, {}, 400, body => body.code === 'VALIDATION_FAILED');
    await probe('postUnexpectedPayload', endpoint, post({ ...envelope, payload: { unexpected: true } }), 200, validationFailure);
    await probe('postWrongMethod', endpoint, post({ ...envelope, method: 'settings/describe' }), 200, validationFailure);
    await probe('postExtraEnvelopeField', endpoint, post({ ...envelope, unexpected: true }), 200, validationFailure);
    await probe('postMalformedJson', endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }, 400);
    await probe('postWrongContentType', endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' }, 415);
    // Unknown GET must not reach either health/list or a shared Notebook wildcard handler.
    await probe('unknownNotebookEndpoint', '/api/dsh-session-notebook/not-a-real-endpoint', {}, 404);
    return { origin: location.origin, results };
  });
}
