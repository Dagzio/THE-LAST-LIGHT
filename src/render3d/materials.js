// Shared materials, created once (H5 3D guide §4.2: shared resources). Used by the game renderer and the dev
// asset viewer, so the viewer shows exactly what the player sees.
import * as THREE from '../../lib/three.module.js';
import { cpuCanvas, overlayTextures } from './render-guard.js';

export function createMaterials() {
  // Soft round blob shadow (Low preset: no shadow map). Colour + alpha split → a failed upload is transparent, not black.
  const { canvas, g } = cpuCanvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 31);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const blob = overlayTextures(THREE, canvas);

  return {
    character: new THREE.MeshLambertMaterial({ vertexColors: true }),
    prop: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    eyes: new THREE.MeshBasicMaterial({ color: 0xff7a4a }),
    eyesBoss: new THREE.MeshBasicMaterial({ color: 0xc69cff }),
    eyesSpitter: new THREE.MeshBasicMaterial({ color: 0xb6ff6a }),   // D45: venom green
    eyesMother: new THREE.MeshBasicMaterial({ color: 0x8fe8ff }),    // D45: cold cyan
    glob: new THREE.MeshBasicMaterial({ color: 0xa6f05a }),
    summonFill: new THREE.MeshBasicMaterial({ color: 0x6a3cff, transparent: true, opacity: 0.3, depthWrite: false }),
    // Boss telegraphs: red danger zone (normal blending — readable on any ground), violet impact flash.
    telegraphFill: new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.3, depthWrite: false }),
    telegraphEdge: new THREE.MeshBasicMaterial({ color: 0xff6a4a, transparent: true, opacity: 0.85, depthWrite: false }),
    // Phase 6: crate glow, grenade aim (dotted arc + landing ring), blast and fire-zone effects
    crateGlow: new THREE.MeshBasicMaterial({
      color: 0xffd27a, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
    grenadeAim: new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.9, depthWrite: false }),
    grenadeAimRing: new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.75, depthWrite: false }),
    grenadeBody: new THREE.MeshLambertMaterial({ vertexColors: true }),
    blast: new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    fire: new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
    impact: new THREE.MeshBasicMaterial({
      color: 0xc9a0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    lantern: new THREE.MeshBasicMaterial({ color: 0xffd38a }),
    bullet: new THREE.MeshBasicMaterial({ color: 0xffd27a, vertexColors: true }),
    muzzle: new THREE.MeshBasicMaterial({
      color: 0xffdf9a, vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
    ghost: new THREE.MeshBasicMaterial({ color: 0x9fb0d8, transparent: true, opacity: 0.22, depthWrite: false }),
    reticle: new THREE.MeshBasicMaterial({ color: 0xffe2b0, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }),
    lanternGlass: new THREE.MeshBasicMaterial({ color: 0xffc46a, vertexColors: true }),
    beam: new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
    crystal: new THREE.MeshBasicMaterial({ color: 0x9fe4ff, vertexColors: true }),
    frostRing: new THREE.MeshBasicMaterial({
      color: 0x8fd4ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
    padRune: new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.35, depthWrite: false }),
    reload: new THREE.MeshBasicMaterial({ color: 0xffd27a, depthWrite: false, transparent: true }),
    hpBack: new THREE.MeshBasicMaterial({ color: 0x0b0c0f, transparent: true, opacity: 0.75, depthWrite: false }),
    hpFill: new THREE.MeshBasicMaterial({ color: 0xd2453a, depthWrite: false, transparent: true }),
    blob: new THREE.MeshBasicMaterial({ map: blob.map, alphaMap: blob.alphaMap, color: 0x000000, transparent: true, depthWrite: false }),
    particles: new THREE.PointsMaterial({
      size: 5, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }),
  };
}
