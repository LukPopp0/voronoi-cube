import { useEffect, useMemo, useRef, useState } from 'react';
import { VoroCell } from 'voro3d';
import { Mesh } from 'three';
import { useVoronoiStore } from '../../store/store';
import { polygonToTriangles } from '../../utils/geometryHelper';
import { useCellCuttingWorker } from '../../hooks/useCellCuttingWorker';
import type { ThreeElements } from '@react-three/fiber';

type CellProps = {
  cell: VoroCell;
  generation: number;
} & ThreeElements['mesh'];

export const Cell = ({ cell, generation, ...meshProps }: CellProps) => {
  const size = useVoronoiStore(state => state.pointDistribution.size);
  const gapSize = useVoronoiStore(state => state.gapSize);
  const debug = useVoronoiStore(state => state.debug);
  const registerCutCell = useVoronoiStore(state => state.registerCutCell);
  const cutInnerCube = useVoronoiStore(state => state.cutInnerCube);
  const cutBottomHole = useVoronoiStore(state => state.cutBottomHole);
  const bottomCutoutWidth = useVoronoiStore(state => state.bottomCutoutWidth);
  const previewPrintCuts = useVoronoiStore(state => state.debugSettings.previewPrintCuts);
  const innerCubeSize = useVoronoiStore(state => state.debugSettings.innerCubeSize);
  const bottomCutoutSides = useVoronoiStore(state => state.debugSettings.bottomCutoutSides);
  const meshRef = useRef<Mesh>(null);
  const [debugStartTime, setDebugStartTime] = useState<number>(-1);

  const { geometry, cellData, cutCell } = useCellCuttingWorker();

  const triangleIndices = useMemo(() => cell.faces.map(polygonToTriangles), [cell.faces]);

  const preview = previewPrintCuts
    ? {
        cutInnerCube,
        cutBottomHole,
        innerCubeRatio: innerCubeSize,
        bottomCutoutWidth,
        bottomCutoutSides,
      }
    : undefined;

  useEffect(() => {
    setDebugStartTime(window.performance.now());
    cutCell(cell, triangleIndices.flat().flat(), gapSize, size, cell.particleID, preview);
    // preview is a fresh object each render; its fields drive re-cutting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cell,
    triangleIndices,
    gapSize,
    size,
    cutCell,
    debug,
    previewPrintCuts,
    cutInnerCube,
    cutBottomHole,
    bottomCutoutWidth,
    innerCubeSize,
    bottomCutoutSides,
  ]);

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

  useEffect(() => {
    if (cellData) registerCutCell(cellData, generation);
  }, [cellData, generation, registerCutCell]);

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
