import { Worker } from 'node:worker_threads';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

// Parent never receives full Snapshot. Compare identical child workload with direct probe.
const delay = monitorEventLoopDelay({ resolution: 10 }); delay.enable();
await new Promise(resolve => setTimeout(resolve, 30));
const start = performance.now(); let output = '';
try {
  const worker = new Worker(new URL('./capacity-probe.js', import.meta.url), { stdout: true, stderr: true });
  let stderr = '';
  worker.stdout.on('data', chunk => { output += chunk; });
  worker.stderr.on('data', chunk => { stderr += chunk; });
  await new Promise((resolve, reject) => {
    worker.once('error', reject);
    worker.once('exit', code => code === 0 ? resolve() : reject(new Error(`CAPACITY_WORKER_EXIT_${code}: ${stderr}`)));
  });
  const workerMetrics = JSON.parse(output);
  await new Promise(resolve => setTimeout(resolve, 30));
  delay.disable();
  console.log(JSON.stringify({ workerMetrics,
    parentEventLoopMaxMs: delay.max / 1e6, parentEventLoopP99Ms: delay.percentile(99) / 1e6,
    totalMs: performance.now() - start,
    limitation: 'One worker run; all fixture construction, validation, SDK IO and comparison stay in worker. No full-Snapshot transport. maxRSS remains whole-process, not worker allocation. Not production service/Domain routing or UI SLA.' }, null, 2));
} finally { delay.disable(); }
