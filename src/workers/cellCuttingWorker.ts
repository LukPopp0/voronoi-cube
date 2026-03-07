/// <reference lib="webworker" />

import { cutCellCore, triangulateCellData } from '../utils/cellCuttingAlgorithm';
import { WorkerInput } from './types/workerInput';
import { WorkerOutput } from './types/workerOutput';

// Worker message handler
self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { cell, triangleIndices, destructionParameter, cubeSize, particleId } = e.data;

  const cellData = cutCellCore(cell, triangleIndices, destructionParameter, cubeSize);
  cellData.particleId = particleId;

  const triangulated = triangulateCellData(cellData);

  const result: WorkerOutput = {
    positions: triangulated.positions,
    normals: triangulated.normals,
    indices: triangulated.indices,
    cellData,
  };

  self.postMessage(result, [result.positions.buffer, result.normals.buffer, result.indices.buffer]);
};
