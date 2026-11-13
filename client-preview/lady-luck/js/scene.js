/* ═══════════════════════════════════════════════════════════
   LADY LUCK — hero scene
   A wall of neon tattoo flash, lit and buzzing in the dark.
   Built entirely from three.js tube geometry — no images,
   no post-processing, no add-ons.
   ═══════════════════════════════════════════════════════════ */

import * as THREE from '../vendor/three/three.module.js';

const canvas = document.getElementById('scene');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const C = {
  pink: 0xff2e88,
  hot: 0xff5fa8,
  cyan: 0x29f0e0,
  acid: 0xc8ff3d,
  violet: 0x9d6bff,
  white: 0xfff5f0,
};

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (err) {
  document.body.classList.add('no-webgl');
  console.warn('WebGL unavailable', err);
}

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050507);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
  camera.position.set(0, 0, 10);

  const wall = new THREE.Group();
  wall.position.set(3.55, 0.1, 0);
  scene.add(wall);

  /* ── helpers ────────────────────────────────────────── */
  const white = new THREE.Color(0xffffff);
  const neonFlash = [];   // things that flicker
  let elapsed = 0;

  function makeCurve(points, closed) {
    const vecs = points.map((p) => new THREE.Vector3(p[0], p[1], 0));
    return new THREE.CatmullRomCurve3(vecs, closed, 'catmullrom', 0.5);
  }

  function neon(points, {
    color = C.pink, radius = 0.0125, closed = false,
    z = 0, scale = 1, position = [0, 0], parent = wall,
    glow = 1, name = ''
  } = {}) {
    const curve = makeCurve(points, closed);
    const len = curve.getLength();
    const seg = Math.max(40, Math.min(420, Math.round(len * 70)));

    const g = new THREE.Group();
    g.position.set(position[0], position[1], z);
    g.scale.setScalar(scale);

    const base = new THREE.Color(color);
    const coreCol = base.clone().lerp(white, 0.45);

    const coreMat = new THREE.MeshBasicMaterial({ color: coreCol, transparent: true, opacity: 1, toneMapped: false });
    const midMat = new THREE.MeshBasicMaterial({
      color: base, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false
    });
    const wideMat = new THREE.MeshBasicMaterial({
      color: base, transparent: true, opacity: 0.045 + 0.03 * glow, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false
    });

    const coreGeo = new THREE.TubeGeometry(curve, seg, radius, 6, closed);
    const midGeo = new THREE.TubeGeometry(curve, Math.round(seg * 0.7), radius * 2.6, 6, closed);
    const wideGeo = new THREE.TubeGeometry(curve, Math.round(seg * 0.5), radius * 6, 6, closed);

    g.add(new THREE.Mesh(wideGeo, wideMat));
    g.add(new THREE.Mesh(midGeo, midMat));
    g.add(new THREE.Mesh(coreGeo, coreMat));

    parent.add(g);

    const st = stateFor(name || 'anon');
    neonFlash.push({
      group: g, name,
      core: coreMat, mid: midMat, wide: wideMat,
      coreBase: coreCol.clone(),
      midOpacity: midMat.opacity,
      wideOpacity: wideMat.opacity,
      state: st
    });

    return g;
  }

  const flickerState = new Map();
  function stateFor(name) {
    let s = flickerState.get(name);
    if (!s) {
      s = {
        seed: Math.random() * 100,
        start: 0.2 + Math.random() * 1.4,
        offUntil: 0,
        boost: 0
      };
      flickerState.set(name, s);
    }
    return s;
  }

  /* ── geometry builders ──────────────────────────────── */
  function circlePts(cx, cy, r, n = 64) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return out;
  }

  function roundedRectPts(w, h, r, n = 8) {
    const pts = [];
    const x = w / 2 - r, y = h / 2 - r;
    const corner = (cx, cy, a0) => {
      for (let i = 0; i <= n; i++) {
        const a = a0 + (i / n) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    corner(x, y, 0);
    corner(-x, y, Math.PI / 2);
    corner(-x, -y, Math.PI);
    corner(x, -y, Math.PI * 1.5);
    pts.push(pts[0]);
    return pts;
  }

  function cubic(p0, p1, p2, p3, n = 16) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
      ]);
    }
    return out;
  }

  function rotatePts(pts, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
  }

  /* ── ROSE ───────────────────────────────────────────── */
  const rose = new THREE.Group();
  rose.position.set(0.15, 0.25, 0);
  wall.add(rose);

  function petal(scale) {
    const a = cubic([0, 0], [-0.52 * scale, 0.3 * scale], [-0.4 * scale, 1.0 * scale], [0, 1.12 * scale], 14);
    const b = cubic([0, 1.12 * scale], [0.4 * scale, 1.0 * scale], [0.52 * scale, 0.3 * scale], [0, 0], 14);
    return a.concat(b.slice(1));
  }

  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    g.rotation.z = (i / 8) * Math.PI * 2 + 0.18;
    rose.add(g);
    neon(petal(1), { color: C.pink, radius: 0.017, z: -0.04, parent: g, name: 'rose' });
  }
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    g.rotation.z = (i / 6) * Math.PI * 2 + 0.6;
    rose.add(g);
    neon(petal(0.6), { color: C.hot, radius: 0.015, z: 0.04, parent: g, name: 'rose' });
  }
  // spiral heart
  const spiral = [];
  for (let i = 0; i <= 150; i++) {
    const t = i / 150;
    const a = t * Math.PI * 5.2;
    const r = 0.055 + t * 0.13;
    spiral.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  neon(spiral, { color: C.white, radius: 0.011, z: 0.09, parent: rose, name: 'rose' });

  /* ── DICE ───────────────────────────────────────────── */
  const dice = new THREE.Group();
  dice.position.set(-2.3, 2.0, -0.5);
  wall.add(dice);
  neon(roundedRectPts(1.02, 1.02, 0.2), { color: C.cyan, radius: 0.016, closed: true, parent: dice, name: 'dice' });
  [[0, 0], [0.3, 0.3], [0.3, -0.3], [-0.3, 0.3], [-0.3, -0.3]].forEach(([x, y]) => {
    neon(circlePts(x, y, 0.085, 26), { color: C.cyan, radius: 0.015, closed: true, parent: dice, name: 'dice' });
  });

  /* ── CHERRIES ───────────────────────────────────────── */
  const cherries = new THREE.Group();
  cherries.position.set(2.45, 2.0, -0.35);
  cherries.rotation.z = -0.12;
  wall.add(cherries);
  neon(circlePts(-0.34, -0.5, 0.3, 44), { color: C.pink, radius: 0.016, closed: true, parent: cherries, name: 'cherry' });
  neon(circlePts(0.36, -0.44, 0.28, 44), { color: C.pink, radius: 0.016, closed: true, parent: cherries, name: 'cherry' });
  neon([
    [-0.34, -0.2], [-0.28, 0.2], [-0.18, 0.55], [-0.06, 0.86], [0.02, 0.96]
  ], { color: C.pink, radius: 0.013, parent: cherries, name: 'cherry' });
  neon([
    [0.36, -0.16], [0.32, 0.24], [0.2, 0.6], [0.08, 0.9], [0.02, 0.96]
  ], { color: C.pink, radius: 0.013, parent: cherries, name: 'cherry' });
  neon(cubic([0.02, 0.96], [0.22, 1.02], [0.44, 0.96], [0.5, 0.78])
    .concat(cubic([0.5, 0.78], [0.36, 0.66], [0.1, 0.8], [0.02, 0.96], 10)),
    { color: C.acid, radius: 0.013, parent: cherries, name: 'cherry' });

  /* ── LIGHTNING ──────────────────────────────────────── */
  const bolt = new THREE.Group();
  bolt.position.set(2.6, -1.6, -0.2);
  bolt.scale.setScalar(0.92);
  wall.add(bolt);
  neon([
    [0.26, 1.28], [-0.58, 0.02], [-0.08, 0.02], [-0.28, -1.28],
    [0.58, -0.04], [0.1, -0.04]
  ], { color: C.acid, radius: 0.017, closed: true, parent: bolt, name: 'bolt' });

  /* ── SPADE ──────────────────────────────────────────── */
  const spade = new THREE.Group();
  spade.position.set(-2.3, -1.6, -0.55);
  spade.scale.setScalar(0.8);
  spade.rotation.z = Math.PI;
  wall.add(spade);
  neon([
    [0, -1.2],
    ...cubic([0, -1.2], [-0.2, -0.62], [-0.98, -0.34], [-0.98, 0.24], 16).slice(1),
    ...cubic([-0.98, 0.24], [-0.98, 0.78], [-0.36, 0.96], [0, 0.5], 16).slice(1),
    ...cubic([0, 0.5], [0.36, 0.96], [0.98, 0.78], [0.98, 0.24], 16).slice(1),
    ...cubic([0.98, 0.24], [0.98, -0.34], [0.2, -0.62], [0, -1.2], 16).slice(1)
  ], { color: C.violet, radius: 0.016, parent: spade, name: 'spade' });

  /* ── 13 ─────────────────────────────────────────────── */
  const thirteen = new THREE.Group();
  thirteen.position.set(-0.6, -1.95, -0.4);
  thirteen.scale.setScalar(0.75);
  wall.add(thirteen);
  // 1
  neon([[-0.1, 0.55], [0.12, 0.72], [0.12, -0.6]], { color: C.white, radius: 0.014, parent: thirteen, name: '13' });
  neon([[-0.12, -0.6], [0.38, -0.6]], { color: C.white, radius: 0.014, parent: thirteen, name: '13' });
  // 3
  const arc = (cy, from, to) => {
    const out = [];
    for (let i = 0; i <= 22; i++) {
      const a = from + (i / 22) * (to - from);
      out.push([0.62 + Math.cos(a) * 0.3, cy + Math.sin(a) * 0.3]);
    }
    return out;
  };
  neon(arc(0.3, Math.PI * 0.42, -Math.PI * 0.62), { color: C.white, radius: 0.014, parent: thirteen, name: '13' });
  neon(arc(-0.3, Math.PI * 0.55, -Math.PI * 0.5), { color: C.white, radius: 0.014, parent: thirteen, name: '13' });

  /* ── SPARKLES ───────────────────────────────────────── */
  const sparkle = [[0, 1], [0.16, 0.16], [1, 0], [0.16, -0.16], [0, -1], [-0.16, -0.16], [-1, 0], [-0.16, 0.16]];
  [
    [-0.35, 2.9, 0.6, C.cyan], [2.15, -0.55, 0.72, C.white],
    [-2.45, 0.35, 0.55, C.pink], [1.15, -2.55, 0.62, C.violet]
  ].forEach(([x, y, s, col]) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0.4);
    wall.add(g);
    neon(sparkle, { color: col, radius: 0.012, closed: true, parent: g, name: 'spark', scale: s });
  });

  /* ── back wall haze + grid ──────────────────────────── */
  const hazeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 p = vUv - 0.5;
        float d1 = length(p - vec2(-0.28, 0.25));
        float d2 = length(p - vec2(0.3, -0.22));
        float pink  = 1.0 - smoothstep(0.0, 0.55, d1);
        float cyan  = 1.0 - smoothstep(0.0, 0.55, d2);
        vec3 col = vec3(1.0, 0.17, 0.52) * pink * 0.16 + vec3(0.16, 0.94, 0.88) * cyan * 0.12;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), hazeMat);
  haze.position.set(2.2, 0, -6.5);
  scene.add(haze);

  // faint grid
  function gridTexture() {
    const s = 512;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= s; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(9, 6);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 22),
    new THREE.MeshBasicMaterial({ map: gridTexture(), transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false })
  );
  grid.position.set(2.2, 0, -5.8);
  scene.add(grid);

  /* ── layout / interaction ───────────────────────────── */
  const pointer = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };
  let scrollNorm = 0;
  let running = true;
  const clock = new THREE.Clock();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = aspect < 0.85 ? 62 : 45;

    if (w < 760) {
      wall.position.set(0.5, 0.0, 0);
      wall.scale.setScalar(0.95);
      camera.position.z = 9.4;
    } else if (w < 1100) {
      wall.position.set(3.0, 0, 0);
      wall.scale.setScalar(0.8);
      camera.position.z = 10;
    } else {
      wall.position.set(3.6, 0.05, 0);
      wall.scale.setScalar(0.92);
      camera.position.z = 9.6;
    }
    camera.updateProjectionMatrix();
  }

  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    scrollNorm = Math.min(window.scrollY / window.innerHeight, 1);
  }, { passive: true });

  window.addEventListener('resize', resize);
  resize();

  /* ── animation ──────────────────────────────────────── */
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);

    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    smooth.x += (pointer.x - smooth.x) * Math.min(1, dt * 2.4);
    smooth.y += (pointer.y - smooth.y) * Math.min(1, dt * 2.4);

    camera.position.x = smooth.x * 0.45;
    camera.position.y = -smooth.y * 0.3;
    camera.lookAt(smooth.x * 0.5, 0, 0);

    wall.rotation.y = smooth.x * 0.07 - scrollNorm * 0.06;
    wall.rotation.x = smooth.y * 0.035;
    wall.position.y = (window.innerWidth < 760 ? 0 : 0.05) - scrollNorm * 0.35;

    rose.rotation.z = elapsed * 0.055;

    // neon flicker + buzz
    for (const st of flickerState.values()) {
      if (elapsed < st.start) continue;
      if (!st.offUntil && Math.random() < 0.0016) {
        st.offUntil = elapsed + 0.03 + Math.random() * 0.1;
      }
      if (st.offUntil && elapsed >= st.offUntil) st.offUntil = 0;
      if (st.boost > 0) st.boost = Math.max(0, st.boost - dt);
    }

    for (const o of neonFlash) {
      const st = o.state;
      if (elapsed < st.start) {
        o.core.color.copy(o.coreBase).multiplyScalar(0.04);
        o.mid.opacity = 0;
        o.wide.opacity = 0;
        continue;
      }

      const on = !(st.offUntil && elapsed < st.offUntil);
      const hum = 0.96 + Math.sin(elapsed * 42 + st.seed) * 0.04;
      const b = on ? hum * (st.boost > 0 ? 1.55 : 1) : 0.05;

      o.core.color.copy(o.coreBase).multiplyScalar(b);
      o.mid.opacity = o.midOpacity * (on ? (st.boost > 0 ? 1.9 : 1) : 0.06);
      o.wide.opacity = o.wideOpacity * (on ? (st.boost > 0 ? 1.8 : 1) : 0.05);
    }

    hazeMat.uniforms.uTime.value = elapsed;

    renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      clock.getDelta();
      frame();
    }
  });

  frame();

  window.LadyLuckScene = {
    buzz(name) {
      flickerState.forEach((st, key) => {
        if (!name || key === name) st.boost = 1.1;
      });
    }
  };
}
