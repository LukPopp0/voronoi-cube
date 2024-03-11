import { useCallback, useContext } from 'react';
import { SceneContext } from '../../hooks/sceneContext';
import { BoxGeometry, CylinderGeometry, Group, Mesh, Scene } from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { useVoronoiStore } from '../../store/store';

const download = (filename: string, text: string) => {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
};

const CUT_FIRST_CELL = true;
const CUTOUT_WALL_THICKNESS = 0.05;
const CUTOUT_SIZE = 7.5 / 2;

export const DownloadButton = () => {
  const scene = useContext(SceneContext);
  const cubeSize = useVoronoiStore(s => s.pointDistribution.size);

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
        const cell = new Brush((part as Mesh).geometry.clone());
        cell.geometry.translate(part.position.x, part.position.y, part.position.z);

        if (CUT_FIRST_CELL) {
          const outer = new CylinderGeometry(
            CUTOUT_SIZE + CUTOUT_WALL_THICKNESS,
            CUTOUT_SIZE + CUTOUT_WALL_THICKNESS,
            1.5 * cubeSize,
            60,
            60
          );
          outer.translate(0, -cubeSize / 2, 0);
          const cutter = new Brush();

          // Add outer cylinder to the first (bottom) cell
          // Cut it out of every other cell
          if (part.userData['particleID'] === 0) {
            const inner = new CylinderGeometry(CUTOUT_SIZE, CUTOUT_SIZE, 1.5 * cubeSize, 60, 60);
            inner.translate(0, -cubeSize / 2, 0);

            const bGeom = new BoxGeometry(2 * cubeSize, 2 * cubeSize, 2 * cubeSize);
            bGeom.translate(0, -1.5 * cubeSize, 0);

            cutter.geometry = outer;
            cell.geometry = evaluator.evaluate(cell, cutter, ADDITION).geometry.clone();

            cutter.geometry = bGeom;
            cell.geometry = evaluator.evaluate(cell, cutter, SUBTRACTION).geometry.clone();

            cutter.geometry = inner;
            cell.geometry = evaluator.evaluate(cell, cutter, SUBTRACTION).geometry.clone();
          } else {
            cutter.geometry = outer;
            cell.geometry = evaluator.evaluate(cell, cutter, SUBTRACTION).geometry.clone();
          }
        }

        const output = evaluator.evaluate(cell, innerCubeBrush, SUBTRACTION);

        group.add(output);
      }
    }

    const data = new STLExporter().parse(group);
    download('voronoi.stl', data);
  }, [cubeSize, scene]);
  return <button onClick={() => downloadVoronoi()}>Download</button>;
};
