import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Color, MeshStandardMaterial, PointLight } from 'three';
import { useVoronoiStore } from '../../../store/store';

type InnerCubeProps = {
  size?: number;
};

export const InnerCube = ({ size = 10 }: InnerCubeProps) => {
  const mat = useRef<MeshStandardMaterial>(null);
  const hue = useRef<number>(0);
  const pointLight = useRef<PointLight>(null);
  const innerCubeSize = useVoronoiStore(s => s.debugSettings.innerCubeSize);
  const showInnerCube = useVoronoiStore(s => s.debugSettings.showInnerCube);
  const debug = useVoronoiStore(s => s.debug);

  useFrame((_, delta) => {
    hue.current += (delta / 20) % 1.0;

    if (!pointLight.current) return;
    pointLight.current.color.setHSL(hue.current, 1, 0.55);

    if (!mat.current) return;
    mat.current.emissive.setHSL(hue.current, 1, 0.55);
  });

  return (
    <>
      {showInnerCube && (
        <mesh name="innerCube">
          <boxGeometry args={[size * innerCubeSize, size * innerCubeSize, size * innerCubeSize]} />
          <meshStandardMaterial
            ref={mat}
            color={new Color(1.0, 1.0, 1.0)}
            emissive={new Color(1.0, 0.1, 0.1)}
            opacity={debug ? 0.5 : 1.0}
            transparent={debug}
          />
        </mesh>
      )}
      <pointLight ref={pointLight} intensity={100} />
    </>
  );
};
