import { Color } from 'three';

export const VoronoiCube = () => {
  return (
    <mesh>
      <boxGeometry args={[10, 10, 10]} />
      <meshPhongMaterial color={new Color(0.8, 0.8, 0.8)} />
    </mesh>
  );
};
