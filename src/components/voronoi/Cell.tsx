import { useEffect, useMemo, useRef, useState } from 'react';
import { VoroCell } from 'voro3d';
import { Mesh } from 'three';
import { useVoronoiStore } from '../../store/store';
import { polygonToTriangles } from '../../utils/geometryHelper';
import { useCellCuttingWorker } from '../../hooks/useCellCuttingWorker';
import type { ThreeElements } from '@react-three/fiber';

type CellProps = {
  cell: VoroCell;
} & ThreeElements['mesh'];

export const Cell = ({ cell, ...meshProps }: CellProps) => {
  const size = useVoronoiStore(state => state.pointDistribution.size);
  const gapSize = useVoronoiStore(state => state.gapSize);
  const debug = useVoronoiStore(state => state.debug);
  const meshRef = useRef<Mesh>(null);
  const [debugStartTime, setDebugStartTime] = useState<number>(-1);

  const { geometry, cutCell } = useCellCuttingWorker();

  const triangleIndices = useMemo(() => cell.faces.map(polygonToTriangles), [cell.faces]);

  useEffect(() => {
    setDebugStartTime(window.performance.now());
    cutCell(cell, triangleIndices.flat().flat(), gapSize, size);
  }, [cell, triangleIndices, gapSize, size, cutCell, debug]);

  useEffect(() => {
    if (!meshRef.current || !geometry) return;

    if (debug && debugStartTime >= 0) {
      const deltaTime = window.performance.now() - debugStartTime;
      console.log('Cell cutting time: ', deltaTime);
      setDebugStartTime(-1);
    }

    meshRef.current.geometry = geometry;
    meshRef.current.updateMatrixWorld();
  }, [geometry, debug, debugStartTime]);

  return (
    <>
      <mesh ref={meshRef} position={[cell.x, cell.y, cell.z]} {...meshProps}>
        {debug ? (
          <meshPhongMaterial color="#949494" flatShading={true} transparent={true} opacity={0.75} />
        ) : (
          <meshPhongMaterial color="#949494" flatShading={true} transparent={false} />
        )}
      </mesh>
    </>
  );
};
