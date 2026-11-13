/* H.I — neural index navigation.
   A monochrome neural graph that revolves around the active section. */

import * as THREE from "./vendor/three.module.js";

const canvas = document.getElementById("hi-net");
const labels = [...document.querySelectorAll(".node-label")];
const panels = [...document.querySelectorAll(".panel-view")];
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 6.2);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const graph = new THREE.Group();
scene.add(graph);

const ink = 0x111110;
const TAB_NAMES = ["studio", "capabilities", "hind", "preview", "contact"];

// ---- nodes ---------------------------------------------------------------
const tabDirs = {
  studio: new THREE.Vector3(0.25, 0.35, 1),
  capabilities: new THREE.Vector3(-1, 0.15, 0.55),
  hind: new THREE.Vector3(1, -0.15, 0.65),
  preview: new THREE.Vector3(-0.45, -0.8, 0.9),
  contact: new THREE.Vector3(0.35, 0.85, -0.55)
};

const tabs = {};
for (const name of TAB_NAMES) {
  const r = 2.45 + Math.random() * 0.5;
  tabs[name] = tabDirs[name].clone().normalize().multiplyScalar(r);
}

const decor = [];
const count = 130;
for (let i = 0; i < count; i++) {
  // Fibonacci shell for even, organic distribution
  const t = i / count;
  const y = 1 - t * 2;
  const rad = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = i * 2.399963229728653;
  const r = 1.35 + Math.random() * 2.1;
  decor.push(new THREE.Vector3(Math.cos(theta) * rad * r, y * r, Math.sin(theta) * rad * r));
}

const decorGeo = new THREE.BufferGeometry().setFromPoints(decor);
const decorPts = new THREE.Points(
  decorGeo,
  new THREE.PointsMaterial({ color: ink, size: 0.022, transparent: true, opacity: 0.55, sizeAttenuation: true })
);
graph.add(decorPts);

const tabGeo = new THREE.BufferGeometry().setFromPoints(Object.values(tabs));
const tabPts = new THREE.Points(
  tabGeo,
  new THREE.PointsMaterial({ color: ink, size: 0.11, transparent: true, opacity: 0.95, sizeAttenuation: true })
);
graph.add(tabPts);

// ---- edges ---------------------------------------------------------------
const all = [...decor, ...Object.values(tabs)];
const edges = [];
const seen = new Set();

function link(a, b) {
  const key = a < b ? `${a}-${b}` : `${b}-${a}`;
  if (seen.has(key)) return;
  seen.add(key);
  edges.push([a, b]);
}

// decorative: two nearest neighbours
for (let i = 0; i < decor.length; i++) {
  const dists = [];
  for (let j = 0; j < decor.length; j++) {
    if (i === j) continue;
    dists.push([decor[i].distanceTo(decor[j]), j]);
  }
  dists.sort((a, b) => a[0] - b[0]);
  for (let k = 0; k < 2; k++) link(i, dists[k][1]);
}

// tabs: connect to nearest decorative nodes and to each other
const tabEntries = Object.entries(tabs);
for (const [name, pos] of tabEntries) {
  const dists = decor
    .map((p, idx) => [p.distanceTo(pos), idx])
    .sort((a, b) => a[0] - b[0])
    .slice(0, 7);
  for (const [, idx] of dists) link(decor.length + TAB_NAMES.indexOf(name), idx);
}
for (let i = 0; i < tabEntries.length; i++) {
  link(decor.length + i, decor.length + ((i + 1) % tabEntries.length));
}

const edgePositions = new Float32Array(edges.length * 6);
edges.forEach(([a, b], i) => {
  edgePositions.set([all[a].x, all[a].y, all[a].z, all[b].x, all[b].y, all[b].z], i * 6);
});
const edgeGeo = new THREE.BufferGeometry();
edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePositions, 3));
const edgeLines = new THREE.LineSegments(
  edgeGeo,
  new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.115 })
);
graph.add(edgeLines);

// ---- travelling signal particles ----------------------------------------
const pulses = [];
for (let i = 0; i < 46; i++) {
  const e = edges[Math.floor(Math.random() * edges.length)];
  pulses.push({ a: e[0], b: e[1], t: Math.random(), speed: 0.08 + Math.random() * 0.12 });
}
const pulseGeo = new THREE.BufferGeometry();
pulseGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pulses.length * 3), 3));
const pulsePts = new THREE.Points(
  pulseGeo,
  new THREE.PointsMaterial({ color: ink, size: 0.032, transparent: true, opacity: 0.7 })
);
graph.add(pulsePts);

// ---- halos on tab nodes --------------------------------------------------
const halos = {};
const haloGeo = new THREE.RingGeometry(0.075, 0.082, 56);
for (const name of TAB_NAMES) {
  const mat = new THREE.MeshBasicMaterial({
    color: ink, transparent: true, opacity: 0.28, side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(haloGeo, mat);
  ring.position.copy(tabs[name]);
  graph.add(ring);
  halos[name] = ring;
}

// ---- state ---------------------------------------------------------------
let active = "studio";
let angle = 0;
let targetRotX = 0;
let targetRotY = 0;
let pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const anchor = new THREE.Vector3();
const worldActive = new THREE.Vector3();
const tmp = new THREE.Vector3();

function setAnchor() {
  if (window.innerWidth < 900) anchor.set(0, 1.15, 0);
  else anchor.set(-1.25, 0.05, 0);
}
setAnchor();

function setActive(name, updateHash = true) {
  if (!tabs[name]) return;
  active = name;
  labels.forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  panels.forEach((p) => {
    const on = p.dataset.panel === name;
    p.hidden = !on;
    if (on) {
      p.classList.remove("panel-enter");
      // restart the entrance animation
      void p.offsetWidth;
      p.classList.add("panel-enter");
    }
  });
  for (const key of TAB_NAMES) {
    halos[key].material.opacity = key === name ? 0.55 : 0.18;
    halos[key].scale.setScalar(key === name ? 1.5 : 1);
  }
  if (updateHash) history.replaceState(null, "", `#${name}`);
}

document.querySelectorAll("[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => setActive(btn.dataset.tab));
});
document.querySelectorAll("[data-goto]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    setActive(el.dataset.goto);
  });
});
document.querySelectorAll("[data-tab-link]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    setActive(el.dataset.tabLink);
  });
});

const initial = location.hash.replace("#", "");
setActive(tabs[initial] ? initial : "studio", false);

// ---- pointer parallax ----------------------------------------------------
window.addEventListener("pointermove", (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
});

// ---- resize --------------------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  setAnchor();
});

// ---- frame ---------------------------------------------------------------
const projected = new THREE.Vector3();
const camTarget = new THREE.Vector3();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (!reduced) angle += dt * 0.075;

  graph.rotation.set(
    Math.sin(time * 0.09) * 0.10,
    angle,
    Math.cos(time * 0.07) * 0.045
  );

  // Pin the active tab node at the anchor; the rest of the network revolves around it.
  tmp.copy(tabs[active]).applyEuler(graph.rotation);
  graph.position.lerp(anchor.clone().sub(tmp), 1 - Math.pow(0.0005, dt));

  graph.updateMatrixWorld();

  // camera parallax
  camTarget.set(pointer.x * 0.28, -pointer.y * 0.18, 6.2);
  camera.position.lerp(camTarget, 1 - Math.pow(0.002, dt));
  camera.lookAt(0, 0, 0);

  // pulses
  const arr = pulseGeo.attributes.position.array;
  pulses.forEach((p, i) => {
    p.t += dt * p.speed;
    if (p.t > 1) {
      p.t = 0;
      const e = edges[Math.floor(Math.random() * edges.length)];
      p.a = e[0]; p.b = e[1];
    }
    const a = all[p.a], b = all[p.b];
    arr[i * 3] = a.x + (b.x - a.x) * p.t;
    arr[i * 3 + 1] = a.y + (b.y - a.y) * p.t;
    arr[i * 3 + 2] = a.z + (b.z - a.z) * p.t;
  });
  pulseGeo.attributes.position.needsUpdate = true;

  // billboard halos
  for (const key of TAB_NAMES) halos[key].lookAt(camera.position);

  // project labels, clamped to the safe area left of the panel
  const w = window.innerWidth, h = window.innerHeight;
  const panelRect = document.querySelector(".panel").getBoundingClientRect();
  const mobile = w < 900;
  const maxX = mobile ? w - 70 : Math.max(140, panelRect.left - 26);
  const minY = 76;
  const maxY = mobile ? Math.max(minY + 60, panelRect.top - 24) : h - 64;
  for (const btn of labels) {
    const name = btn.dataset.tab;
    worldActive.copy(tabs[name]).applyMatrix4(graph.matrixWorld);
    projected.copy(worldActive).project(camera);
    let lx = (projected.x * 0.5 + 0.5) * w;
    let ly = (-projected.y * 0.5 + 0.5) * h;
    lx = THREE.MathUtils.clamp(lx, 74, maxX);
    ly = THREE.MathUtils.clamp(ly, minY, maxY);
    btn.style.left = `${lx}px`;
    btn.style.top = `${ly}px`;
    const depth = worldActive.z;
    const scale = THREE.MathUtils.clamp(1.06 - depth * 0.07, 0.72, 1.12);
    btn.style.setProperty("--s", scale.toFixed(3));
    btn.style.opacity = String(THREE.MathUtils.clamp(0.98 - Math.abs(depth) * 0.11, 0.34, 1));
    btn.style.pointerEvents = "auto";
  }

  renderer.render(scene, camera);
  if (!reduced) requestAnimationFrame(frame);
}

frame();
if (reduced) renderer.render(scene, camera);

// Expose a tiny hook for QA
window.__HI__ = { setActive, get active() { return active; } };
