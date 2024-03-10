import { useEffect, useMemo, useRef } from 'react';
import { VoroCell } from 'voro3d';
import { Mesh } from 'three';
import { useVoronoiStore } from '../../store/store';
import { polygonToTriangles } from '../../utils/geometryHelper';
import { cutCell } from '../../utils/cellCutting';

type CellProps = {
  cell: VoroCell;
};

export const Cell = ({ cell }: CellProps) => {
  const size = useVoronoiStore(state => state.pointDistribution.size);
  const gapSize = useVoronoiStore(state => state.gapSize);
  const debug = useVoronoiStore(state => state.debug);
  const meshRef = useRef<Mesh>(null);

  const triangleIndices = useMemo(() => cell.faces.map(polygonToTriangles), [cell.faces]);

  const bufferGeometry = useMemo(() => {
    const startTime = window.performance.now();
    const geom = cutCell(cell, triangleIndices.flat().flat(), gapSize, size);
    const deltaTime = window.performance.now() - startTime;

    if (debug) console.log('Time: ', deltaTime);
    return geom;
  }, [cell, triangleIndices, gapSize, size, debug]);

  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.geometry = bufferGeometry;
    meshRef.current.updateMatrixWorld();
  }, [bufferGeometry]);

  return (
    <>
      <mesh ref={meshRef} position={[cell.x, cell.y, cell.z]}>
        {debug ? (
          <meshPhongMaterial color="#949494" flatShading={true} transparent={true} opacity={0.75} />
        ) : (
          <meshPhongMaterial color="#949494" flatShading={true} transparent={false} />
        )}
      </mesh>
    </>
  );
};
