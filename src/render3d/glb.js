// Minimal GLB (glTF 2.0 binary) reader for the game's static models (D52, 2026-11-11): ONE mesh per file — POSITION,
// NORMAL, TEXCOORD_0, indices — and its embedded base-colour image (JPEG / PNG). No skins, no animations, no extensions:
// the models are prepared offline (simplified, texture 512 px) and animated procedurally in the game. Local files only.
import * as THREE from '../../lib/three.module.js';

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const ARRAYS = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };

/** Parses a GLB ArrayBuffer → { geometry, image (Blob|null) }. Throws on an unsupported file. */
export function parseGLB(buffer) {
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLen)));
  const binStart = 20 + jsonLen + 8;
  const view = (i) => {
    const bv = json.bufferViews[i];
    return { offset: binStart + (bv.byteOffset || 0), length: bv.byteLength, stride: bv.byteStride || 0 };
  };
  const read = (accIndex) => {
    const a = json.accessors[accIndex];
    const v = view(a.bufferView);
    const n = COMPONENTS[a.type], Arr = ARRAYS[a.componentType];
    const start = v.offset + (a.byteOffset || 0);
    if (v.stride && v.stride !== n * Arr.BYTES_PER_ELEMENT) { // interleaved → copy out
      const out = new Arr(a.count * n), src = new Arr(buffer);
      const step = v.stride / Arr.BYTES_PER_ELEMENT, base = start / Arr.BYTES_PER_ELEMENT;
      for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = src[base + i * step + k];
      return { array: out, n };
    }
    return { array: new Arr(buffer.slice(start, start + a.count * n * Arr.BYTES_PER_ELEMENT)), n };
  };
  const prim = json.meshes[0].primitives[0];
  const g = new THREE.BufferGeometry();
  const pos = read(prim.attributes.POSITION);
  g.setAttribute('position', new THREE.BufferAttribute(pos.array, 3));
  if (prim.attributes.NORMAL !== undefined) g.setAttribute('normal', new THREE.BufferAttribute(read(prim.attributes.NORMAL).array, 3));
  if (prim.attributes.TEXCOORD_0 !== undefined) g.setAttribute('uv', new THREE.BufferAttribute(read(prim.attributes.TEXCOORD_0).array, 2));
  if (prim.indices !== undefined) g.setIndex(new THREE.BufferAttribute(read(prim.indices).array, 1));
  if (!g.attributes.normal) g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  let image = null;
  const mat = json.materials && json.materials[prim.material || 0];
  const texRef = mat && mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture;
  if (texRef) {
    const img = json.images[json.textures[texRef.index].source];
    const v = view(img.bufferView);
    image = new Blob([new Uint8Array(buffer, v.offset, v.length)], { type: img.mimeType || 'image/jpeg' });
  }
  return { geometry: g, image };
}

/**
 * D56: a SKINNED GLB (one mesh + one skin, the keeper with his Tripo / Mixamo skeleton) → { root, mesh, bones, image }.
 * root — the node tree (bones are THREE.Bone, other nodes Groups) with the SkinnedMesh bound to its skeleton;
 * bones — Map of bone name → Bone. The material is set by the caller.
 */
export function parseSkinnedGLB(buffer) {
  const { geometry, image } = parseGLB(buffer);
  const dv = new DataView(buffer);
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLen)));
  const binStart = 20 + jsonLen + 8;
  const floats = (accIndex) => {
    const a = json.accessors[accIndex], bv = json.bufferViews[a.bufferView];
    const start = binStart + (bv.byteOffset || 0) + (a.byteOffset || 0);
    const n = COMPONENTS[a.type] || 16;
    return new Float32Array(buffer.slice(start, start + a.count * n * 4));
  };
  const intAttr = (accIndex) => {
    const a = json.accessors[accIndex], bv = json.bufferViews[a.bufferView];
    const start = binStart + (bv.byteOffset || 0) + (a.byteOffset || 0), Arr = ARRAYS[a.componentType];
    return new Arr(buffer.slice(start, start + a.count * 4 * Arr.BYTES_PER_ELEMENT));
  };
  const prim = json.meshes[0].primitives[0];
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(intAttr(prim.attributes.JOINTS_0), 4));
  const wa = json.accessors[prim.attributes.WEIGHTS_0];
  const w = wa.componentType === 5126 ? floats(prim.attributes.WEIGHTS_0) : Float32Array.from(intAttr(prim.attributes.WEIGHTS_0), (v) => v / (wa.componentType === 5121 ? 255 : 65535));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(w, 4));
  const skin = json.skins[0];
  const jointSet = new Set(skin.joints);
  const objs = json.nodes.map((n, i) => {
    const o = jointSet.has(i) ? new THREE.Bone() : new THREE.Group();
    o.name = n.name || '';
    if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
    else {
      if (n.translation) o.position.fromArray(n.translation);
      if (n.rotation) o.quaternion.fromArray(n.rotation);
      if (n.scale) o.scale.fromArray(n.scale);
    }
    return o;
  });
  json.nodes.forEach((n, i) => { for (const c of n.children || []) objs[i].add(objs[c]); });
  const root = new THREE.Group();
  for (const i of json.scenes[json.scene || 0].nodes) root.add(objs[i]);
  const meshNode = json.nodes.findIndex((n) => n.mesh === 0);
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  objs[meshNode].add(mesh);
  root.updateMatrixWorld(true);
  // The Tripo file's inverse bind matrices leave out the mesh node's own rotation (glTF ignores it for skinned
  // meshes, three.js applies it), so the skin and the bones would not line up once posed. The file's rest pose IS
  // its bind pose (T-pose), so the inverses are computed from the rest bones instead (Skeleton without inverses).
  const bones = skin.joints.map((i) => objs[i]);
  mesh.bind(new THREE.Skeleton(bones), mesh.matrixWorld);
  const byName = new Map();
  for (const b of bones) byName.set(b.name.replace(/^mixamorig:?/, ''), b);
  return { root, mesh, bones: byName, image };
}

/** Fetches + parses a local skinned GLB → { root, mesh, bones, texture } or null. */
export async function loadSkinnedGLB(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const m = parseSkinnedGLB(await r.arrayBuffer());
    return { ...m, texture: await blobTexture(m.image) };
  } catch (e) {
    return null;
  }
}

/** Image Blob → THREE.Texture (sRGB, mipmapped). Resolves null if the image cannot be decoded. */
export async function blobTexture(blob) {
  if (!blob) return null;
  try {
    const bmp = await createImageBitmap(blob);
    const tex = new THREE.Texture(bmp);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false; // glTF UVs have the origin at the top-left (the image is used as stored)
    tex.needsUpdate = true;
    return tex;
  } catch (e) {
    return null;
  }
}

/** Fetches + parses a local GLB. Resolves { geometry, texture } or null (missing / broken file → caller keeps its fallback). */
export async function loadGLB(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const { geometry, image } = parseGLB(await r.arrayBuffer());
    return { geometry, texture: await blobTexture(image) };
  } catch (e) {
    return null;
  }
}
