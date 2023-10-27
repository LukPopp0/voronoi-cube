import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Color, MeshStandardMaterial, PointLight } from 'three';

type InnerCubeProps = {
  size?: number;
};

export const InnerCube = ({ size = 10 }: InnerCubeProps) => {
  const mat = useRef<MeshStandardMaterial>(null);
  const pointLight = useRef<PointLight>(null);

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
        <boxGeometry args={[size * 0.75, size * 0.75, size * 0.75]} />
        <meshStandardMaterial
          ref={mat}
          color={new Color(1.0, 1.0, 1.0)}
          emissive={new Color(1.0, 0.1, 0.1)}
        />
      </mesh>
      <pointLight ref={pointLight} />
    </>
  );
};
