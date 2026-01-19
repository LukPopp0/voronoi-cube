/// <reference lib="webworker" />

import { cutCellCore } from '../utils/cellCuttingAlgorithm';
import { WorkerInput } from './types/workerInput';

// Worker message handler
self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { cell, triangleIndices, destructionParameter, cubeSize } = e.data;

  const result = cutCellCore(cell, triangleIndices, destructionParameter, cubeSize);

  self.postMessage(result, [result.positions.buffer, result.normals.buffer, result.indices.buffer]);
};
