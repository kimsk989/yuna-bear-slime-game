import * as THREE from "three";

const SLIME_MAX_HP = 3;
const SLIME_COUNT = 4;
const WIN_TARGET = 8;
const ATTACK_RANGE = 2.4;
const BASE_ATTACK_DURATION = 0.45;
const BASE_ATTACK_COOLDOWN = 0.15;
const BASE_MOVE_SPEED = 4.5;
const ARENA_RADIUS = 9;

const MAX_LEVEL = 10;
// xp required to go from level i -> i+1 (index 0 = lv1->2 ... index 8 = lv9->10)
// lv1-5: quick jumps, lv6-10: slower climb
const XP_THRESHOLDS = [2, 2, 3, 3, 4, 6, 7, 8, 9];

const SLIME_PALETTE = [0x5ad0e0, 0xff8fd0, 0x9dff7a, 0xffe066, 0xb28dff];
const MOVE_STYLES = ["chase", "wander", "circle", "zigzag"];

const canvas = document.getElementById("game-canvas");
const startScreen = document.getElementById("start-screen");
const winScreen = document.getElementById("win-screen");
const winTitle = winScreen.querySelector("h2");
const hud = document.getElementById("hud");
const scoreNum = document.getElementById("score-num");
const levelNum = document.getElementById("level-num");
const xpFill = document.getElementById("xp-bar-fill");
const levelUpToast = document.getElementById("level-up-toast");
const mobileControls = document.getElementById("mobile-controls");
const joystickZone = document.getElementById("joystick-zone");
const joystickKnob = document.getElementById("joystick-knob");
const attackBtn = document.getElementById("attack-btn");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");

let score = 0;

const progress = {
  level: 1,
  xp: 0,
  xpToNext: XP_THRESHOLDS[0],
  moveSpeed: BASE_MOVE_SPEED,
  attackDuration: BASE_ATTACK_DURATION,
  attackCooldown: BASE_ATTACK_COOLDOWN,
};

function applyLevelStats() {
  // +5% move speed and ~+7% attack speed per level, capped at MAX_LEVEL
  const speedMult = 1 + (progress.level - 1) * 0.05;
  const atkMult = 1 + (progress.level - 1) * 0.07;
  progress.moveSpeed = BASE_MOVE_SPEED * speedMult;
  progress.attackDuration = BASE_ATTACK_DURATION / atkMult;
  progress.attackCooldown = BASE_ATTACK_COOLDOWN / atkMult;
}
applyLevelStats();

let levelUpToastTimer = null;
function gainXp(amount) {
  if (progress.level >= MAX_LEVEL) return;
  progress.xp += amount;
  while (progress.level < MAX_LEVEL && progress.xp >= progress.xpToNext) {
    progress.xp -= progress.xpToNext;
    progress.level += 1;
    progress.xpToNext = XP_THRESHOLDS[progress.level - 1] || 999;
    applyLevelStats();
    levelNum.textContent = String(progress.level);
    levelUpToast.textContent = `레벨업! Lv.${progress.level} 🌟`;
    levelUpToast.classList.add("show");
    clearTimeout(levelUpToastTimer);
    levelUpToastTimer = setTimeout(() => levelUpToast.classList.remove("show"), 1200);
  }
  levelNum.textContent = String(progress.level);
  const ratio = progress.level >= MAX_LEVEL ? 1 : progress.xp / progress.xpToNext;
  xpFill.style.width = `${Math.min(100, ratio * 100)}%`;
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe8ff);
scene.fog = new THREE.Fog(0xbfe8ff, 18, 32);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
const cameraBase = new THREE.Vector3();

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x88aa66, 1.0);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 1.1);
sunLight.position.set(6, 10, 4);
scene.add(sunLight);

// ground
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(ARENA_RADIUS + 2, 48),
  new THREE.MeshStandardMaterial({ color: 0x9fe07a })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const ringEdge = new THREE.Mesh(
  new THREE.RingGeometry(ARENA_RADIUS + 1.6, ARENA_RADIUS + 2, 48),
  new THREE.MeshStandardMaterial({ color: 0x7bc95f })
);
ringEdge.rotation.x = -Math.PI / 2;
ringEdge.position.y = 0.01;
scene.add(ringEdge);

// --- scenery: trees ---
function makeTree() {
  const group = new THREE.Group();
  const trunkH = 1.1 + Math.random() * 0.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.16, trunkH, 8),
    new THREE.MeshStandardMaterial({ color: 0x8a5a34 })
  );
  trunk.position.y = trunkH / 2;
  group.add(trunk);

  const leafColor = [0x5fbf4f, 0x6fce5a, 0x4fae46][Math.floor(Math.random() * 3)];
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor });
  const tiers = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < tiers; i++) {
    const r = 0.62 - i * 0.13;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), leafMat);
    leaf.position.y = trunkH + i * 0.42;
    leaf.scale.set(1, 0.85, 1);
    group.add(leaf);
  }
  const scale = 0.8 + Math.random() * 0.5;
  group.scale.setScalar(scale);
  return group;
}

function makeFlower(color) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.025, 0.22, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a9a4a })
  );
  stem.position.y = 0.11;
  group.add(stem);

  const petalMat = new THREE.MeshStandardMaterial({ color });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), petalMat);
    petal.position.set(Math.cos(a) * 0.09, 0.24, Math.sin(a) * 0.09);
    petal.scale.set(1, 0.6, 1);
    group.add(petal);
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe08a })
  );
  center.position.y = 0.24;
  group.add(center);
  return group;
}

// ring of trees just outside the play field
const treeCount = 16;
for (let i = 0; i < treeCount; i++) {
  const a = (i / treeCount) * Math.PI * 2 + Math.random() * 0.15;
  const d = ARENA_RADIUS + 2.4 + Math.random() * 1.8;
  const tree = makeTree();
  tree.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
  tree.rotation.y = Math.random() * Math.PI * 2;
  scene.add(tree);
}

// flower clusters scattered near the field edge, out of the way of play
const flowerColors = [0xff8fb3, 0xffe066, 0xffffff, 0xb28dff, 0xff9f6b];
for (let c = 0; c < 10; c++) {
  const a = Math.random() * Math.PI * 2;
  const d = ARENA_RADIUS - 1.5 + Math.random() * 3.2;
  const clusterX = Math.cos(a) * d;
  const clusterZ = Math.sin(a) * d;
  const clusterSize = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < clusterSize; i++) {
    const flower = makeFlower(flowerColors[Math.floor(Math.random() * flowerColors.length)]);
    flower.position.set(
      clusterX + (Math.random() - 0.5) * 0.6,
      0,
      clusterZ + (Math.random() - 0.5) * 0.6
    );
    flower.rotation.y = Math.random() * Math.PI * 2;
    flower.scale.setScalar(0.8 + Math.random() * 0.5);
    scene.add(flower);
  }
}

// --- bear ---
function makeBear() {
  const root = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0x9a6b3f });
  const furLight = new THREE.MeshStandardMaterial({ color: 0xd9b483 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b1c12 });

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.55;
  root.add(bodyPivot);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 0.45, 4, 12), fur);
  torso.position.y = 0.42;
  bodyPivot.add(torso);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), furLight);
  belly.scale.set(0.9, 1.05, 0.55);
  belly.position.set(0, 0.38, 0.32);
  bodyPivot.add(belly);

  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), furLight);
  tail.position.set(0, 0.35, -0.46);
  bodyPivot.add(tail);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.98, 0.02);
  bodyPivot.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), fur);
  headPivot.add(head);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), furLight);
  snout.position.set(0, -0.07, 0.36);
  headPivot.add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), dark);
  nose.position.set(0, -0.02, 0.55);
  headPivot.add(nose);

  [-0.15, 0.15].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), dark);
    eye.position.set(x, 0.08, 0.36);
    headPivot.add(eye);
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    glint.position.set(x + 0.018, 0.1, 0.4);
    headPivot.add(glint);
  });

  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xff9fb0, transparent: true, opacity: 0.7 });
  [-0.3, 0.3].forEach((x) => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), cheekMat);
    cheek.position.set(x, -0.05, 0.28);
    headPivot.add(cheek);
  });

  [-0.22, 0.22].forEach((x) => {
    const earOuter = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), fur);
    earOuter.position.set(x, 0.35, 0);
    headPivot.add(earOuter);
    const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), cheekMat);
    earInner.position.set(x, 0.35, 0.06);
    headPivot.add(earInner);
  });

  function makeLimb(isArm) {
    const pivot = new THREE.Group();
    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(isArm ? 0.11 : 0.13, isArm ? 0.28 : 0.24, 4, 8),
      fur
    );
    upper.position.y = isArm ? -0.16 : -0.14;
    pivot.add(upper);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(isArm ? 0.13 : 0.15, 10, 10), furLight);
    paw.position.y = isArm ? -0.34 : -0.28;
    pivot.add(paw);
    pivot.userData.upper = upper;
    pivot.userData.paw = paw;
    return pivot;
  }

  const armPivotL = makeLimb(true);
  armPivotL.position.set(-0.5, 0.68, 0);
  bodyPivot.add(armPivotL);
  const armPivotR = makeLimb(true);
  armPivotR.position.set(0.5, 0.68, 0);
  bodyPivot.add(armPivotR);

  const legPivotL = makeLimb(false);
  legPivotL.position.set(-0.22, 0.22, 0);
  bodyPivot.add(legPivotL);
  const legPivotR = makeLimb(false);
  legPivotR.position.set(0.22, 0.22, 0);
  bodyPivot.add(legPivotR);

  root.userData = { bodyPivot, headPivot, armPivotL, armPivotR, legPivotL, legPivotR };
  return root;
}

const bear = makeBear();
scene.add(bear);

const bearState = {
  pos: new THREE.Vector2(0, 3.5),
  facing: 0,
  walkT: 0,
  moving: false,
  attackT: 0,
  attackHitDone: false,
  cooldownT: 0,
};

// --- slime ---
function makeSlime(colorHex) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.92,
    roughness: 0.25,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), mat);
  body.scale.set(1, 0.8, 1);
  body.position.y = 0.45;
  group.add(body);

  const highlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
  );
  highlight.position.set(-0.19, 0.64, 0.33);
  highlight.scale.set(1, 1.3, 0.6);
  group.add(highlight);

  // big sparkly eyes for extra cuteness
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x142033 });
  const eyeGroups = [];
  [-0.2, 0.2].forEach((x) => {
    const eyeG = new THREE.Group();
    eyeG.position.set(x, 0.52, 0.46);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), eyeWhiteMat);
    eyeG.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), pupilMat);
    pupil.position.set(0, -0.01, 0.06);
    eyeG.add(pupil);
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    glint.position.set(0.025, 0.03, 0.11);
    eyeG.add(glint);
    group.add(eyeG);
    eyeGroups.push(eyeG);
  });

  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xff9fb0, transparent: true, opacity: 0.75 });
  [-0.32, 0.32].forEach((x) => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), cheekMat);
    cheek.position.set(x, 0.4, 0.36);
    cheek.scale.set(1, 0.7, 0.5);
    group.add(cheek);
  });

  const browMat = new THREE.MeshStandardMaterial({ color: 0x142033 });
  [-0.2, 0.2].forEach((x, i) => {
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.12, 2, 4), browMat);
    brow.position.set(x, 0.66, 0.4);
    brow.rotation.z = i === 0 ? 0.5 : -0.5;
    group.add(brow);
  });

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 10, Math.PI), browMat);
  mouth.position.set(0, 0.36, 0.5);
  mouth.rotation.x = Math.PI;
  group.add(mouth);

  // some slimes get a cute bobbling antenna
  let antennaTip = null;
  if (Math.random() < 0.45) {
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: colorHex })
    );
    stalk.position.set(0, 0.86, 0.05);
    stalk.rotation.x = -0.2;
    group.add(stalk);
    antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    antennaTip.position.set(0, 0.97, 0.13);
    group.add(antennaTip);
  }

  // hp pips above head
  const pips = [];
  for (let i = 0; i < SLIME_MAX_HP; i++) {
    const pip = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xff5d6c })
    );
    pip.position.set((i - (SLIME_MAX_HP - 1) / 2) * 0.22, 1.2, 0);
    group.add(pip);
    pips.push(pip);
  }

  group.userData = { body, pips, eyeGroups, antennaTip };
  return group;
}

function pickSlimeSpawnPos() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 2.5 + Math.random() * (ARENA_RADIUS - 3.5);
    const pos = new THREE.Vector2(Math.cos(angle) * dist, Math.sin(angle) * dist);
    if (pos.distanceTo(bearState.pos) > 3) return pos;
  }
  return new THREE.Vector2(ARENA_RADIUS - 1, 0);
}

function spawnSlime() {
  const color = SLIME_PALETTE[Math.floor(Math.random() * SLIME_PALETTE.length)];
  const mesh = makeSlime(color);
  scene.add(mesh);
  const pos = pickSlimeSpawnPos();
  return {
    mesh,
    pos,
    hp: SLIME_MAX_HP,
    hopT: Math.random() * Math.PI * 2,
    hopDir: Math.random() * Math.PI * 2,
    dead: false,
    respawnT: 0,
    hitFlashT: 0,
    wobbleT: Math.random() * Math.PI * 2,
    moveStyle: MOVE_STYLES[Math.floor(Math.random() * MOVE_STYLES.length)],
    moveTimerT: 1 + Math.random() * 2,
    circleAngle: Math.random() * Math.PI * 2,
    circleCenter: pos.clone(),
    blinkT: 1.5 + Math.random() * 2.5,
    blinking: false,
  };
}

let slimes = [];

const hitSparks = [];
function spawnHitSpark(x, z) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.25, 0.4, 20),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.06, z);
  scene.add(ring);
  hitSparks.push({ mesh: ring, t: 0, duration: 0.3 });

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const bit = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 })
    );
    bit.position.set(x, 0.4, z);
    scene.add(bit);
    hitSparks.push({
      mesh: bit,
      t: 0,
      duration: 0.35,
      vx: Math.cos(a) * 1.6,
      vz: Math.sin(a) * 1.6,
      isBit: true,
    });
  }
}

let cameraShakeT = 0;

// --- input ---
const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") tryAttack();
});

let joyVec = new THREE.Vector2(0, 0);
let joyActive = false;
let joyPointerId = null;

function setJoystickFromEvent(clientX, clientY) {
  const rect = joystickZone.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = clientX - cx;
  let dy = clientY - cy;
  const max = rect.width / 2;
  const len = Math.hypot(dx, dy);
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  joyVec.set(dx / max, dy / max);
}

joystickZone.addEventListener("pointerdown", (e) => {
  joyActive = true;
  joyPointerId = e.pointerId;
  setJoystickFromEvent(e.clientX, e.clientY);
});
window.addEventListener("pointermove", (e) => {
  if (joyActive && e.pointerId === joyPointerId) setJoystickFromEvent(e.clientX, e.clientY);
});
window.addEventListener("pointerup", (e) => {
  if (joyActive && e.pointerId === joyPointerId) {
    joyActive = false;
    joyVec.set(0, 0);
    joystickKnob.style.transform = "translate(0px, 0px)";
  }
});

attackBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  tryAttack();
});

function tryAttack() {
  if (!running || bearState.attackT > 0 || bearState.cooldownT > 0) return;
  bearState.attackT = progress.attackDuration;
  bearState.attackHitDone = false;
}

// --- game state ---
let running = false;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function updateBear(dt) {
  let mx = 0;
  let my = 0;
  const attacking = bearState.attackT > 0;

  if (!attacking) {
    if (keys.has("arrowup") || keys.has("w")) my -= 1;
    if (keys.has("arrowdown") || keys.has("s")) my += 1;
    if (keys.has("arrowleft") || keys.has("a")) mx -= 1;
    if (keys.has("arrowright") || keys.has("d")) mx += 1;
    mx += joyVec.x;
    my += joyVec.y;
  }

  const len = Math.hypot(mx, my);
  bearState.moving = len > 0.05;
  if (bearState.moving) {
    mx /= len || 1;
    my /= len || 1;
    bearState.pos.x += mx * progress.moveSpeed * dt;
    bearState.pos.y += my * progress.moveSpeed * dt;
    const targetFacing = Math.atan2(mx, -my);
    let diff = targetFacing - bearState.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    bearState.facing += diff * Math.min(1, dt * 10);
    bearState.walkT += dt * 9;
  }

  const distFromCenter = bearState.pos.length();
  if (distFromCenter > ARENA_RADIUS) {
    bearState.pos.multiplyScalar(ARENA_RADIUS / distFromCenter);
  }

  bear.position.set(bearState.pos.x, 0, bearState.pos.y);
  bear.rotation.y = bearState.facing;

  const u = bear.userData;

  if (bearState.moving) {
    const bob = Math.abs(Math.sin(bearState.walkT)) * 0.08;
    u.bodyPivot.position.y = 0.55 + bob;
    u.bodyPivot.rotation.x = 0.08;
    u.headPivot.rotation.x = Math.sin(bearState.walkT * 2) * 0.05;
    const swing = Math.sin(bearState.walkT) * 0.7;
    u.legPivotL.rotation.x = swing;
    u.legPivotR.rotation.x = -swing;
    // lift each foot as it swings forward so steps look like real steps, not a slide
    const liftL = Math.max(0, Math.sin(bearState.walkT)) * 0.12;
    const liftR = Math.max(0, Math.sin(bearState.walkT + Math.PI)) * 0.12;
    u.legPivotL.position.y = 0.22 + liftL;
    u.legPivotR.position.y = 0.22 + liftR;
    u.armPivotL.rotation.x = -swing * 0.8;
    u.armPivotR.rotation.x = swing * 0.8;
  } else {
    u.bodyPivot.position.y += (0.55 - u.bodyPivot.position.y) * 0.15;
    u.bodyPivot.rotation.x *= 0.85;
    u.headPivot.rotation.x *= 0.85;
    u.legPivotL.rotation.x *= 0.8;
    u.legPivotR.rotation.x *= 0.8;
    u.legPivotL.position.y += (0.22 - u.legPivotL.position.y) * 0.3;
    u.legPivotR.position.y += (0.22 - u.legPivotR.position.y) * 0.3;
    if (bearState.attackT <= 0) {
      u.armPivotL.rotation.x *= 0.8;
      u.armPivotR.rotation.x *= 0.8;
    }
  }

  if (bearState.attackT > 0) {
    bearState.attackT -= dt;
    const uProg = 1 - Math.max(0, bearState.attackT) / progress.attackDuration;
    let rot;
    if (uProg < 0.3) {
      rot = (uProg / 0.3) * 0.95;
    } else if (uProg < 0.55) {
      rot = 0.95 + ((uProg - 0.3) / 0.25) * -2.5;
    } else {
      rot = -1.55 + ((uProg - 0.55) / 0.45) * 1.55;
    }
    u.armPivotR.rotation.x = rot;
    u.armPivotL.rotation.x = -rot * 0.3;
    u.bodyPivot.rotation.y = uProg < 0.55 ? -( (uProg - 0.3) / 0.25) * 0.25 : -0.25 + ((uProg - 0.55) / 0.45) * 0.25;

    if (!bearState.attackHitDone && uProg >= 0.42) {
      bearState.attackHitDone = true;
      resolveAttackHit();
    }
    if (bearState.attackT <= 0) {
      bearState.attackT = 0;
      bearState.cooldownT = progress.attackCooldown;
      u.bodyPivot.rotation.y = 0;
    }
  } else if (bearState.cooldownT > 0) {
    bearState.cooldownT -= dt;
  }
}

function resolveAttackHit() {
  const forward = new THREE.Vector2(Math.sin(bearState.facing), -Math.cos(bearState.facing));
  const hitCenter = bearState.pos.clone().add(forward.clone().multiplyScalar(0.6));
  let hitAny = false;
  for (const s of slimes) {
    if (s.dead) continue;
    const d = hitCenter.distanceTo(s.pos);
    if (d <= ATTACK_RANGE) {
      hitAny = true;
      s.hp -= 1;
      s.hitFlashT = 0.25;
      const kb = s.pos.clone().sub(bearState.pos);
      if (kb.lengthSq() < 0.0001) kb.set(1, 0);
      kb.normalize().multiplyScalar(0.7);
      s.pos.add(kb);
      spawnHitSpark(s.pos.x, s.pos.y);
      if (s.hp <= 0) {
        s.dead = true;
        s.respawnT = 1.1;
        scene.remove(s.mesh);
        score += 1;
        scoreNum.textContent = String(score);
        gainXp(1);
        if (score >= WIN_TARGET) {
          setTimeout(() => running && showWin(), 350);
        }
      }
    }
  }
  if (hitAny) cameraShakeT = 0.18;
}

function updateSlimeDirection(s, dt) {
  switch (s.moveStyle) {
    case "chase": {
      s.moveTimerT -= dt;
      if (s.moveTimerT <= 0) {
        s.moveTimerT = 0.5 + Math.random() * 0.4;
        s.hopDir =
          Math.atan2(bearState.pos.y - s.pos.y, bearState.pos.x - s.pos.x) + (Math.random() - 0.5) * 0.7;
      }
      return 1.15;
    }
    case "wander": {
      s.moveTimerT -= dt;
      if (s.moveTimerT <= 0) {
        s.moveTimerT = 0.8 + Math.random() * 1.6;
        s.hopDir = Math.random() * Math.PI * 2;
      }
      return 0.75;
    }
    case "circle": {
      s.circleAngle += dt * 1.1;
      const target = s.circleCenter
        .clone()
        .add(new THREE.Vector2(Math.cos(s.circleAngle), Math.sin(s.circleAngle)).multiplyScalar(1.6));
      s.hopDir = Math.atan2(target.y - s.pos.y, target.x - s.pos.x);
      return 1.0;
    }
    case "zigzag": {
      s.moveTimerT -= dt;
      const toBear = Math.atan2(bearState.pos.y - s.pos.y, bearState.pos.x - s.pos.x);
      const wiggle = Math.sin(s.hopT * 1.7) * 1.1;
      s.hopDir = toBear + wiggle;
      return 1.2;
    }
    default:
      return 1.0;
  }
}

function updateSlimes(dt) {
  for (const s of slimes) {
    if (s.dead) {
      s.respawnT -= dt;
      if (s.respawnT <= 0 && running) {
        const fresh = spawnSlime();
        Object.assign(s, fresh);
      }
      continue;
    }

    s.hopT += dt * 2.2;
    s.wobbleT += dt * 3;
    const hop = Math.max(0, Math.sin(s.hopT));
    const speed = updateSlimeDirection(s, dt);
    if (Math.sin(s.hopT) > 0) {
      s.pos.x += Math.cos(s.hopDir) * speed * dt;
      s.pos.y += Math.sin(s.hopDir) * speed * dt;
    }
    const distFromCenter = s.pos.length();
    if (distFromCenter > ARENA_RADIUS - 0.5) {
      s.pos.multiplyScalar((ARENA_RADIUS - 0.5) / distFromCenter);
      if (s.moveStyle === "circle") s.circleCenter.copy(s.pos);
    }

    s.mesh.position.set(s.pos.x, hop * 0.4, s.pos.y);
    s.mesh.rotation.y = s.hopDir + Math.PI / 2;
    const idleSquash = Math.sin(s.wobbleT) * 0.03;
    const squash = 1 - hop * 0.3 + idleSquash;
    s.mesh.scale.set(1 + hop * 0.15 - idleSquash, squash, 1 + hop * 0.15 - idleSquash);

    if (s.mesh.userData.antennaTip) {
      s.mesh.userData.antennaTip.position.x = Math.sin(s.wobbleT * 1.6) * 0.05;
    }

    // cute periodic blink
    s.blinkT -= dt;
    if (s.blinkT <= 0) {
      s.blinking = !s.blinking;
      s.blinkT = s.blinking ? 0.1 : 1.5 + Math.random() * 2.5;
      s.mesh.userData.eyeGroups.forEach((eg) => eg.scale.set(1, s.blinking ? 0.12 : 1, 1));
    }

    if (s.hitFlashT > 0) {
      s.hitFlashT -= dt;
      s.mesh.userData.body.material.emissive.setHex(0xffffff);
      s.mesh.userData.body.material.emissiveIntensity = s.hitFlashT / 0.25;
    } else if (s.mesh.userData.body.material.emissiveIntensity) {
      s.mesh.userData.body.material.emissiveIntensity = 0;
    }

    s.mesh.userData.pips.forEach((pip, i) => {
      pip.visible = i < s.hp;
    });
  }
}

function updateHitSparks(dt) {
  for (let i = hitSparks.length - 1; i >= 0; i--) {
    const hs = hitSparks[i];
    hs.t += dt;
    const p = Math.min(1, hs.t / hs.duration);
    if (hs.isBit) {
      hs.mesh.position.x += hs.vx * dt;
      hs.mesh.position.z += hs.vz * dt;
      hs.mesh.position.y += dt * 0.6;
      hs.mesh.material.opacity = 1 - p;
      hs.mesh.scale.setScalar(1 - p * 0.6);
    } else {
      hs.mesh.scale.setScalar(1 + p * 1.5);
      hs.mesh.material.opacity = 0.9 * (1 - p);
    }
    if (p >= 1) {
      scene.remove(hs.mesh);
      hitSparks.splice(i, 1);
    }
  }
}

function updateCamera(dt) {
  const targetX = bearState.pos.x;
  const targetZ = bearState.pos.y + 6.5;
  cameraBase.x += (targetX - cameraBase.x) * 0.08;
  cameraBase.z += (targetZ - cameraBase.z) * 0.08;
  cameraBase.y = 6.5;

  let shakeX = 0;
  let shakeY = 0;
  if (cameraShakeT > 0) {
    cameraShakeT -= dt;
    const mag = Math.max(0, cameraShakeT) * 0.6;
    shakeX = (Math.random() - 0.5) * mag;
    shakeY = (Math.random() - 0.5) * mag;
  }

  camera.position.set(cameraBase.x + shakeX, cameraBase.y + shakeY, cameraBase.z);
  camera.lookAt(bearState.pos.x, 0.6, bearState.pos.y);
}

let lastTime = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (running) {
    updateBear(dt);
    updateSlimes(dt);
    updateHitSparks(dt);
    updateCamera(dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function showWin() {
  running = false;
  winTitle.textContent = `슬라임 ${score}마리를 물리쳤어요! 🎉`;
  winScreen.classList.remove("hidden");
  hud.classList.add("hidden");
  mobileControls.classList.add("hidden");
}

function clearSlimes() {
  for (const s of slimes) {
    if (!s.dead) scene.remove(s.mesh);
  }
  slimes = [];
}

function startGame() {
  score = 0;
  scoreNum.textContent = "0";
  progress.level = 1;
  progress.xp = 0;
  progress.xpToNext = XP_THRESHOLDS[0];
  applyLevelStats();
  levelNum.textContent = "1";
  xpFill.style.width = "0%";
  levelUpToast.classList.remove("show");
  bearState.pos.set(0, 3.5);
  bearState.facing = 0;
  bearState.attackT = 0;
  bearState.cooldownT = 0;
  cameraBase.set(0, 6.5, 10);

  clearSlimes();
  for (let i = 0; i < SLIME_COUNT; i++) slimes.push(spawnSlime());

  startScreen.classList.add("hidden");
  winScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  mobileControls.classList.remove("hidden");
  running = true;
  lastTime = performance.now();
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);
