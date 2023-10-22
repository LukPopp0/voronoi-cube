import { Color } from 'three';

type VoronoiCubeProps = {
  size?: number;
};

export const VoronoiCube = ({ size = 10 }: VoronoiCubeProps) => {
  return (
    <mesh>
      <boxGeometry args={[size, size, size]} />
      <meshPhongMaterial color={new Color(0.1, 0.1, 0.1)} opacity={0.5} transparent />
    </mesh>
  );
};
