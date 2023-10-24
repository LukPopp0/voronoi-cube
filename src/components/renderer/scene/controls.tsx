import { OrbitControls } from '@react-three/drei';

export const Controls = () => {
  return (
    <OrbitControls
      enablePan={false}
      enableZoom={true}
      minDistance={10}
      maxDistance={200}
      autoRotate={true}
    />
  );
};
