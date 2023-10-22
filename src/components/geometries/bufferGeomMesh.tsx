import { ReactElement, useEffect, useRef } from 'react';
import { BufferAttribute, Mesh } from 'three';

type BufferGeomMeshProps = {
  children?: ReactElement | ReactElement[];
  vertices: number[];
  indices?: number[];
  normals?: number[];
} & JSX.IntrinsicElements['mesh'];
export const BufferGeomMesh = ({
  children,
  vertices,
  indices,
  normals,
  ...meshProps
}: BufferGeomMeshProps) => {
  const mesh = useRef<Mesh>(null);
  const MAX_POINTS = 50;

  // ----------
  // POSITION
  // ----------
  useEffect(() => {
    if (!mesh.current) return;
    if (!mesh.current.geometry.hasAttribute('position')) {
      const positions = new Float32Array(MAX_POINTS * 3);
      mesh.current.geometry.setAttribute('position', new BufferAttribute(positions, 3));
    }

    const pos = mesh.current.geometry.getAttribute('position');
    for (let i = 0; i < vertices.length / 3; ++i) {
      pos.setXYZ(i, vertices[3 * i], vertices[3 * i + 1], vertices[3 * i + 2]);
    }
    pos.needsUpdate = true;
    mesh.current.geometry.setDrawRange(0, vertices.length / 3);
    if (typeof indices === 'undefined') mesh.current.geometry.setDrawRange(0, vertices.length / 3);
  }, [indices, vertices]);

  // ----------
  // INDEX
  // ----------
  useEffect(() => {
    if (!mesh.current || typeof indices === 'undefined' || indices.length < 1) return;
    mesh.current.geometry.setIndex(indices);
    mesh.current.geometry.setDrawRange(0, indices.length);
  }, [indices]);

  // ----------
  // NORMAL
  // ----------
  useEffect(() => {
    if (!mesh.current) return;
    if (typeof normals === 'undefined' || normals.length === 0) {
      mesh.current.geometry.computeVertexNormals();
    } else {
      mesh.current.geometry.setAttribute(
        'normal',
        new BufferAttribute(new Float32Array(normals), 3)
      );
    }
  }, [vertices, indices, normals]);

  return (
    <mesh ref={mesh} {...meshProps}>
      <bufferGeometry attach="geometry" />
      {children}
    </mesh>
  );
};
