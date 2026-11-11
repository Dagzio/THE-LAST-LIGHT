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
