/**
 * worker.js
 *
 * Web Worker entry point. Receives RUN messages from the main thread,
 * calls runProjection(), and posts the result back.
 *
 * Message protocol:
 *   Main → Worker: { type: 'RUN', inputs: ProjectionInputs, scenarioId: string }
 *   Worker → Main: { type: 'RESULT', rows: ProjectionRow[], scenarioId: string }
 *   Worker → Main: { type: 'ERROR',  message: string,       scenarioId: string }
 *
 * No DOM access. Import as:
 *   new Worker('./js/worker.js', { type: 'module' })
 */

'use strict';

import { runProjection } from './projection-engine.js';

self.onmessage = function(e) {
  const { type, inputs, scenarioId } = e.data;

  if (type !== 'RUN') return;

  try {
    const rows = runProjection(inputs);
    self.postMessage({ type: 'RESULT', rows, scenarioId });
  } catch (err) {
    self.postMessage({ type: 'ERROR', message: err.message, scenarioId });
  }
};
