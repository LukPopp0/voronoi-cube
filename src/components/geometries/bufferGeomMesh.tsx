import { ReactElement, useEffect, useRef } from 'react';
import { BufferAttribute, Mesh } from 'three';

type BufferGeomMeshProps = {
  children?: ReactElement | ReactElement[];
  positions?: Float32Array;
} & JSX.IntrinsicElements['mesh'];
export const BufferGeomMesh = ({ children, positions, ...meshProps }: BufferGeomMeshProps) => {
  const mesh = useRef<Mesh>(null);

  useEffect(() => {
    if (mesh.current && positions) {
      mesh.current.geometry.deleteAttribute('position');
      mesh.current.geometry.setAttribute('position', new BufferAttribute(positions, 3));
    }
  }, [positions]);

  return (
    <mesh ref={mesh} {...meshProps}>
      {children}
    </mesh>
  );
};
