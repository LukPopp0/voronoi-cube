import { useCallback } from 'react';
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { useVoronoiStore } from '../../store/store';
import { prepareForPrint } from '../../utils/printCutting';
import { triangulateCellData } from '../../utils/cellCuttingAlgorithm';

const download = (filename: string, text: string) => {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
};

export const DownloadButton = () => {
  const cubeSize = useVoronoiStore(s => s.pointDistribution.size);
  const innerCubeSize = useVoronoiStore(s => s.innerCubeSize);
  const cutCells = useVoronoiStore(s => s.cutCells);

  const downloadVoronoi = useCallback(() => {
    const cellArray = Array.from(cutCells.values());
    if (cellArray.length === 0) {
      console.warn('No cell data available for download');
      return;
    }

    console.log(`Processing ${cellArray.length} cells for download...`);

    const printCells = prepareForPrint(cellArray, cubeSize, innerCubeSize);

    const group = new Group();
    const material = new MeshBasicMaterial();

    for (const cell of printCells) {
      const triangulated = triangulateCellData(cell);

      if (triangulated.positions.length === 0) continue;

      const bg = new BufferGeometry();
      bg.setAttribute('position', new BufferAttribute(triangulated.positions, 3));
      bg.setAttribute('normal', new BufferAttribute(triangulated.normals, 3));
      bg.setIndex(new BufferAttribute(triangulated.indices, 1));

      // Translate to world position
      bg.translate(cell.x, cell.y, cell.z);

      const mesh = new Mesh(bg, material);
      group.add(mesh);
    }

    const data = new STLExporter().parse(group);
    download('voronoi.stl', data);

    console.log('Download complete');
  }, [cubeSize, innerCubeSize, cutCells]);

  return <button onClick={() => downloadVoronoi()}>Download</button>;
};
