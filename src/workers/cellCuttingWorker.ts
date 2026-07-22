/// <reference lib="webworker" />

import { cutCellCore, triangulateCellData } from '../utils/cellCuttingAlgorithm';
import { prepareForPrint } from '../utils/printCutting';
import { WorkerInput } from './types/workerInput';
import { WorkerOutput } from './types/workerOutput';

// Worker message handler
self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { cell, triangleIndices, destructionParameter, cubeSize, particleId, preview } = e.data;

  const cellData = cutCellCore(cell, triangleIndices, destructionParameter, cubeSize);
  cellData.particleId = particleId;

  // Display copy: when previewing, cut the print regions off a copy so the
  // rendered geometry matches the export. cellData itself stays raw gap-cut.
  let displayData = cellData;
  if (preview) {
    const prepped = prepareForPrint([cellData], cubeSize, preview.innerCubeRatio, {
      cutInnerCube: preview.cutInnerCube,
      cutBottomHole: preview.cutBottomHole,
      bottomCutoutWidth: preview.bottomCutoutWidth,
      bottomCutoutSides: preview.bottomCutoutSides,
    });
    displayData = prepped[0] ?? { ...cellData, vertices: [], faces: [] };
  }

  const triangulated = triangulateCellData(displayData);

  const result: WorkerOutput = {
    positions: triangulated.positions,
    normals: triangulated.normals,
    indices: triangulated.indices,
    cellData,
  };

  self.postMessage(result, [result.positions.buffer, result.normals.buffer, result.indices.buffer]);
};
