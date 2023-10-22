import { useFrame } from '@react-three/fiber';
import { ReactElement, useRef } from 'react';
import { Group } from 'three';

type ModelGroupProps = {
  children: ReactElement | ReactElement[];
  rotationSpeed?: number;
};

export const ModelGroup = ({ children, rotationSpeed = 0 }: ModelGroupProps) => {
  const g = useRef<Group>(null);

  useFrame((state, d) => {
    if (!g.current) return;
    g.current.rotation.y += d * rotationSpeed;
  });

  return <group ref={g}>{children}</group>;
};
