import { useCallback, useContext } from 'react';
import { SceneContext } from '../../hooks/sceneContext';
import { Scene } from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';

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
    if (!voronoiCube) return;
    const data = new OBJExporter().parse(voronoiCube);
    download('voronoi.obj', data);
  }, [scene]);
  return <button onClick={() => downloadVoronoi()}>Download</button>;
};
