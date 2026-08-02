import { useCallback } from 'react';
import { useVoronoiStore } from '../../store/store';
import { buildPrintSTL, triggerDownload } from '@/utils/print/stlExport';

export const DownloadButton = () => {
  const cubeSize = useVoronoiStore(s => s.pointDistribution.size);
  const innerCubeSize = useVoronoiStore(s => s.debugSettings.innerCubeSize);
  const cutCells = useVoronoiStore(s => s.cutCells);
  const cutInnerCube = useVoronoiStore(s => s.cutInnerCube);
  const cutBottomHole = useVoronoiStore(s => s.cutBottomHole);
  const bottomCutoutWidth = useVoronoiStore(s => s.bottomCutoutWidth);
  const bottomCutoutSides = useVoronoiStore(s => s.debugSettings.bottomCutoutSides);
  const gapSize = useVoronoiStore(s => s.gapSize);

  const downloadVoronoi = useCallback(() => {
    const cellArray = Array.from(cutCells.values());
    if (cellArray.length === 0) {
      console.warn('No cell data available for download');
      return;
    }

    console.log(`Processing ${cellArray.length} cells for download...`);

    const data = buildPrintSTL(cellArray, {
      cubeSize,
      innerCubeSize,
      cutInnerCube,
      cutBottomHole,
      bottomCutoutWidth,
      bottomCutoutSides,
      gapSize,
    });
    triggerDownload('voronoi.stl', data);

    console.log('Download complete');
  }, [
    cubeSize,
    innerCubeSize,
    cutCells,
    cutInnerCube,
    cutBottomHole,
    bottomCutoutWidth,
    bottomCutoutSides,
    gapSize,
  ]);

  return <button onClick={() => downloadVoronoi()}>Download</button>;
};
