import { VContainer } from './vContainer';

const initVertexOrder = 64;
const initVertices = 256;

export class VCell {
  /** The total number of vertices for the cell. */
  nVerts = 0;
  /** Position of the particle for the cell. */
  particle: [number, number, number] = [0, 0, 0];
  /** The positions of the vertices */
  verts: [number, number, number][] = [];
  /** Two dimensional array containing edge information. */
  edgeInfo: number[][] = [];
  /** Sets the maximum order of a vertex. */
  currentVertexOrder = initVertexOrder;
  up = 0;

  constructor(
    con: VContainer,
    particleInfo: { ijk: number; q: number; i: number; j: number; k: number }
  ) {
    this.#initialize(con, particleInfo);
  }

  #initBase(xmin: number, xmax: number, ymin: number, ymax: number, zmin: number, zmax: number) {}

  #initialize(
    con: VContainer,
    particleInfo: { ijk: number; q: number; i: number; j: number; k: number }
  ) {
    // Get the right particle
    const { ijk, q, i, j, k } = particleInfo;
    const partID = con.partIDsInBlocks[ijk][q];
    this.particle = con.pPositions[partID];

    // Min. and max. coordinates of the cell relative to the particle position
    const xmin = con.xMin - this.particle[0];
    const xmax = con.xMax - this.particle[0];
    const ymin = con.yMin - this.particle[1];
    const ymax = con.yMax - this.particle[1];
    const zmin = con.zMin - this.particle[2];
    const zmax = con.zMax - this.particle[2];
    this.#initBase(xmin, xmax, ymin, ymax, zmin, zmax);

    // Init rectangular box with given dimensions

    // TODO: Initialize vertices of box as rectangle

    // TODO: Remove if not used anymore
    // ! Unused
    // Displacement
    const disp = ijk - i - con.nx * (j + con.ny * k);
    return disp;
  }
}
