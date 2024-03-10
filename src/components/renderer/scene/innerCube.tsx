import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Color, MeshStandardMaterial, PointLight } from 'three';
import { useVoronoiStore } from '../../../store/store';

type InnerCubeProps = {
  size?: number;
};

export const InnerCube = ({ size = 10 }: InnerCubeProps) => {
  const mat = useRef<MeshStandardMaterial>(null);
  const pointLight = useRef<PointLight>(null);
  const innerCubeSize = useVoronoiStore(s => s.innerCubeSize);

  useFrame((_, delta) => {
    if (!mat.current) return;
    const newColor = mat.current.emissive.getHSL({ h: 0, s: 0, l: 0 });
    newColor.h += delta / 20;
    mat.current.emissive.setHSL(newColor.h, newColor.s, newColor.l);

    if (!pointLight.current) return;
    pointLight.current.color.setHSL(newColor.h, newColor.s, newColor.l);
  });

  return (
    <>
      <mesh name="innerCube">
        <boxGeometry args={[size * innerCubeSize, size * innerCubeSize, size * innerCubeSize]} />
        <meshStandardMaterial
          ref={mat}
          color={new Color(1.0, 1.0, 1.0)}
          emissive={new Color(1.0, 0.1, 0.1)}
        />
      </mesh>
      <pointLight ref={pointLight} intensity={3} />
    </>
  );
};
