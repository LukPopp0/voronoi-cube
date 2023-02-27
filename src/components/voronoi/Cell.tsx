import { useMemo } from 'react';
import { VCell } from '../../utils/voronoi';
import { LineGeometry } from '../geometries/lineGeometry';

type CellProps = {
  cell: VCell;
};
export const Cell = ({ cell }: CellProps) => {
  const vertices: number[] = useMemo(() => {
    // Convert cell edge info to individual edges (as `edgeInfo` contains double edges)
    const individualEdges: Record<number, number[]> = [];
    let edgeEnd: number;
    cell.edgeInfo.forEach((edgeConnections, edgeStart) => {
      for (let conIdx = 0; conIdx < cell.vertOrder[edgeStart]; ++conIdx) {
        edgeEnd = edgeConnections[conIdx];
        const sm = edgeStart < edgeEnd ? edgeStart : edgeEnd;
        const bg = sm === edgeStart ? edgeEnd : edgeStart;

        if (!individualEdges[sm]) individualEdges[sm] = [bg];
        else if (!individualEdges[sm].includes(bg)) individualEdges[sm].push(bg);
      }
    });

    // Add positional data of edge pairs
    const v: number[] = [];
    for (const edgeStart in individualEdges) {
      individualEdges[edgeStart].forEach(edgeEnd => {
        v.push(...cell.verts[edgeStart], ...cell.verts[edgeEnd]);
      });
    }
    console.log({ individualEdges, v });
    return v;
  }, [cell]);
  return <LineGeometry vertices={vertices} />;
};
