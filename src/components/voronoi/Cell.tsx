import { useMemo } from 'react';
import { VoroCell } from 'voro3d';
import { BufferGeometry, Mesh, Vector3 } from 'three';
import { BufferGeomMesh } from '../geometries/bufferGeomMesh';
import { useVoronoiStore } from '../../store/store';
import { mapLinear } from 'three/src/math/MathUtils';
import { getFaceCenter, getFaceNormal, polygonToTriangles } from '../../utils/geometryHelper';

type CellProps = {
  cell: VoroCell;
};

export const Cell = ({ cell }: CellProps) => {
  const explosionAmount = useVoronoiStore(state => state.explosionAmount);
  const size = useVoronoiStore(state => state.pointDistribution.size);
  const reduction = useVoronoiStore(state => state.crackSize);

  const triangleIndices = useMemo(() => cell.faces.map(polygonToTriangles), [cell.faces]);
  const faceNormals = useMemo(() => {
    const fns: Vector3[] = new Array(cell.faces.length);
    for (let fi = 0; fi < cell.faces.length; ++fi) {
      fns[fi] = getFaceNormal(cell.faces[fi], cell.vertices);
    }
    return fns;
  }, [cell.faces, cell.vertices]);
  const faceCenters = useMemo(() => {
    const fcs: Vector3[] = new Array(cell.faces.length);
    for (let fi = 0; fi < cell.faces.length; ++fi) {
      fcs[fi] = getFaceCenter(cell.faces[fi], cell.vertices);
    }
    return fcs;
  }, [cell.faces, cell.vertices]);

  const cutMeshes = faceCenters.map((fc, i) => {
    console.log({ fcx: fc.x, fcy: fc.y, fcz: fc.z, x: cell.x, y: cell.y, z: cell.z });
    console.log(fc);
    return (
      <mesh
        key={i}
        position={[fc.x + cell.x, fc.y + cell.y, fc.z + cell.z]}
        onUpdate={self =>
          self.lookAt(faceNormals[i].add(fc).add(new Vector3(cell.x, cell.y, cell.z)))
        }
      >
        <boxGeometry args={[0.2 * size, 0.2 * size, reduction]} />
        <meshPhongMaterial />
      </mesh>
    );
  });

  return (
    <>
      <BufferGeomMesh
        position={[explosionAmount * cell.x, explosionAmount * cell.y, explosionAmount * cell.z]}
        vertices={cell.vertices}
        indices={triangleIndices.flat().flat()}
      >
        <meshPhongMaterial color="#555555" flatShading={true} transparent={true} opacity={0.95} />
      </BufferGeomMesh>
      {cutMeshes}
    </>
  );
};
