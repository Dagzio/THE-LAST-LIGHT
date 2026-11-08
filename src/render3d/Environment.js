// Map environment in 3D: painted ground (theme, D45), dark water / rock around the map, merged decorative props.
// Ground texture is painted once on a CPU canvas (render-guard rule 1: survives a GPU-process restart).
// Props block movement and bullets since D40 (colliders from the same layout); all static props = one draw call.
import * as THREE from '../../lib/three.module.js';
import { cpuCanvas } from './render-guard.js';
import { mergeParts, propParts, tag } from './models.js';
import { layoutProps } from '../systems/Props.js';
import { paintMapGround } from '../render/MapPainter.js';
import { getTheme } from '../data/themes.js';

const TEX_W = 2048;

/** Ground texture of a map (painter shared with the map-select preview). */
function paintGround(map) {
  const texH = Math.round((TEX_W * map.height) / map.width);
  const { canvas, g } = cpuCanvas(TEX_W, texH);
  const k = TEX_W / map.width; // texture px per world unit
  g.scale(k, k);
  paintMapGround(g, map);
  return canvas;
}

/**
 * @param {object} map entry of data/maps.js
 * @returns {{group: THREE.Group, groundTexture: THREE.Texture, dispose: () => void}}
 */
export function buildEnvironment(map, materials) {
  const group = new THREE.Group();
  const mapW = map.width, mapH = map.height;

  // Ground
  const tex = new THREE.CanvasTexture(paintGround(map));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const groundMat = new THREE.MeshLambertMaterial({ map: tex });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(mapW, mapH), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(mapW / 2, 0, mapH / 2);
  ground.receiveShadow = true;
  group.add(tag(ground, 'ground'));

  // Dark shallow water / wet rock around the map (decorative surround, also under the fog)
  const shoreMat = new THREE.MeshLambertMaterial({ color: getTheme(map.theme).shore });
  const shore = new THREE.Mesh(new THREE.PlaneGeometry(mapW + 3000, mapH + 3000), shoreMat);
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(mapW / 2, -2, mapH / 2);
  group.add(shore);

  // Props from the shared layout (systems/Props.js): the simulation builds its colliders from the same list (D40).
  const parts = [];
  for (const prop of layoutProps(map)) parts.push(...propParts(prop));
  const props = new THREE.Mesh(mergeParts(parts), materials.prop);
  props.castShadow = true;
  props.receiveShadow = true;
  group.add(tag(props, 'props'));

  return {
    group,
    groundTexture: tex,
    dispose() {
      ground.geometry.dispose(); groundMat.dispose(); tex.dispose();
      shore.geometry.dispose(); shoreMat.dispose();
      props.geometry.dispose();
    },
  };
}
