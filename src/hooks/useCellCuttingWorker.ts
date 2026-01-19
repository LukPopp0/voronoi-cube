import { useEffect, useRef, useState, useCallback } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import { VoroCell } from 'voro3d';
import CellCuttingWorker from '../workers/cellCuttingWorker?worker';
import { WorkerOutput } from '../workers/types/workerOutput';

interface UseCellCuttingWorkerResult {
  geometry: BufferGeometry | null;
  isProcessing: boolean;
  cutCell: (
    cell: VoroCell,
    triangleIndices: number[],
    destructionParameter: number,
    cubeSize: number,
  ) => void;
}

/**
 * Hook to manage a Web Worker for cell cutting operations.
 * Each cell gets its own worker instance for parallel processing.
 */
export const useCellCuttingWorker = (): UseCellCuttingWorkerResult => {
  const workerRef = useRef<Worker | null>(null);
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    workerRef.current = new CellCuttingWorker();

    workerRef.current.onmessage = (e: MessageEvent<WorkerOutput>) => {
      const { positions, normals, indices } = e.data;

      const bg = new BufferGeometry();

      if (positions.length > 0) {
        bg.setAttribute('position', new BufferAttribute(positions, 3));
        bg.setAttribute('normal', new BufferAttribute(normals, 3));
        bg.setIndex(new BufferAttribute(indices, 1));
      }

      setGeometry(bg);
      setIsProcessing(false);
    };

    workerRef.current.onerror = error => {
      console.error('Cell cutting worker error:', error);
      setIsProcessing(false);
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const cutCell = useCallback(
    (cell: VoroCell, triangleIndices: number[], destructionParameter: number, cubeSize: number) => {
      if (!workerRef.current) return;

      setIsProcessing(true);

      workerRef.current.postMessage({
        cell: {
          x: cell.x,
          y: cell.y,
          z: cell.z,
          vertices: cell.vertices,
          faces: cell.faces,
        },
        triangleIndices,
        destructionParameter,
        cubeSize,
      });
    },
    [],
  );

  return { geometry, isProcessing, cutCell };
};
