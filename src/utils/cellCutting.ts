import { BoxGeometry, BufferAttribute, BufferGeometry, Mesh, Vector3 } from 'three';
import { SUBTRACTION, Evaluator, Brush } from 'three-bvh-csg';
import { getFaceCenter, getFaceNormal } from './geometryHelper';
import { VoroCell } from 'voro3d';
import { CSG } from 'three-csg-ts';

const EPSILON = 0.005;

const evaluator = new Evaluator();
evaluator.attributes = ['position', 'normal'];

// --------------------------------------------------------
// using three-bvh-csg
// --------------------------------------------------------
export const cutCell = (
  cell: VoroCell,
  triangleIndices: number[],
  destructionParameter: number,
  cubeSize: number
): BufferGeometry => {
  console.log(`USING three-bvh-csg: Cell #${cell.particleID} has \t ${cell.faces.length} faces.`);
  const bg = new BufferGeometry();
  bg.setIndex(triangleIndices);
  bg.setAttribute('position', new BufferAttribute(new Float32Array(cell.vertices), 3));
  bg.computeVertexNormals();

  if (destructionParameter <= 0) return bg;

  const input = new Brush(bg);
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
    input.geometry = evaluator.evaluate(input, cutter, SUBTRACTION).geometry;
  }

  return input.geometry;
};

// --------------------------------------------------------
// using three-csg-ts
// --------------------------------------------------------
export const cutCell2 = (
  cell: VoroCell,
  triangleIndices: number[],
  destructionParameter: number,
  cubeSize: number
): BufferGeometry => {
  console.log(`USING three-csg-ts: Cell #${cell.particleID} has \t ${cell.faces.length} faces.`);
  const bg = new BufferGeometry();
  bg.setIndex(triangleIndices);
  bg.setAttribute('position', new BufferAttribute(new Float32Array(cell.vertices), 3));
  bg.computeVertexNormals();

  if (destructionParameter <= 0) return bg;

  let inputMesh = new Mesh(bg);
  const cutter = new Mesh();
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
    inputMesh = CSG.subtract(inputMesh, cutter);
  }

  return inputMesh.geometry;
};
