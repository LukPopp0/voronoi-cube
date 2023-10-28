import { useCallback, useContext } from 'react';
import { SceneContext } from '../../hooks/sceneContext';
import { Group, Mesh, Scene } from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { CSG } from 'three-csg-ts';

const download = (filename: string, text: string) => {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
};

export const DownloadButton = () => {
  const scene = useContext(SceneContext);
  const downloadVoronoi = useCallback(() => {
    const voronoiCube = (scene as Scene).getObjectByName('voronoiCube');
    const innerCube = (scene as Scene).getObjectByName('innerCube');
    if (!voronoiCube || !innerCube) return;
    const group = new Group();
    voronoiCube.children.forEach(part => {
      if (part.type === 'Mesh') group.add(CSG.subtract(part as Mesh, innerCube as Mesh));
    });
    const data = new STLExporter().parse(group);
    download('voronoi.stl', data);
  }, [scene]);
  return <button onClick={() => downloadVoronoi()}>Download</button>;
};
