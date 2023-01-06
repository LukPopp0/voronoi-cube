import { ReactElement, useEffect, useRef } from 'react';
import { BufferAttribute, Points } from 'three';

type BufferGeomPointsProps = {
  children?: ReactElement | ReactElement[];
  positions?: Float32Array;
} & JSX.IntrinsicElements['points'];
export const BufferGeomPoints = ({ children, positions, ...pointProps }: BufferGeomPointsProps) => {
  const points = useRef<Points>(null);

  useEffect(() => {
    if (points.current && positions) {
      points.current.geometry.deleteAttribute('position');
      points.current.geometry.setAttribute('position', new BufferAttribute(positions, 3));
    }
  }, [positions]);

  return (
    <points ref={points} {...pointProps}>
      {children}
    </points>
  );
};
