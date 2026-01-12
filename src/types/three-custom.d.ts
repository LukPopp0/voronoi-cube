import type { ThreeElement } from '@react-three/fiber';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import type { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';
import type { Line2 } from 'three/examples/jsm/lines/Line2';
import type { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2';
import type { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry';

declare module '@react-three/fiber' {
  interface ThreeElements {
    line2: ThreeElement<typeof Line2>;
    lineSegments2: ThreeElement<typeof LineSegments2>;
    lineMaterial: ThreeElement<typeof LineMaterial>;
    lineSegmentsGeometry: ThreeElement<typeof LineSegmentsGeometry>;
    lineGeometry: ThreeElement<typeof LineGeometry>;
  }
}
