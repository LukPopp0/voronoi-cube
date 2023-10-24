import { useMemo } from 'react';
import { VoroCell } from 'voro3d';
import { DoubleSide, Vector3 } from 'three';
import { BufferGeomMesh } from '../geometries/bufferGeomMesh';
import { useVoronoiStore } from '../../store/store';

type CellProps = {
  cell: VoroCell;
};

export const Cell = ({ cell }: CellProps) => {
  const explosionAmount = useVoronoiStore(state => state.explosionAmount);
  const [normals, indices] = useMemo(() => {
    // Compute face normals for flat shading
    const faceNormals = cell.faces.map(f => {
      // Only 3 points necessary
      const vs = cell.vertices;
      const v0 = new Vector3(vs[3 * f[0]], vs[3 * f[0] + 1], vs[3 * f[0] + 2]);
      const v1 = new Vector3(vs[3 * f[1]], vs[3 * f[1] + 1], vs[3 * f[1] + 2]);
      const v2 = new Vector3(vs[3 * f[2]], vs[3 * f[2] + 1], vs[3 * f[2] + 2]);
      return v0.clone().sub(v1).cross(v0.sub(v2)).normalize();
    });

    // Convert polygons to triangles
    const indices = cell.faces.map(face => {
      const tris = [];
      for (let fvi = 1; fvi < face.length - 1; ++fvi) {
        tris.push(face[0], face[fvi], face[fvi + 1]);
      }
      return tris;
    });

    // Normals for each index
    const indexNormals = indices.map((ipf, fi) =>
      new Array(ipf.length)
        .fill([])
        .map(() => [faceNormals[fi].x, faceNormals[fi].y, faceNormals[fi].z])
        .flat()
    );
    return [indexNormals.flat(), indices.flat()];
  }, [cell.faces, cell.vertices]);

  return (
    <BufferGeomMesh
      position={[explosionAmount * cell.x, explosionAmount * cell.y, explosionAmount * cell.z]}
      vertices={cell.vertices}
      indices={indices}
      normals={normals}
    >
      <meshPhongMaterial side={DoubleSide} color="#555555" flatShading={true} />
    </BufferGeomMesh>
  );
};
