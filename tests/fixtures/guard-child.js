import { acquireMedium } from './medium-guard.js';
try {
  const guard = await acquireMedium(process.argv[2]);
  const keepAlive = setInterval(() => {}, 1000);
  process.on('message', async message => {
    if (message === 'release') {
      await guard.release(); clearInterval(keepAlive); process.disconnect();
    }
  });
  process.send({ status: 'acquired' });
} catch (error) {
  process.send({ status: error.code ?? 'FAILED' }, () => process.disconnect());
}
