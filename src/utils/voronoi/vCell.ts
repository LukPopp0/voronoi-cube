import { VContainer } from './vContainer';

export class VCell {
  /** The total number of vertices for the cell. */
  nVerts = 0;
  /** Position of the particle for the cell. */
  particle: [number, number, number] = [0, 0, 0];
  /** The positions of the vertices */
  verts: [number, number, number][] = [];
  /** The order of each vertex. */
  vertOrder: number[] = [];
  // TODO: Delete if unused
  // /**
  //  * Two dimensional array containing edge information.
  //  * `edgeInfo[i]` holds the edge information of all vertices of of order `i`. Each vertex holds
  //  * 2 * i + 1 integers of information.
  //  * */
  // edgeInfoO: number[][] = new Array(this.currentVertexOrder).fill([]).map(_ => []);
  // up = 0;

  /**
   * Holds information about the connections of each vertex. An entry at position `i` corresponds
   * to the vertex at the same position in the `verts` array. The size of the array at position `i`
   * is dependent on the order `p` of the vertex, with 2 * p integers of information.
   *
   * The first p integers of the i-th entry are the edges e(j, i), where j is the vertex index of
   * the j-th neighbor of vertex i. The last p integers correspond to the index of the current
   * vertex in the edge information of the neighbor vertex.
   *
   * Example: The vertex at position i is of order 3.
   * - verts[i]: Contains the position of the vertex
   * - vertOrder[i] = 3
   * - edgeInfo[i] = [
   *    n1,               // 1st neighbor
   *    n2,               // 2nd neighbor
   *    n3,               // 3rd neighbor
   *    index_in_n1, // Index of i in edgeInfo[n1]
   *    index_in_n2, // Index of i in edgeInfo[n2]
   *    index_in_n3  // Index of i in edgeInfo[n3]
   *   ]
   * */
  edgeInfo: number[][] = [];

  constructor(
    con: VContainer,
    particleInfo: { ijk: number; q: number; i: number; j: number; k: number }
  ) {
    this.#initialize(con, particleInfo);
  }

  /**
   * Initialize the cell as a rectangular box with the given dimensions.
   */
  #initBase(xmin: number, xmax: number, ymin: number, ymax: number, zmin: number, zmax: number) {
    // Add corners of box to stored vertices
    this.verts.push([xmin, ymin, zmin]); // 0
    this.verts.push([xmax, ymin, zmin]); // 1
    this.verts.push([xmin, ymax, zmin]); // 2
    this.verts.push([xmax, ymax, zmin]); // 3
    this.verts.push([xmin, ymin, zmax]); // 4
    this.verts.push([xmax, ymin, zmax]); // 5
    this.verts.push([xmin, ymax, zmax]); // 6
    this.verts.push([xmax, ymax, zmax]); // 7

    // Set vertex order to 3 for all vertices
    this.vertOrder = new Array(8).fill(3);

    // Push edge information for all initial vertices
    this.edgeInfo.push(
      [1, 4, 2, 2, 1, 0],
      [3, 5, 0, 2, 1, 0],
      [0, 6, 3, 2, 1, 0],
      [2, 7, 1, 2, 1, 0],
      [6, 0, 5, 2, 1, 0],
      [4, 1, 7, 2, 1, 0],
      [7, 2, 4, 2, 1, 0],
      [5, 3, 6, 2, 1, 0]
    );

    // // Push connection information for all initial vertices of initial vertex order 3
    // console.log(this.edgeInfoO);
    // this.edgeInfoO[3].push(
    //   ...[
    //     1, 4, 2, 2, 1, 0, 0, 3, 5, 0, 2, 1, 0, 1, 0, 6, 3, 2, 1, 0, 2, 2, 7, 1, 2, 1, 0, 3, 6, 0, 5,
    //     2, 1, 0, 4, 4, 1, 7, 2, 1, 0, 5, 7, 2, 4, 2, 1, 0, 6, 5, 3, 6, 2, 1, 0, 7,
    //   ]
    // );
  }

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

    // Init rectangular box with given dimensions
    this.#initBase(xmin, xmax, ymin, ymax, zmin, zmax);

    // TODO: Remove if not used anymore
    // ! Unused
    // Displacement
    const disp = ijk - i - con.nx * (j + con.ny * k);
    return disp;
  }
}
