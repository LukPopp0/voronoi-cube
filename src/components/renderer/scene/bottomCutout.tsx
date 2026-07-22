import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import { useVoronoiStore } from '../../../store/store';
import { buildBottomPlug } from '../../../utils/plugGeometry';
import { triangulateCellData } from '../../../utils/cellCuttingAlgorithm';

type BottomCutoutProps = {
  size?: number;
};

/**
 * Debug visualization of the bottom cutout: renders the exact gap-inset plug
 * that gets exported (buildBottomPlug with the real gapSize), so what you see
 * while previewing matches the downloaded plug. Purely visual; does not affect
 * the cells or the export.
 */
export const BottomCutout = ({ size = 10 }: BottomCutoutProps) => {
  const previewPrintCuts = useVoronoiStore(s => s.debugSettings.previewPrintCuts);
  const showBottomCutout = useVoronoiStore(s => s.debugSettings.showBottomCutout);
  const innerCubeSize = useVoronoiStore(s => s.debugSettings.innerCubeSize);
  const bottomCutoutSides = useVoronoiStore(s => s.debugSettings.bottomCutoutSides);
  const bottomCutoutWidth = useVoronoiStore(s => s.bottomCutoutWidth);
  const gapSize = useVoronoiStore(s => s.gapSize);

  const geometry = useMemo(() => {
    const plug = buildBottomPlug(size, innerCubeSize, bottomCutoutWidth, gapSize, bottomCutoutSides);
    const tri = triangulateCellData(plug);
    const bg = new BufferGeometry();
    if (tri.positions.length > 0) {
      bg.setAttribute('position', new BufferAttribute(tri.positions, 3));
      bg.setAttribute('normal', new BufferAttribute(tri.normals, 3));
      bg.setIndex(new BufferAttribute(tri.indices, 1));
    }
    return bg;
  }, [size, innerCubeSize, bottomCutoutWidth, gapSize, bottomCutoutSides]);

  if (!previewPrintCuts || !showBottomCutout) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#ff8c00" />
    </mesh>
  );
};
