import { AttestationWorker } from './index.js';
import pino from 'pino';

export function createWorkerLogger() {
  const logger = pino({ redact: ['*.token', '*.credential', '*.privateKey', '*.proof'] });
  return {
    info: (event: string, fields?: Readonly<Record<string, string | number | boolean>>) => logger.info(fields, event),
    warn: (event: string, fields?: Readonly<Record<string, string | number | boolean>>) => logger.warn(fields, event),
    error: (event: string, fields?: Readonly<Record<string, string | number | boolean>>) => logger.error(fields, event),
  };
}

export async function runWorkerForever(
  worker: AttestationWorker,
  intervalMs = 15_000,
): Promise<never> {
  while (true) {
    await worker.runOnce();
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
}
