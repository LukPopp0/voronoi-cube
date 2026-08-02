import { Group, Mesh, MeshBasicMaterial } from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { CutCellData } from '@/types/domain';
import { prepareForPrint } from '@/utils/print/printCutting';
import { buildBottomPlug } from '@/utils/print/plugGeometry';
import { triangulateCellData } from '@/utils/cutting/cellCutting';
import { toBufferGeometry } from '@/utils/geometry/bufferGeometry';

export interface PrintSTLParams {
  cubeSize: number;
  innerCubeSize: number;
  cutInnerCube: boolean;
  cutBottomHole: boolean;
  bottomCutoutWidth: number;
  bottomCutoutSides: number;
  gapSize: number;
}

/**
 * Run print prep (inner-cube + bottom-hole cuts) on the raw gap-cut cells,
 * add the in-place bottom plug when the hole is cut, assemble every cell into a
 * world-positioned Group, and serialize to STL text.
 */
export const buildPrintSTL = (cutCells: CutCellData[], params: PrintSTLParams): string => {
  const {
    cubeSize,
    innerCubeSize,
    cutInnerCube,
    cutBottomHole,
    bottomCutoutWidth,
    bottomCutoutSides,
    gapSize,
  } = params;

  const printCells = prepareForPrint(cutCells, cubeSize, innerCubeSize, {
    cutInnerCube,
    cutBottomHole,
    bottomCutoutWidth,
    bottomCutoutSides,
  });

  // In-place plug for the bottom cutout, so a full cube can be printed.
  if (cutBottomHole) {
    const plug = buildBottomPlug(cubeSize, innerCubeSize, bottomCutoutWidth, gapSize, bottomCutoutSides);
    if (plug.faces.length > 0) printCells.push(plug);
  }

  const group = new Group();
  const material = new MeshBasicMaterial();

  for (const cell of printCells) {
    const triangulated = triangulateCellData(cell);
    if (triangulated.positions.length === 0) continue;

    const bg = toBufferGeometry(triangulated);
    bg.translate(cell.x, cell.y, cell.z); // cell-local -> world
    group.add(new Mesh(bg, material));
  }

  return new STLExporter().parse(group);
};

/** Trigger a browser download of `text` as `filename`. */
export const triggerDownload = (filename: string, text: string) => {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};
