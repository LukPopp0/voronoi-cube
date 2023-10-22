import { Canvas } from '@react-three/fiber';
import { initialCameraPosition } from '../../constants';
import { MyScene } from './scene/myScene';
import './renderer.scss';
import { useState } from 'react';

const baseSpeed = 0.25;

export const Renderer = () => {
  const [rotationSpeed, setRotationSpeed] = useState<number>(baseSpeed);

  return (
    <div className="renderer-container">
      <Canvas
        onPointerDown={() => {
          setRotationSpeed(0);
          document.addEventListener('pointerup', () => setRotationSpeed(baseSpeed), { once: true });
        }}
        camera={{
          position: initialCameraPosition.clone(),
        }}
      >
        <color attach="background" args={['#e6e6e6']} />
        <MyScene rotationSpeed={rotationSpeed} />
      </Canvas>
    </div>
  );
};
