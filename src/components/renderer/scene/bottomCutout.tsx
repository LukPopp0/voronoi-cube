import { useMemo } from 'react';
import { useVoronoiStore } from '../../../store/store';
import { buildBottomPlug } from '@/utils/print/plugGeometry';
import { triangulateCellData } from '@/utils/cutting/cellCutting';
import { toBufferGeometry } from '@/utils/geometry/bufferGeometry';

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
    return toBufferGeometry(triangulateCellData(plug));
  }, [size, innerCubeSize, bottomCutoutWidth, gapSize, bottomCutoutSides]);

  if (!previewPrintCuts || !showBottomCutout) return null;

  return (
    <mesh geometry={geometry}>
      <meshPhongMaterial color="#949494" flatShading />
    </mesh>
  );
};
