import { useCallback, useContext } from 'react';
import { SceneContext } from '../../hooks/sceneContext';
import { Group, Mesh, Scene } from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';

const download = (filename: string, text: string) => {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
};

const TRANSLATE_OUTPUT = true;

export const DownloadButton = () => {
  const scene = useContext(SceneContext);

  const downloadVoronoi = useCallback(() => {
    const voronoiCube = (scene as Scene).getObjectByName('voronoiCube');
    const innerCube = (scene as Scene).getObjectByName('innerCube');
    if (!voronoiCube || !innerCube) return;
    const group = new Group();

    // Cut each cell with the inner cube
    const cellPositions: number[][] = [];
    for (let i = 0; i < voronoiCube.children.length; ++i) {
      const part = voronoiCube.children[i];
      if (part.type === 'Mesh') {
        // Download individual parts as well
        const partClone = new Mesh((part as Mesh).geometry.clone());
        if (TRANSLATE_OUTPUT) {
          (partClone as Mesh).geometry.translate(part.position.x, part.position.y, part.position.z);
        }
        cellPositions.push([part.position.x, part.position.y, part.position.z]);
        const data = new STLExporter().parse(partClone);
        console.log(`Downloading ${i + 1}/${voronoiCube.children.length}`);
        // if (i > 9) {
        download(`voronoi-${i}.stl`, data);
        // }
      }
    }
    download('cellPositions.json', JSON.stringify(cellPositions));
    console.log('Downloading object...');
    const data = new STLExporter().parse(group);
    download('voronoi.stl', data);
    console.log('Downloading object... Done.');
  }, [scene]);
  return <button onClick={() => downloadVoronoi()}>Download</button>;
};
