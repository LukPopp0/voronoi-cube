import { useCallback, useContext } from 'react';
import { SceneContext } from '../../hooks/sceneContext';
import { Group, Mesh, Scene } from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

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
  const scene = useContext(SceneContext);
  const downloadVoronoi = useCallback(() => {
    const voronoiCube = (scene as Scene).getObjectByName('voronoiCube');
    const innerCube = (scene as Scene).getObjectByName('innerCube');
    if (!voronoiCube || !innerCube) return;
    const group = new Group();
    const evaluator = new Evaluator();
    evaluator.attributes = ['position'];

    const innerCubeBrush = new Brush((innerCube as Mesh).geometry.clone());

    // Cut each cell with the inner cube
    for (let i = 0; i < voronoiCube.children.length; ++i) {
      const part = voronoiCube.children[i];
      if (part.type === 'Mesh') {
        // Create brush that gets cut and move by cell position
        const cell = new Brush((part as Mesh).geometry.clone());
        cell.geometry.translate(part.position.x, part.position.y, part.position.z);

        const output = new Brush();

        evaluator.evaluate(cell, innerCubeBrush, SUBTRACTION, output);

        group.add(output);
      }
    }

    const data = new STLExporter().parse(group);
    download('voronoi.stl', data);
  }, [scene]);
  return <button onClick={() => downloadVoronoi()}>Download</button>;
};
