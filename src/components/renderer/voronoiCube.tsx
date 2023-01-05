import { Color } from 'three';

export const VoronoiCube = () => {
  return (
    <mesh>
      <boxGeometry args={[10, 10, 10]} />
      <meshPhongMaterial color={new Color(0.1, 0.1, 0.1)} opacity={0.5} transparent />
    </mesh>
  );
};
