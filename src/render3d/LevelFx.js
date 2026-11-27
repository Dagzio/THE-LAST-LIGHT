// D148 (Marseille, levels 2–3): light effects of the story levels — presentation only, read from the run each frame:
//   - the cleaners' gun torches: a soft light wedge on the floor ahead of each (one instanced mesh);
//   - searchlights (systems/Searchlights.js): the lit circle on the ground and its beam from the helicopter / the tower
//     top (reddening as it locks on the hero);
//   - the crane sniper: his red laser to the hero while he aims (brighter as the shot nears), the scope's glint.
// Additive, no shadows, no depth writes; 4 draw calls at most, none when the level has none of these.
import * as THREE from '../../lib/three.module.js';
import { cpuCanvas } from './render-guard.js';

const MAX_CONES = 24, MAX_LIGHTS = 8, MAX_LASERS = 4;
const P = new THREE.Vector3(), S = new THREE.Vector3(), Q = new THREE.Quaternion(), M = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0), DIR = new THREE.Vector3(), C = new THREE.Color();
const CONE = { len: 230, width: 150, y: 0.9 };   // the torch's wedge on the floor (units)
const BEAM_FROM = { heli: [-260, 620, 300], sweep: null }; // the helicopter's lamp: up there, south-west of its circle

function texture(paint, size = 128) {
  const { canvas, g } = cpuCanvas(size, size);
  paint(g, size);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class LevelFx {
  constructor(scene) {
    const add = (o) => { o.frustumCulled = false; o.count = 0; o.castShadow = o.receiveShadow = false; scene.add(o); return o; };
    // the torch's wedge: brightest a little ahead of the gun, soft at its far end and sides
    const wedge = texture((g, n) => {
      g.filter = 'blur(5px)';
      g.beginPath(); g.moveTo(6, n / 2 - 4); g.lineTo(n - 6, 10); g.lineTo(n - 6, n - 10); g.lineTo(6, n / 2 + 4); g.closePath();
      const gr = g.createRadialGradient(4, n / 2, 2, 4, n / 2, n);
      gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fill();
    });
    const cg = new THREE.PlaneGeometry(1, 1); cg.rotateX(-Math.PI / 2); cg.translate(0.5, 0, 0);
    this.cones = add(new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ map: wedge, color: 0xfff0cf, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }), MAX_CONES));
    this.cones.renderOrder = 2;
    // a searchlight's circle on the ground
    const disc = texture((g, n) => {
      const gr = g.createRadialGradient(n / 2, n / 2, 2, n / 2, n / 2, n / 2 - 1);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.85, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    });
    const dg = new THREE.PlaneGeometry(1, 1); dg.rotateX(-Math.PI / 2);
    this.discs = add(new THREE.InstancedMesh(dg, new THREE.MeshBasicMaterial({ map: disc, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }), MAX_LIGHTS));
    this.discs.renderOrder = 2;
    this.discs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_LIGHTS * 3).fill(1), 3);
    // its beam: an open cone from the lamp to the circle, fading upwards
    const fade = texture((g, n) => {
      const gr = g.createLinearGradient(0, 0, 0, n);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.85)');
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    }, 64);
    const bg = new THREE.CylinderGeometry(0.05, 1, 1, 20, 1, true); bg.translate(0, 0.5, 0);
    this.beams = add(new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ map: fade, color: 0xfff3dc, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), MAX_LIGHTS));
    this.beams.renderOrder = 8;
    // the sniper's laser (a thin bar along +x) and the glint of his scope (a star turned to the camera by the caller)
    const lg = new THREE.BoxGeometry(1, 0.7, 0.7); lg.translate(0.5, 0, 0);
    this.lasers = add(new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: 0xff2a1e, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }), MAX_LASERS));
    this.lasers.renderOrder = 9;
    const star = texture((g, n) => {
      const c = n / 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,240,220,0.9)'); gr.addColorStop(0.4, 'rgba(255,200,160,0.25)'); gr.addColorStop(1, 'rgba(255,200,160,0)');
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(c - 1.5, 4, 3, n - 8); g.fillRect(4, c - 1.5, n - 8, 3);
    }, 64);
    this.glints = add(new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: star, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }), MAX_LASERS));
    this.glints.renderOrder = 16;
  }

  /**
   * @param {object} run  the mission run
   * @param {number} time game clock
   * @param {(e:object)=>{x:number,y:number}} posOf interpolated enemy position
   * @param {(x:number,y:number)=>boolean} onScreen
   * @param {(x:number,y:number)=>number} elevAt ground height at a point
   * @param {THREE.Quaternion} faceCam the camera-facing turn (glints)
   * @param {{x:number,y:number}} hero interpolated hero position
   */
  sync(run, time, posOf, onScreen, elevAt, faceCam, hero) {
    let cones = 0, lasers = 0, glints = 0, lights = 0;
    for (const e of run.enemies) {
      if (!e.alive) continue;
      const t = e.type;
      if (t.flashlight && cones < MAX_CONES) {
        const at = posOf(e);
        if (onScreen(at.x, at.y)) {
          const flick = 1 + 0.03 * Math.sin(time * 23 + e.id); // a torch, not a lamp: a little life in it
          P.set(at.x + Math.cos(e.faceAngle) * 10, CONE.y + elevAt(at.x, at.y), at.y + Math.sin(e.faceAngle) * 10);
          Q.setFromAxisAngle(UP, -e.faceAngle); S.set(CONE.len * flick, 1, CONE.width);
          M.compose(P, Q, S); this.cones.setMatrixAt(cones++, M);
        }
      }
      if (t.sniper && e.active && lasers < MAX_LASERS) {
        const at = posOf(e), ai = e.ai, eh = (e.elev || 0) + 44;
        if (ai.aim > 0.02 && run.player.alive) {
          // from his scope to the hero's chest
          P.set(at.x + Math.cos(e.faceAngle) * 12, eh, at.y + Math.sin(e.faceAngle) * 12);
          DIR.set(hero.x, 41 + elevAt(hero.x, hero.y), hero.y).sub(P);
          const len = DIR.length();
          DIR.normalize();
          Q.setFromUnitVectors(X_AXIS, DIR); S.set(len, 1 + ai.aim * 1.6, 1 + ai.aim * 1.6);
          M.compose(P, Q, S); this.lasers.setMatrixAt(lasers++, M);
        }
        // the glint: always there once he is awake (where he is), brighter and faster as he aims
        const k = ai.aim > 0 ? 0.6 + 0.4 * Math.abs(Math.sin(time * (6 + ai.aim * 14))) : Math.max(0, Math.sin(time * 2.6 + e.id)) ** 6;
        if (k > 0.02) {
          P.set(at.x + Math.cos(e.faceAngle) * 12, eh + 3, at.y + Math.sin(e.faceAngle) * 12);
          S.setScalar(16 + k * 26); M.compose(P, faceCam, S); this.glints.setMatrixAt(glints++, M);
        }
      }
    }
    const L = run.mode && run.mode.searchlights;
    if (L) {
      for (const s of L) {
        if (!s.on || lights >= MAX_LIGHTS) continue;
        const r = s.r, hot = s.hot;
        P.set(s.x, 1.2 + elevAt(s.x, s.y), s.y); Q.identity(); S.set(r * 2.3, 1, r * 2.3);
        M.compose(P, Q, S); this.discs.setMatrixAt(lights, M);
        C.setRGB(1, 1 - 0.55 * hot, 1 - 0.7 * hot); this.discs.setColorAt(lights, C);
        // the beam: from the lamp (the helicopter up south-west, the tower's top) down to the circle
        const D = s.def, src = D.kind === 'heli' ? [s.x + BEAM_FROM.heli[0], BEAM_FROM.heli[1], s.y + BEAM_FROM.heli[2]] : [D.x, D.top || 320, D.y];
        DIR.set(src[0] - s.x, src[1], src[2] - s.y);
        const len = DIR.length(); DIR.normalize();
        P.set(s.x, 0, s.y); Q.setFromUnitVectors(UP, DIR); S.set(r * 0.85, len, r * 0.85);
        M.compose(P, Q, S); this.beams.setMatrixAt(lights, M);
        lights++;
      }
    }
    this.cones.count = cones; this.lasers.count = lasers; this.glints.count = glints;
    this.discs.count = this.beams.count = lights;
    for (const im of [this.cones, this.lasers, this.glints, this.discs, this.beams]) im.instanceMatrix.needsUpdate = true;
    if (lights) this.discs.instanceColor.needsUpdate = true;
  }

  hide() { this.cones.count = this.lasers.count = this.glints.count = this.discs.count = this.beams.count = 0; }
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
