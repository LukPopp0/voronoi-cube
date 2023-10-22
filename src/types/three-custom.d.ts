import { ReactThreeFiber } from '@react-three/fiber';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      line2: ReactThreeFiber.Object3DNode<Line2, typeof Line2>;
      lineSegments2: ReactThreeFiber.Object3DNode<LineSegments2, typeof LineSegments2>;
      lineMaterial: ReactThreeFiber.Object3DNode<LineMaterial, typeof LineMaterial>;
      lineSegmentsGeometry: ReactThreeFiber.Object3DNode<
        LineSegmentsGeometry,
        typeof LineSegmentsGeometry
      >;
      lineGeometry: ReactThreeFiber.Object3DNode<LineGeometry, typeof LineGeometry>;
    }
  }
}
