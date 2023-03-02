import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry';
import { extend, invalidate, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { InstancedInterleavedBuffer, InterleavedBufferAttribute, Vector2 } from 'three';

extend({ LineSegments2, LineMaterial, Line2, LineSegmentsGeometry });

type LineGeometryProps = {
  vertices: number[];
};
export const LineGeometry = ({ vertices }: LineGeometryProps) => {
  const { size } = useThree();
  const lineSegments = useRef<LineSegments2>(null);

  useEffect(() => {
    const newGeom = new LineSegmentsGeometry();
    const instanceBuffer = new InstancedInterleavedBuffer(new Float32Array(vertices), 6, 1);
    const instanceStart = new InterleavedBufferAttribute(instanceBuffer, 3, 0);
    const instanceEnd = new InterleavedBufferAttribute(instanceBuffer, 3, 3);
    newGeom.setAttribute('instanceStart', instanceStart);
    newGeom.setAttribute('instanceEnd', instanceEnd);

    if (lineSegments.current) {
      lineSegments.current.geometry.dispose();
      lineSegments.current.geometry = newGeom;
      invalidate();
    }
  }, [vertices]);

  return (
    <lineSegments2 ref={lineSegments} /*visible={visible}*/>
      <lineMaterial
        color={'#8844ff'}
        worldUnits={true}
        linewidth={0.5}
        resolution={new Vector2(size.width, size.height)}
      />
    </lineSegments2>
  );
};
