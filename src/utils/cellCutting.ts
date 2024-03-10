import { BoxGeometry, BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { SUBTRACTION, Evaluator, Brush } from 'three-bvh-csg';
import { getFaceCenter, getFaceNormal } from './geometryHelper';
import { VoroCell } from 'voro3d';

const EPSILON = 0.005;

const evaluator = new Evaluator();
evaluator.attributes = ['position', 'normal'];

export const cutCell = (
  cell: VoroCell,
  triangleIndices: number[],
  destructionParameter: number,
  cubeSize: number
): BufferGeometry => {
  const bg = new BufferGeometry();
  bg.setIndex(triangleIndices);
  bg.setAttribute('position', new BufferAttribute(new Float32Array(cell.vertices), 3));
  bg.computeVertexNormals();

  if (destructionParameter <= 0) return bg;

  const input = new Brush(bg);
  const output = new Brush();
  const cutter = new Brush();
  let fn: Vector3, fc: Vector3;

  for (let fi = 0; fi < cell.faces.length; ++fi) {
    fn = getFaceNormal(cell.faces[fi], cell.vertices);
    fc = getFaceCenter(cell.faces[fi], cell.vertices);

    // Skip faces at the border
    if (
      cubeSize / 2 - Math.abs(fc.x + cell.x) < EPSILON ||
      cubeSize / 2 - Math.abs(fc.y + cell.y) < EPSILON ||
      cubeSize / 2 - Math.abs(fc.z + cell.z) < EPSILON
    ) {
      continue;
    }

    // Cutting geometry
    const cutterGeom = new BoxGeometry(5 * cubeSize, 5 * cubeSize, destructionParameter);
    cutterGeom.lookAt(fn.add(fc).sub(fc));
    cutterGeom.translate(fc.x, fc.y, fc.z);
    cutter.geometry = cutterGeom;

    output.geometry = new BufferGeometry();
    evaluator.evaluate(input, cutter, SUBTRACTION, output);
    input.geometry = output.geometry;
  }

  return output.geometry;
};
