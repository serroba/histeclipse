/** A model's geometries and materials given back to the GPU (#797), once it is no longer drawn. */

import { Mesh, type Object3D } from 'three';

export function releaseModel(root: Object3D): void {
  root.traverse((part) => {
    if (!(part instanceof Mesh)) return;
    const mesh = part as Mesh;
    mesh.geometry.dispose();
    for (const material of [mesh.material].flat()) material.dispose();
  });
}
