import * as THREE from 'three';
import { CONFIG } from './config.js';
import { generateHouses } from './houses.js';
import { generateTemple } from './temple.js';
import { generateCastle } from './castle.js';

// ========== ОПТИМИЗАЦИЯ ==========
const GEOMETRY_SEGMENTS = 6;
const MAX_PIXEL_RATIO = 1;

// ========== СЦЕНА ==========
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2a1a);
scene.fog = new THREE.Fog(0x1a2a1a, 25, 55);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 65);
camera.position.set(0, 0.5, 0);

// Фонарик игрока — прикреплён к камере, поэтому светит именно туда, куда смотрит игрок
// (в центр экрана, где крестик). Камера должна быть в сцене, иначе прикреплённый
// к ней свет не будет учитываться при рендере.
scene.add(camera);

const audioListener = new THREE.AudioListener();
camera.add(audioListener);

const playerLight = new THREE.SpotLight(0xffdd99, 0, 9, Math.PI / 6, 0.5, 1.5);
playerLight.position.set(0, 0, 0);
camera.add(playerLight);

const playerLightTarget = new THREE.Object3D();
playerLightTarget.position.set(0, 0, -1); // немного впереди камеры, вдоль направления взгляда
camera.add(playerLightTarget);
playerLight.target = playerLightTarget;

const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "low-power"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// ========== ОРИЕНТАЦИЯ ЭКРАНА ==========
// ВАЖНО: раньше здесь был CSS-трюк с transform: rotate(90deg) на body.
// Он ломал координаты тачей: браузер продолжал считать touch.clientX/clientY
// в исходной (портретной) системе координат, а картинка визуально была
// повёрнута — из-за этого джойстик и свайп "видели" палец не там, где он
// был на самом деле. Теперь вместо трюка используется честный CSS-оверлей
// (#rotate-overlay в style.css), который просто просит повернуть телефон,
// не трогая систему координат вообще.
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ========== ОСВЕЩЕНИЕ (приглушённая ночь — видно, но неярко) ==========
const sunLight = new THREE.DirectionalLight(0xaaccff, 0.35); // холодный "лунный" свет вместо яркого солнца
sunLight.position.set(10, 20, 5);
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x4466aa, 0.2);
fillLight.position.set(-10, 10, -10);
scene.add(fillLight);

const ambient = new THREE.AmbientLight(0x334455, 0.35); // подсветка теней, чтобы не было совсем черно
scene.add(ambient);

// ========== СОЛНЦЕ И ЛУНА ==========
// Обычные меши, letящие по дуге неба. material.fog=false — иначе туман карты
// их тоже закрасит и они станут невидимы издалека.
const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(4, 12, 12),
    new THREE.MeshBasicMaterial({ color: CONFIG.dayNight.sunColor, fog: false })
);
scene.add(sunMesh);
const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(7, 12, 12),
    new THREE.MeshBasicMaterial({ color: CONFIG.dayNight.sunColor, transparent: true, opacity: 0.25, fog: false })
);
scene.add(sunGlow);

const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(3, 12, 12),
    new THREE.MeshBasicMaterial({ color: CONFIG.dayNight.moonColor, fog: false })
);
scene.add(moonMesh);
const moonGlow = new THREE.Mesh(
    new THREE.SphereGeometry(5, 12, 12),
    new THREE.MeshBasicMaterial({ color: CONFIG.dayNight.moonColor, transparent: true, opacity: 0.2, fog: false })
);
scene.add(moonGlow);

function lerpColorHex(hexA, hexB, t) {
    const ar = (hexA >> 16) & 255, ag = (hexA >> 8) & 255, ab = hexA & 255;
    const br = (hexB >> 16) & 255, bg = (hexB >> 8) & 255, bb = hexB & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const b = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | b;
}

// Цикл дня/ночи — синус даёт плавный переход сам по себе, без отдельной
// логики "перехода": t=1 полдень, t=0 полночь, t=0.5 рассвет/закат.
function updateDayNight() {
    const dn = CONFIG.dayNight;
    const skyAngle = ((gameTime % dn.cycleDuration) / dn.cycleDuration) * Math.PI * 2;
    const t = (Math.sin(skyAngle) + 1) / 2;

    const R = dn.orbitRadius;
    const sunX = Math.cos(skyAngle) * R;
    const sunY = Math.sin(skyAngle) * R;
    const moonX = Math.cos(skyAngle + Math.PI) * R;
    const moonY = Math.sin(skyAngle + Math.PI) * R;
    const zOffset = -R * 0.3;

    sunMesh.position.set(sunX, sunY, zOffset);
    sunGlow.position.copy(sunMesh.position);
    sunMesh.visible = sunY > -3;
    sunGlow.visible = sunMesh.visible;

    moonMesh.position.set(moonX, moonY, zOffset);
    moonGlow.position.copy(moonMesh.position);
    moonMesh.visible = moonY > -3;
    moonGlow.visible = moonMesh.visible;

    sunLight.color.set(lerpColorHex(dn.moonColor, dn.sunColor, t));
    sunLight.intensity = THREE.MathUtils.lerp(dn.moonIntensity, dn.sunIntensity, t);
    sunLight.position.set(
        THREE.MathUtils.lerp(moonX, sunX, t),
        Math.max(THREE.MathUtils.lerp(moonY, sunY, t), 5),
        zOffset
    );

    ambient.color.set(lerpColorHex(dn.nightAmbient.color, dn.dayAmbient.color, t));
    ambient.intensity = THREE.MathUtils.lerp(dn.nightAmbient.intensity, dn.dayAmbient.intensity, t);

    const skyColor = lerpColorHex(dn.nightSky, dn.daySky, t);
    scene.background.set(skyColor);
    scene.fog.color.set(skyColor);
}

// ========== ПЕРЕМЕННЫЕ ==========
const MAP_SIZE = CONFIG.world.mapSize;
const wallPositions = [];
const enemies = [];
const keys = [];
const lanterns = [];
const trees = [];
const bushes = [];
const interiorColliders = []; // стены/мебель домов — коллизия зависит от этажа (floor: 0 или 1)
const stairZones = [];        // зоны лестниц: {xMin,xMax,zMin,zMax,floorHeight}
const houseKeySpawnPoints = []; // кандидаты на спавн ключей внутри домов
const radioSpawnPoints = []; // точка (одна) для радио внутри одного из домов
let temple = null; // {x,z,mesh} — храм с амулетом
let castleInfo = null; // {x,z} — позиция замка

// ========== СОЗДАНИЕ ПЕРСОНАЖА ==========
function createHumanoid(color = 0x4488ff) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.4, 0.2),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 })
    );
    body.position.y = 0.2;
    group.add(body);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.5 })
    );
    head.position.y = 0.45;
    group.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x2222ff });

    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    e1.position.set(-0.06, 0.48, -0.1);
    group.add(e1);
    const p1 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), pupilMat);
    p1.position.set(-0.06, 0.47, -0.12);
    group.add(p1);

    const e2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    e2.position.set(0.06, 0.48, -0.1);
    group.add(e2);
    const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), pupilMat);
    p2.position.set(0.06, 0.47, -0.12);
    group.add(p2);

    const legL = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.2, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x2a2a4a, roughness: 0.8 })
    );
    legL.position.set(-0.08, -0.1, 0);
    group.add(legL);

    const legR = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.2, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x2a2a4a, roughness: 0.8 })
    );
    legR.position.set(0.08, -0.1, 0);
    group.add(legR);

    const armL = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.3, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.5 })
    );
    armL.position.set(-0.2, 0.25, 0);
    group.add(armL);

    const armR = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.3, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.5 })
    );
    armR.position.set(0.2, 0.25, 0);
    group.add(armR);

    group.userData = {
        body: body,
        head: head,
        legL: legL,
        legR: legR,
        armL: armL,
        armR: armR,
        animTime: 0,
        isWalking: false
    };

    return group;
}

// ===== НПС (стоит у дерева рядом с замком) =====
function createNPCModel() {
    const group = new THREE.Group();

    // Чёрная футболка
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.4, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 })
    );
    body.position.y = 0.2;
    group.add(body);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0xe0a878, roughness: 0.5 })
    );
    head.position.y = 0.45;
    group.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    e1.position.set(-0.06, 0.48, -0.1);
    group.add(e1);
    const p1 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), pupilMat);
    p1.position.set(-0.06, 0.47, -0.12);
    group.add(p1);
    const e2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    e2.position.set(0.06, 0.48, -0.1);
    group.add(e2);
    const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), pupilMat);
    p2.position.set(0.06, 0.47, -0.12);
    group.add(p2);

    // Чёрная кепка козырьком назад: круглая тулья + козырёк на затылке (+Z, т.к. лицо смотрит в -Z)
    const capMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
    const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.135, 8, 6), capMat);
    capCrown.position.y = 0.5;
    group.add(capCrown);
    const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.09), capMat);
    capBrim.position.set(0, 0.47, 0.13); // сзади головы — козырёк смотрит назад
    group.add(capBrim);

    // Джинсы
    const jeansMat = new THREE.MeshStandardMaterial({ color: 0x3a5578, roughness: 0.85 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), jeansMat);
    legL.position.set(-0.08, -0.1, 0);
    group.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), jeansMat);
    legR.position.set(0.08, -0.1, 0);
    group.add(legR);

    // Белые кроссовки
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.14), shoeMat);
    shoeL.position.set(-0.08, -0.21, -0.02);
    group.add(shoeL);
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.14), shoeMat);
    shoeR.position.set(0.08, -0.21, -0.02);
    group.add(shoeR);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0a878, roughness: 0.5 });
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), skinMat);
    armL.position.set(-0.2, 0.25, 0);
    group.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), skinMat);
    armR.position.set(0.2, 0.25, 0);
    group.add(armR);

    group.userData = { body, head, armL, armR };
    return group;
}

// Лёгкая "живая" анимация покоя — не стоит истуканом, но и никуда не идёт
function animateNPCIdle(npc, time) {
    const d = npc.mesh.userData;
    d.body.position.y = 0.2 + Math.sin(time * 1.3) * 0.008; // дыхание
    d.head.rotation.y = Math.sin(time * 0.4) * 0.2;          // изредка поглядывает по сторонам
    d.armL.rotation.z = 0.05 + Math.sin(time * 1.3 + 1) * 0.03;
    d.armR.rotation.z = -0.05 - Math.sin(time * 1.3) * 0.03;
}

let npc = null; // { mesh, x, z }

function placeNPC() {
    if (!castleInfo || trees.length === 0) return;

    const nearby = trees.filter(t => horizDist(t, castleInfo) < CONFIG.npc.searchRadius);
    const pool = nearby.length > 0 ? nearby : trees;
    const tree = pool[Math.floor(Math.random() * pool.length)];

    const angle = Math.random() * Math.PI * 2;
    const x = tree.x + Math.cos(angle) * 1.0;
    const z = tree.z + Math.sin(angle) * 1.0;

    const model = createNPCModel();
    model.position.set(x, -0.3, z);
    model.rotation.y = Math.random() * Math.PI * 2;
    scene.add(model);

    npc = { mesh: model, x, z };
    wallPositions.push({ x, z, halfW: 0.3, halfD: 0.3 });
}

// ===== СОЗДАНИЕ МОНСТРА =====
function createMonster(color = 0xff3333) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 6, 6),
        new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.15,
            roughness: 0.85 // темнее и более "звериная" фактура вместо гладкого пластика
        })
    );
    body.position.y = 0.25;
    group.add(body);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 6, 6),
        new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.2,
            roughness: 0.8
        })
    );
    head.position.y = 0.45;
    group.add(head);

    // Рога — добавляют угрозы силуэту
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 5), hornMat);
    hornL.position.set(-0.08, 0.58, -0.02);
    hornL.rotation.z = 0.3;
    group.add(hornL);
    const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 5), hornMat);
    hornR.position.set(0.08, 0.58, -0.02);
    hornR.rotation.z = -0.3;
    group.add(hornR);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat); // глаза крупнее и ярче
    e1.position.set(-0.07, 0.47, -0.13);
    group.add(e1);
    const e2 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
    e2.position.set(0.07, 0.47, -0.13);
    group.add(e2);

    const toothMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = -3; i <= 3; i++) { // больше зубов — оскал шире
        const tooth = new THREE.Mesh(
            new THREE.ConeGeometry(0.02, 0.055, 4), // зубы длиннее
            toothMat
        );
        tooth.position.set(i * 0.032, 0.42, -0.13);
        group.add(tooth);
    }

    const legL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.15, 4),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 })
    );
    legL.position.set(-0.08, -0.05, 0);
    group.add(legL);

    const legR = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.15, 4),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 })
    );
    legR.position.set(0.08, -0.05, 0);
    group.add(legR);

    const armL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.05, 0.3, 4),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 })
    );
    armL.position.set(-0.25, 0.25, 0);
    armL.rotation.z = 0.3;
    group.add(armL);

    const armR = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.05, 0.3, 4),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 })
    );
    armR.position.set(0.25, 0.25, 0);
    armR.rotation.z = -0.3;
    group.add(armR);

    const clawMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let side = -1; side <= 1; side += 2) {
        for (let i = -1; i <= 1; i++) {
            const claw = new THREE.Mesh(
                new THREE.ConeGeometry(0.015, 0.05, 4),
                clawMat
            );
            claw.position.set(side * 0.28, 0.15 + i * 0.06, 0);
            group.add(claw);
        }
    }

    group.userData = {
        body: body,
        head: head,
        legL: legL,
        legR: legR,
        armL: armL,
        armR: armR,
        animTime: 0,
        isWalking: false
    };

    group.scale.set(1.4, 1.4, 1.4); // крупнее и заметнее издалека

    return group;
}

// ===== АНИМАЦИЯ ХОДЬБЫ =====
function animateWalk(entity, time) {
    const data = entity.userData;
    if (!data) return;

    const speed = 4;
    const angle = time * speed;

    if (data.legL && data.legR) {
        const legSwing = Math.sin(angle) * 0.3;
        data.legL.rotation.x = legSwing;
        data.legR.rotation.x = -legSwing;
    }

    if (data.armL && data.armR) {
        const armSwing = Math.sin(angle) * 0.2;
        data.armL.rotation.x = -armSwing;
        data.armR.rotation.x = armSwing;
    }
}

// ===== СОЗДАНИЕ ЛЕСА =====
function createForest() {
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE),
        new THREE.MeshStandardMaterial({
            color: 0x2a4a2a,
            roughness: 1.0,
            metalness: 0.0
        })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    scene.add(ground);

    for (let i = 0; i < CONFIG.world.grassCount; i++) {
        const grass = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.04, 0.1, 3),
            new THREE.MeshStandardMaterial({ color: 0x3a6a3a })
        );
        const x = (Math.random() - 0.5) * (MAP_SIZE - 2);
        const z = (Math.random() - 0.5) * (MAP_SIZE - 2);
        grass.position.set(x, -0.45, z);
        grass.rotation.x = (Math.random() - 0.5) * 0.3;
        grass.rotation.z = (Math.random() - 0.5) * 0.3;
        scene.add(grass);
    }

    createStoneWall();
    generateHouses(scene, wallPositions, interiorColliders, stairZones, houseKeySpawnPoints, radioSpawnPoints, CONFIG, MAP_SIZE);
    if (radioSpawnPoints.length > 0) {
        const rp = radioSpawnPoints[0];
        createRadio(rp.x, rp.z, rp.y, rp.floor);
    }
    temple = generateTemple(scene, wallPositions, MAP_SIZE, CONFIG);
    castleInfo = generateCastle(scene, wallPositions, interiorColliders, stairZones, CONFIG, MAP_SIZE, (ex, ez, floor, feetY, homeBounds) => {
        const castleType = {
            speedMin: CONFIG.castle.enemySpeedMin,
            speedMax: CONFIG.castle.enemySpeedMax,
            color: CONFIG.castle.enemyColor,
        };
        createEnemy(ex, ez, castleType, {
            floor, feetY, homeBounds,
            hp: CONFIG.castle.enemyHp,
            indoor: true,
        });
    });
    createTrees();
    createBushes();
    placeItems();
    placeNPC();
}

// ===== КАМЕННАЯ СТЕНА =====
function createStoneWall() {
    const wallHeight = 3.0;
    const wallThickness = 0.8;
    const halfSize = MAP_SIZE / 2;
    const stoneColors = [0x6a6a6a, 0x7a7a7a, 0x5a5a5a, 0x8a8a8a, 0x6a5a4a];

    function addStoneWallSegment(x, z, w, d) {
        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(w, wallHeight, d),
            new THREE.MeshStandardMaterial({
                color: stoneColors[Math.floor(Math.random() * stoneColors.length)],
                roughness: 0.9,
                metalness: 0.1
            })
        );
        wall.position.set(x, wallHeight / 2 - 0.5, z);
        scene.add(wall);

        for (let i = 0; i < 8; i++) {
            const stone = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.3 + Math.random() * 0.4,
                    0.2 + Math.random() * 0.3,
                    0.2 + Math.random() * 0.3
                ),
                new THREE.MeshStandardMaterial({
                    color: stoneColors[Math.floor(Math.random() * stoneColors.length)],
                    roughness: 0.9
                })
            );
            const sx = (Math.random() - 0.5) * (w - 0.4);
            const sy = (Math.random() - 0.5) * (wallHeight - 0.6);
            const sz = (Math.random() - 0.5) * (d - 0.4);
            stone.position.set(x + sx, wallHeight / 2 - 0.5 + sy, z + sz);
            scene.add(stone);
        }

        wallPositions.push({
            x: x, z: z, w: w, d: d,
            halfW: w / 2 + 0.3,
            halfD: d / 2 + 0.3
        });
    }

    addStoneWallSegment(0, -halfSize, MAP_SIZE, wallThickness);
    addStoneWallSegment(0, halfSize, MAP_SIZE, wallThickness);
    addStoneWallSegment(-halfSize, 0, wallThickness, MAP_SIZE);
    addStoneWallSegment(halfSize, 0, wallThickness, MAP_SIZE);

    const towerPositions = [
        [-halfSize, -halfSize],
        [-halfSize, halfSize],
        [halfSize, -halfSize],
        [halfSize, halfSize]
    ];

    towerPositions.forEach(([tx, tz]) => {
        const tower = new THREE.Mesh(
            new THREE.CylinderGeometry(1.0, 1.2, wallHeight + 0.5, 8),
            new THREE.MeshStandardMaterial({
                color: 0x6a6a6a,
                roughness: 0.9
            })
        );
        tower.position.set(tx, wallHeight / 2 - 0.3, tz);
        scene.add(tower);

        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(1.2, 0.8, 8),
            new THREE.MeshStandardMaterial({
                color: 0x5a2a2a,
                roughness: 0.8
            })
        );
        roof.position.set(tx, wallHeight + 0.1, tz);
        scene.add(roof);
    });
}

// ===== СОЗДАНИЕ ДЕРЕВЬЕВ =====
function createTrees() {
    const numTrees = CONFIG.trees.min + Math.floor(Math.random() * (CONFIG.trees.max - CONFIG.trees.min));

    for (let i = 0; i < numTrees; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 30) {
            const x = (Math.random() - 0.5) * (MAP_SIZE - 4);
            const z = (Math.random() - 0.5) * (MAP_SIZE - 4);

            if (Math.sqrt(x * x + z * z) < 4) { attempts++; continue; }

            let overlap = false;
            for (let tree of trees) {
                if (Math.sqrt(Math.pow(tree.x - x, 2) + Math.pow(tree.z - z, 2)) < 1.5) {
                    overlap = true;
                    break;
                }
            }

            let onWall = false;
            for (let wall of wallPositions) {
                if (Math.abs(x - wall.x) < wall.halfW + 0.5 && Math.abs(z - wall.z) < wall.halfD + 0.5) {
                    onWall = true;
                    break;
                }
            }

            if (!overlap && !onWall && Math.abs(x) < MAP_SIZE / 2 - 1.5 && Math.abs(z) < MAP_SIZE / 2 - 1.5) {
                createTree(x, z);
                trees.push({ x, z });
                placed = true;
            }
            attempts++;
        }
    }
}

function createTree(x, z) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, 0, z);

    const treeHeight = 1.5 + Math.random() * 2;
    const trunkRadius = 0.08 + Math.random() * 0.08;

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, treeHeight * 0.5, 5),
        new THREE.MeshStandardMaterial({
            color: 0x4a3a2a,
            roughness: 0.9
        })
    );
    trunk.position.y = treeHeight * 0.25 - 0.5;
    treeGroup.add(trunk);

    const crownColor = new THREE.Color().setHSL(0.25 + Math.random() * 0.1, 0.6, 0.3 + Math.random() * 0.2);
    const numSpheres = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numSpheres; i++) {
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.4 + Math.random() * 0.6, 5, 5),
            new THREE.MeshStandardMaterial({
                color: crownColor,
                roughness: 0.8
            })
        );
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.2 + Math.random() * 0.3;
        sphere.position.set(
            Math.cos(angle) * radius,
            treeHeight * 0.5 + Math.random() * 0.4 - 0.3,
            Math.sin(angle) * radius
        );
        treeGroup.add(sphere);
    }

    scene.add(treeGroup);

    wallPositions.push({
        x: x,
        z: z,
        w: 0.6,
        d: 0.6,
        halfW: 0.5,
        halfD: 0.5
    });
}

// ===== СОЗДАНИЕ КУСТОВ =====
function createBushes() {
    const numBushes = CONFIG.bushes.min + Math.floor(Math.random() * (CONFIG.bushes.max - CONFIG.bushes.min));

    for (let i = 0; i < numBushes; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 20) {
            const x = (Math.random() - 0.5) * (MAP_SIZE - 3);
            const z = (Math.random() - 0.5) * (MAP_SIZE - 3);

            let overlap = false;
            for (let tree of trees) {
                if (Math.sqrt(Math.pow(tree.x - x, 2) + Math.pow(tree.z - z, 2)) < 0.8) {
                    overlap = true;
                    break;
                }
            }
            for (let bush of bushes) {
                if (Math.sqrt(Math.pow(bush.x - x, 2) + Math.pow(bush.z - z, 2)) < 0.6) {
                    overlap = true;
                    break;
                }
            }

            let onWall = false;
            for (let wall of wallPositions) {
                if (Math.abs(x - wall.x) < wall.halfW && Math.abs(z - wall.z) < wall.halfD) {
                    onWall = true;
                    break;
                }
            }

            if (!overlap && !onWall && Math.abs(x) < MAP_SIZE / 2 - 1.5 && Math.abs(z) < MAP_SIZE / 2 - 1.5) {
                createBush(x, z);
                bushes.push({ x, z });
                placed = true;
            }
            attempts++;
        }
    }
}

function createBush(x, z) {
    const bushGroup = new THREE.Group();
    bushGroup.position.set(x, 0, z);

    const bushColor = new THREE.Color().setHSL(0.25 + Math.random() * 0.1, 0.5, 0.2 + Math.random() * 0.15);

    const numSpheres = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numSpheres; i++) {
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 5, 5),
            new THREE.MeshStandardMaterial({
                color: bushColor,
                roughness: 0.9
            })
        );
        sphere.position.set(
            (Math.random() - 0.5) * 0.4,
            -0.3 + Math.random() * 0.2,
            (Math.random() - 0.5) * 0.4
        );
        bushGroup.add(sphere);
    }

    scene.add(bushGroup);

    wallPositions.push({
        x: x,
        z: z,
        w: 0.5,
        d: 0.5,
        halfW: 0.4,
        halfD: 0.4
    });
}

// ===== РАЗМЕЩЕНИЕ ПРЕДМЕТОВ =====
function placeItems() {
    // Ключи внутри домов (точки уже посчитаны в houses.js с учётом шанса и комнаты)
    houseKeySpawnPoints.forEach(point => {
        createKey(point.x, point.z, point.y, point.floor);
    });

    const numKeys = CONFIG.items.keys.min + Math.floor(Math.random() * (CONFIG.items.keys.max - CONFIG.items.keys.min + 1));
    for (let i = 0; i < numKeys; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 30) {
            const x = (Math.random() - 0.5) * (MAP_SIZE - 4);
            const z = (Math.random() - 0.5) * (MAP_SIZE - 4);

            let overlap = false;
            for (let tree of trees) {
                if (Math.sqrt(Math.pow(tree.x - x, 2) + Math.pow(tree.z - z, 2)) < 0.8) {
                    overlap = true;
                    break;
                }
            }
            for (let bush of bushes) {
                if (Math.sqrt(Math.pow(bush.x - x, 2) + Math.pow(bush.z - z, 2)) < 0.6) {
                    overlap = true;
                    break;
                }
            }

            let onWall = false;
            for (let wall of wallPositions) {
                if (Math.abs(x - wall.x) < wall.halfW && Math.abs(z - wall.z) < wall.halfD) {
                    onWall = true;
                    break;
                }
            }

            if (!overlap && !onWall && Math.abs(x) < MAP_SIZE / 2 - 2 && Math.abs(z) < MAP_SIZE / 2 - 2) {
                createKey(x, z);
                placed = true;
            }
            attempts++;
        }
    }

    const numLanterns = CONFIG.items.lanterns.min + Math.floor(Math.random() * (CONFIG.items.lanterns.max - CONFIG.items.lanterns.min + 1));
    for (let i = 0; i < numLanterns; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 20) {
            const x = (Math.random() - 0.5) * (MAP_SIZE - 4);
            const z = (Math.random() - 0.5) * (MAP_SIZE - 4);

            let overlap = false;
            for (let tree of trees) {
                if (Math.sqrt(Math.pow(tree.x - x, 2) + Math.pow(tree.z - z, 2)) < 0.8) {
                    overlap = true;
                    break;
                }
            }

            let onWall = false;
            for (let wall of wallPositions) {
                if (Math.abs(x - wall.x) < wall.halfW && Math.abs(z - wall.z) < wall.halfD) {
                    onWall = true;
                    break;
                }
            }

            if (!overlap && !onWall && Math.abs(x) < MAP_SIZE / 2 - 2 && Math.abs(z) < MAP_SIZE / 2 - 2) {
                createKey(x, z);
                placed = true;
            }
            attempts++;
        }
    }

    const numLanterns = CONFIG.items.lanterns.min + Math.floor(Math.random() * (CONFIG.items.lanterns.max - CONFIG.items.lanterns.min + 1));
    for (let i = 0; i < numLanterns; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 20) {
            const x = (Math.random() - 0.5) * (MAP_SIZE - 4);
            const z = (Math.random() - 0.5) * (MAP_SIZE - 4);

            let overlap = false;
            for (let tree of trees) {
                if (Math.sqrt(Math.pow(tree.x - x, 2) + Math.pow(tree.z - z, 2)) < 0.8) {
                    overlap = true;
                    break;
                }
            }

            let onWall = false;
            for (let wall of wallPositions) {
                if (Math.abs(x - wall.x) < wall.halfW && Math.abs(z - wall.z) < wall.halfD) {
                    onWall = true;
                    break;
                }
            }

            if (!overlap && !onWall && Math.abs(x) < MAP_SIZE / 2 - 2 && Math.abs(z) < MAP_SIZE / 2 - 2) {
                createLantern(x, z, 1 + Math.floor(Math.random() * 3));
                placed = true;
            }
            attempts++;
        }
    }

    const numEnemies = CONFIG.enemies.count.min + Math.floor(Math.random() * (CONFIG.enemies.count.max - CONFIG.enemies.count.min + 1));
    for (let i = 0; i < numEnemies; i++) {
        const spot = findEnemySpawnSpot();
        if (spot) {
            const type = CONFIG.enemies.types[i % CONFIG.enemies.types.length];
            createEnemy(spot.x, spot.z, type);
        }
    }
}

// Ищет валидную точку для врага (не в деревьях, не в стенах/домах, подальше от спавна игрока).
// Используется и при первой расстановке, и при возрождении убитых мечом врагов.
// Выбирает точку патрулирования. Если у врага задан homeBounds (враги замка) —
// патрулирует только в этих границах, чтобы не убегал из здания на улицу.
function pickPatrolTarget(enemy) {
    if (enemy.homeBounds) {
        const b = enemy.homeBounds;
        return {
            x: b.xMin + Math.random() * (b.xMax - b.xMin),
            z: b.zMin + Math.random() * (b.zMax - b.zMin),
        };
    }
    return {
        x: (Math.random() - 0.5) * (MAP_SIZE - 4),
        z: (Math.random() - 0.5) * (MAP_SIZE - 4),
    };
}

function findEnemySpawnSpot() {
    let attempts = 0;
    while (attempts < 20) {
        const x = (Math.random() - 0.5) * (MAP_SIZE - 6);
        const z = (Math.random() - 0.5) * (MAP_SIZE - 6);

        if (Math.sqrt(x * x + z * z) < 3) { attempts++; continue; }

        let overlap = false;
        for (let tree of trees) {
            if (Math.sqrt(Math.pow(tree.x - x, 2) + Math.pow(tree.z - z, 2)) < 1.0) {
                overlap = true;
                break;
            }
        }

        let onWall = false;
        for (let wall of wallPositions) {
            if (Math.abs(x - wall.x) < wall.halfW + 0.5 && Math.abs(z - wall.z) < wall.halfD + 0.5) {
                onWall = true;
                break;
            }
        }

        if (!overlap && !onWall && Math.abs(x) < MAP_SIZE / 2 - 2 && Math.abs(z) < MAP_SIZE / 2 - 2) {
            return { x, z };
        }
        attempts++;
    }
    return null;
}

// Убивает врага мечом: прячет его, а через 20-30 сек (см. CONFIG.enemyRespawn)
// возрождает в новом случайном месте карты.
function killEnemy(enemy) {
    enemy.dead = true;
    enemy.mesh.visible = false;

    const delaySec = CONFIG.enemyRespawn.minDelay + Math.random() * (CONFIG.enemyRespawn.maxDelay - CONFIG.enemyRespawn.minDelay);
    setTimeout(() => {
        if (enemy.indoor && enemy.homeBounds) {
            // Враг замка — возрождается в своей же комнате, на своём этаже
            const spot = pickPatrolTarget(enemy);
            enemy.mesh.position.set(spot.x, enemyModelY(enemy), spot.z);
        } else {
            const spot = findEnemySpawnSpot();
            if (spot) {
                enemy.mesh.position.set(spot.x, -0.3, spot.z);
            }
        }
        enemy.hp = enemy.maxHp;
        enemy.state = 'patrol';
        enemy.lastKnownX = null;
        enemy.lastKnownZ = null;
        enemy.attackCooldown = 0;
        enemy.dead = false;
        enemy.mesh.visible = true;
    }, delaySec * 1000);
}

// ===== СОЗДАНИЕ КЛЮЧА =====
function createKey(x, z, y = 0, floor = 0) {
    const keyGroup = new THREE.Group();
    keyGroup.position.set(x, y + 0.1, z);

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.04, 6, 8),
        new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xff8800,
            emissiveIntensity: 0.3,
            metalness: 0.9,
            roughness: 0.1
        })
    );
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = 0.2;
    keyGroup.add(ring);

    const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.3, 0.05),
        new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.9,
            roughness: 0.1
        })
    );
    shaft.position.set(0, -0.15, 0);
    keyGroup.add(shaft);

    const toothPos = [[0.08, -0.25], [-0.08, -0.25], [0.05, -0.18], [-0.05, -0.18]];
    toothPos.forEach(([tx, tz]) => {
        const tooth = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.06, 0.04),
            new THREE.MeshStandardMaterial({
                color: 0xffd700,
                metalness: 0.9,
                roughness: 0.1
            })
        );
        tooth.position.set(tx, tz, 0);
        keyGroup.add(tooth);
    });

    const beard = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.04, 0.04),
        new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.9,
            roughness: 0.1
        })
    );
    beard.position.set(0, -0.3, 0);
    keyGroup.add(beard);

    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 6, 6),
        new THREE.MeshBasicMaterial({
            color: 0xff8800,
            transparent: true,
            opacity: 0.1
        })
    );
    keyGroup.add(glow);

    scene.add(keyGroup);
    keys.push({
        group: keyGroup,
        x: x,
        z: z,
        y: y,
        floor: floor,
        collected: false
    });
}

// ===== СОЗДАНИЕ ФОНАРИКА =====
function createLantern(x, z, level) {
    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(x, 0, z);

    const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshStandardMaterial({
            color: 0xffdd44,
            emissive: 0xff8800,
            emissiveIntensity: 0.8,
            metalness: 0.8,
            roughness: 0.2
        })
    );
    light.position.y = 0.1;
    lanternGroup.add(light);

    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 6, 6),
        new THREE.MeshBasicMaterial({
            color: 0xff8800,
            transparent: true,
            opacity: 0.15
        })
    );
    glow.position.y = 0.1;
    lanternGroup.add(glow);

    const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.04, 0.15, 4),
        new THREE.MeshStandardMaterial({ color: 0x4a3a2a })
    );
    stand.position.y = -0.05;
    lanternGroup.add(stand);

    scene.add(lanternGroup);

    lanterns.push({
        mesh: light,
        glow: glow,
        group: lanternGroup,
        x: x,
        z: z,
        level: level,
        collected: false
    });
}

// ===== РАДИО =====
let radio = null; // { mesh, sound, x, z, floor, playing }

function createRadio(x, z, y, floor) {
    const group = new THREE.Group();
    group.position.set(x, y + 0.35, z);

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.28, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.3 })
    );
    group.add(body);

    const speakerMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const speakerL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 10), speakerMat);
    speakerL.rotation.x = Math.PI / 2;
    speakerL.position.set(-0.14, 0, 0.1);
    group.add(speakerL);
    const speakerR = speakerL.clone();
    speakerR.position.x = 0.14;
    group.add(speakerR);

    const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.35, 5),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7 })
    );
    antenna.position.set(0.18, 0.28, -0.05);
    antenna.rotation.z = -0.3;
    group.add(antenna);

    scene.add(group);

    const sound = new THREE.PositionalAudio(audioListener);
    const loader = new THREE.AudioLoader();
    loader.load(
        CONFIG.radio.trackPath,
        (buffer) => {
            sound.setBuffer(buffer);
            sound.setLoop(true);
            sound.setRefDistance(CONFIG.radio.refDistance);
            sound.setRolloffFactor(CONFIG.radio.rolloffFactor);
            sound.setVolume(CONFIG.radio.volume);
        },
        undefined,
        (err) => {
            console.warn('Не удалось загрузить трек радио:', CONFIG.radio.trackPath, err);
        }
    );
    group.add(sound);

    radio = { mesh: group, sound, x, z, floor, playing: false };
}

// ===== СОЗДАНИЕ ВРАГА =====
function createEnemy(x, z, type, opts = {}) {
    const monster = createMonster(type.color);
    const feetY = opts.feetY || 0;
    const indoor = !!opts.indoor;
    monster.position.set(x, indoor ? feetY + 0.2 : feetY - 0.3, z);
    scene.add(monster);

    enemies.push({
        mesh: monster,
        state: 'patrol',
        timer: Math.random() * 3,
        targetX: x,
        targetZ: z,
        speed: type.speedMin + Math.random() * (type.speedMax - type.speedMin), // юниты/сек
        searchTimer: 0,
        lastKnownX: null,
        lastKnownZ: null,
        lastKnownFloor: null,
        attackCooldown: 0,
        dead: false, // true, пока враг убит мечом и ждёт возрождения
        floor: opts.floor || 0,     // на каком этаже сейчас враг
        feetY: feetY,               // высота этажа под врагом (0 — улица)
        hp: opts.hp || 1,           // сколько ударов мечом нужно, чтобы убить
        maxHp: opts.hp || 1,
        indoor: indoor,             // true для врагов внутри зданий (замок) — не ходят гулять на улицу
        homeBounds: opts.homeBounds || null, // {xMin,xMax,zMin,zMax} — если задано, враг патрулирует только внутри этого прямоугольника на своём этаже
    });
}

// ===== ИГРОК =====
const playerModel = createHumanoid(0x4488ff);
playerModel.position.set(0, -0.3, 0);
scene.add(playerModel);
playerModel.visible = false;

// ===== ГЕНЕРИРУЕМ ЛЕС =====
createForest();

// ===== ПОЗИЦИЯ ИГРОКА =====
const playerPos = new THREE.Vector3(0, 0.5, 0);
camera.position.copy(playerPos);

// ===== УПРАВЛЕНИЕ =====
const controls = {
    yaw: 0,
    pitch: 0
};

// ===== ДЖОЙСТИК (ЛЕВЫЙ НИЖНИЙ УГОЛ) =====
const joystickData = {
    active: false,
    dx: 0,
    dz: 0,
    touchId: null
};

const JOYSTICK_SIZE = CONFIG.joystick.size;

const joystickOuter = document.createElement('div');
joystickOuter.style.cssText = `
    position: absolute;
    bottom: 40px;
    left: 40px;
    width: ${JOYSTICK_SIZE}px;
    height: ${JOYSTICK_SIZE}px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: 3px solid rgba(255,255,255,0.2);
    z-index: 10;
    backdrop-filter: blur(8px);
    touch-action: none;
    box-shadow: 0 0 30px rgba(0,0,0,0.4);
`;

const joystickInner = document.createElement('div');
joystickInner.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.25), rgba(255,255,255,0.05));
    border: 2px solid rgba(255,255,255,0.3);
    transition: none;
    box-shadow: 0 0 20px rgba(68,136,255,0.15);
`;

const joystickArrow = document.createElement('div');
joystickArrow.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 14px solid rgba(255,255,255,0.3);
    opacity: 0;
    transition: opacity 0.2s;
`;

joystickInner.appendChild(joystickArrow);
joystickOuter.appendChild(joystickInner);
document.body.appendChild(joystickOuter);

function getJoystickCenter() {
    const rect = joystickOuter.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
}

function updateJoystick(clientX, clientY) {
    const center = getJoystickCenter();
    let dx = clientX - center.x;
    let dy = clientY - center.y;

    const maxDist = JOYSTICK_SIZE / 2 - 10;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxDist) {
        dx = dx / dist * maxDist;
        dy = dy / dist * maxDist;
    }

    joystickInner.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    const normalizedDist = Math.min(dist, maxDist) / maxDist;
    const angle = Math.atan2(dy, dx);

    joystickData.dx = Math.cos(angle) * normalizedDist;
    joystickData.dz = -Math.sin(angle) * normalizedDist;

    if (dist > 5) {
        joystickArrow.style.opacity = '1';
        joystickArrow.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    } else {
        joystickArrow.style.opacity = '0';
    }
}

function resetJoystick() {
    joystickInner.style.transform = 'translate(-50%, -50%)';
    joystickData.dx = 0;
    joystickData.dz = 0;
    joystickData.active = false;
    joystickData.touchId = null;
    joystickArrow.style.opacity = '0';
}

// ===== СОБЫТИЯ ДЖОЙСТИКА =====
// stopPropagation здесь мешает документному обработчику получить этот тач
// как событие touchstart на joystickOuter, но не убирает его из общего
// списка активных тачей — поэтому обзор ниже фильтрует по identifier, а не по touches[0].
joystickOuter.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.changedTouches[0];
    joystickData.active = true;
    joystickData.touchId = touch.identifier;
    updateJoystick(touch.clientX, touch.clientY);
});

joystickOuter.addEventListener('touchmove', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!joystickData.active) return;
    for (const touch of e.changedTouches) {
        if (touch.identifier === joystickData.touchId) {
            updateJoystick(touch.clientX, touch.clientY);
        }
    }
});

joystickOuter.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    for (const touch of e.changedTouches) {
        if (touch.identifier === joystickData.touchId) {
            resetJoystick();
        }
    }
});

joystickOuter.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetJoystick();
});

// ===== ОСМОТР (СВАЙП ЛЮБЫМ ДРУГИМ ПАЛЬЦЕМ) =====
// ИСПРАВЛЕНО: раньше здесь брался e.touches[0] — то есть первый по счёту
// активный палец на экране. Если игрок держал джойстик (палец A) и потом
// свайпал вторым пальцем (палец B) для обзора, код ошибочно продолжал
// следить за пальцем A (джойстиком), а обзор либо не двигался, либо дёргался.
// Теперь обзор отслеживается по конкретному touch.identifier через changedTouches,
// независимо от порядка касаний — как уже было правильно сделано для джойстика.
let lookTouchId = null;
let lastLookX = null;
let lastLookY = null;

function isOnJoystick(x, y) {
    const rect = joystickOuter.getBoundingClientRect();
    const padding = 20;
    return x >= rect.left - padding && x <= rect.right + padding &&
           y >= rect.top - padding && y <= rect.bottom + padding;
}

document.addEventListener('touchstart', (e) => {
    for (const touch of e.changedTouches) {
        if (isOnJoystick(touch.clientX, touch.clientY)) continue;
        if (lookTouchId === null) {
            lookTouchId = touch.identifier;
            lastLookX = touch.clientX;
            lastLookY = touch.clientY;
        }
    }
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    for (const touch of e.changedTouches) {
        if (touch.identifier === lookTouchId) {
            const deltaX = touch.clientX - lastLookX;
            const deltaY = touch.clientY - lastLookY;

            controls.yaw -= deltaX * CONFIG.joystick.lookSensitivity;
            controls.pitch -= deltaY * CONFIG.joystick.lookSensitivity;
            controls.pitch = Math.max(-1.0, Math.min(1.0, controls.pitch));

            lastLookX = touch.clientX;
            lastLookY = touch.clientY;
        }
    }
}, { passive: true });

function releaseLookTouch(e) {
    for (const touch of e.changedTouches) {
        if (touch.identifier === lookTouchId) {
            lookTouchId = null;
            lastLookX = null;
            lastLookY = null;
        }
    }
}
document.addEventListener('touchend', releaseLookTouch, { passive: true });
document.addEventListener('touchcancel', releaseLookTouch, { passive: true });

// ===== МЫШЬ ДЛЯ ДЕБАГА (на телефоне не используется) =====
let isMouseLook = false;
let mouseLookX = null;
let mouseLookY = null;

renderer.domElement.addEventListener('mousedown', (e) => {
    if (!isOnJoystick(e.clientX, e.clientY)) {
        isMouseLook = true;
        mouseLookX = e.clientX;
        mouseLookY = e.clientY;
    }
});

document.addEventListener('mousemove', (e) => {
    if (isMouseLook && mouseLookX !== null) {
        const deltaX = e.clientX - mouseLookX;
        const deltaY = e.clientY - mouseLookY;

        controls.yaw -= deltaX * CONFIG.joystick.lookSensitivity;
        controls.pitch -= deltaY * CONFIG.joystick.lookSensitivity;
        controls.pitch = Math.max(-1.0, Math.min(1.0, controls.pitch));

        mouseLookX = e.clientX;
        mouseLookY = e.clientY;
    }
});

document.addEventListener('mouseup', () => {
    isMouseLook = false;
    mouseLookX = null;
    mouseLookY = null;
});

// ===== КОЛЛИЗИИ =====
// floor: 0 = первый этаж/улица, 1 = второй этаж. По умолчанию 0 (враги всегда снаружи/на 1 этаже).
// Расстояние только по X,Z, без учёта высоты. С появлением многоэтажных зданий
// обычный 3D distanceTo() стал бы врать (игрок на 5 этаже вверх по прямой "близко"
// по 3D, хотя реально далеко). Везде, где нужна "близость на месте", используем это.
function horizDist(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

// Высота МОДЕЛИ врага (не пола!) для текущего feetY. На улице пол — это визуальный
// меш на y=-0.5, а feetY=0 просто логический "0" (историческое несовпадение,
// -0.3 было подобрано на глаз именно под эту связку). Внутри домов/замка пол
// физически нарисован ровно на feetY, так что там нужен другой, маленький сдвиг,
// иначе враг проваливается под пол.
function enemyModelY(enemy) {
    return enemy.indoor ? enemy.feetY + 0.2 : enemy.feetY - 0.3;
}

function checkCollision(pos, floor = 0) {
    for (let wall of wallPositions) {
        if (wall.noCollide) continue; // это "тень" дома только для расстановки деревьев/кустов, игрока не блокирует
        if (Math.abs(pos.x - wall.x) < wall.halfW &&
            Math.abs(pos.z - wall.z) < wall.halfD) {
            return true;
        }
    }
    for (let obj of interiorColliders) {
        if (obj.floor !== floor) continue; // стены/мебель другого этажа не мешают
        if (Math.abs(pos.x - obj.x) < obj.halfW &&
            Math.abs(pos.z - obj.z) < obj.halfD) {
            return true;
        }
    }
    return false;
}

// ===== UI =====
const uiContainer = document.createElement('div');
uiContainer.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 6px;
    pointer-events: none;
`;

const keyCounter = document.createElement('div');
keyCounter.style.cssText = `
    color: #ffd700;
    font-family: 'Courier New', monospace;
    font-size: 18px;
    text-shadow: 0 0 15px #ff8800;
    background: rgba(0,0,0,0.6);
    padding: 8px 16px;
    border-radius: 8px;
    border: 2px solid #ffd700;
    backdrop-filter: blur(4px);
`;
keyCounter.textContent = `🔑 0/${keys.length}`;
uiContainer.appendChild(keyCounter);

const hint = document.createElement('div');
hint.style.cssText = `
    color: #88ccff;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    background: rgba(0,0,0,0.6);
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid #4488ff;
    backdrop-filter: blur(4px);
`;
hint.textContent = '👆 Веди пальцем по экрану для осмотра';
uiContainer.appendChild(hint);

document.body.appendChild(uiContainer);

// Здоровье
const healthBar = document.createElement('div');
healthBar.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 180px;
    height: 10px;
    background: rgba(0,0,0,0.7);
    border-radius: 12px;
    border: 1px solid #ff3333;
    z-index: 10;
    overflow: hidden;
`;
const healthFill = document.createElement('div');
healthFill.style.cssText = `
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, #ff0000, #ff6644);
    border-radius: 12px;
    transition: width 0.2s;
`;
healthBar.appendChild(healthFill);
document.body.appendChild(healthBar);

// Броня (щит) — над здоровьем, появляется только после экипировки амулета
const armorBar = document.createElement('div');
armorBar.style.cssText = `
    position: absolute;
    bottom: 34px;
    left: 50%;
    transform: translateX(-50%);
    width: 180px;
    height: 8px;
    background: rgba(0,0,0,0.7);
    border-radius: 12px;
    border: 1px solid #66ccff;
    z-index: 10;
    overflow: hidden;
    display: none;
`;
const armorFill = document.createElement('div');
armorFill.style.cssText = `
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, #3388ff, #66ccff);
    border-radius: 12px;
    transition: width 0.2s;
`;
armorBar.appendChild(armorFill);
document.body.appendChild(armorBar);

// Кнопка "Использовать амулет" — появляется, когда амулет подобран, исчезает после применения
const useAmuletBtn = document.createElement('button');
useAmuletBtn.textContent = '✨ Надеть амулет';
useAmuletBtn.style.cssText = `
    position: absolute;
    bottom: 110px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 18px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    color: #fff;
    background: rgba(170,0,136,0.85);
    border: 2px solid #ff44cc;
    border-radius: 10px;
    z-index: 15;
    display: none;
`;
document.body.appendChild(useAmuletBtn);

// Кнопка "использовать" (ладонь) — для радио и вообще предметов, на которые смотрим.
// Показывается/прячется каждый кадр в зависимости от того, куда направлен крестик.
const useObjectBtn = document.createElement('button');
useObjectBtn.textContent = '✋ Использовать';
useObjectBtn.style.cssText = `
    position: absolute;
    bottom: 145px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 18px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    color: #fff;
    background: rgba(40,40,40,0.85);
    border: 2px solid #ccc;
    border-radius: 10px;
    z-index: 15;
    display: none;
`;
document.body.appendChild(useObjectBtn);

// Кнопка меча — справа внизу (симметрично джойстику слева)
const swordBtn = document.createElement('div');
swordBtn.style.cssText = `
    position: absolute;
    bottom: 50px;
    right: 40px;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: 3px solid rgba(255,255,255,0.25);
    z-index: 10;
    display: none;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    touch-action: none;
    user-select: none;
`;
swordBtn.textContent = '⚔️';
document.body.appendChild(swordBtn);

// Крестик
const crosshair = document.createElement('div');
crosshair.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: rgba(255,255,255,0.5);
    font-size: 30px;
    z-index: 5;
    pointer-events: none;
    text-shadow: 0 0 10px rgba(0,0,0,0.8);
`;
crosshair.textContent = '+';
document.body.appendChild(crosshair);

const message = document.createElement('div');
message.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-family: 'Courier New', monospace;
    font-size: 30px;
    z-index: 20;
    display: none;
    text-align: center;
    background: rgba(0,0,0,0.9);
    padding: 30px 50px;
    border-radius: 15px;
    border: 3px solid #ffd700;
    backdrop-filter: blur(8px);
`;
document.body.appendChild(message);

// ===== ИГРОВАЯ ЛОГИКА =====
let health = CONFIG.player.maxHealth;
let keysCollected = 0;
let gameOver = false;
let damageCooldown = 0; // теперь в секундах, не в кадрах
const PLAYER_SPEED = CONFIG.player.speed;
let gameTime = 0;
const clock = new THREE.Clock();

// ===== ЭТАЖ ИГРОКА (для домов с лестницей) =====
let playerFloor = 0;       // 0 = первый этаж/улица, 1 = второй этаж
let playerFeetY = 0;       // высота "ног" игрока над землёй (0 внизу, floorHeight — наверху)
let currentFloorHeight = 0; // высота текущего этажа (нужна, чтобы держать feetY, когда игрок не на лестнице)

// ===== ФОНАРИК ИГРОКА =====
// Каждый подобранный фонарик добавляет "уровень" — от этого зависит сила и дальность света.
let flashlightPower = 0;
function updateFlashlight() {
    if (flashlightPower <= 0) {
        playerLight.intensity = 0;
        return;
    }
    playerLight.intensity = 1.2 + flashlightPower * 0.4;
    playerLight.distance = 8 + flashlightPower * 2.5;
}

// ===== ВЗАИМОДЕЙСТВИЕ С ПРЕДМЕТАМИ (наведение крестиком) =====
const interactRaycaster = new THREE.Raycaster();
const raycastDir = new THREE.Vector3();
let currentInteraction = null; // 'radio' | 'npc' | null

function updateInteractionTargets() {
    currentInteraction = null;
    let bestDist = Infinity;

    camera.getWorldDirection(raycastDir);
    interactRaycaster.set(camera.position, raycastDir);

    if (radio) {
        const hits = interactRaycaster.intersectObject(radio.mesh, true);
        if (hits.length > 0 && hits[0].distance < CONFIG.radio.useDistance && radio.floor === playerFloor && hits[0].distance < bestDist) {
            currentInteraction = 'radio';
            bestDist = hits[0].distance;
        }
    }

    if (npc) {
        const hits = interactRaycaster.intersectObject(npc.mesh, true);
        if (hits.length > 0 && hits[0].distance < CONFIG.npc.talkDistance && hits[0].distance < bestDist) {
            currentInteraction = 'npc';
            bestDist = hits[0].distance;
        }
    }

    if (currentInteraction === 'radio') {
        useObjectBtn.textContent = '✋ Использовать';
        useObjectBtn.style.display = 'block';
    } else if (currentInteraction === 'npc') {
        useObjectBtn.textContent = '💬 Говорить';
        useObjectBtn.style.display = 'block';
    } else {
        useObjectBtn.style.display = 'none';
    }
}

useObjectBtn.addEventListener('click', () => {
    if (currentInteraction === 'radio') {
        toggleRadio();
    } else if (currentInteraction === 'npc') {
        talkToNPC();
    }
});

function toggleRadio() {
    if (!radio.sound.buffer) {
        hint.textContent = '📻 Радио ещё грузится...';
        setTimeout(() => hint.textContent = '👆 Веди пальцем по экрану для осмотра', 1200);
        return;
    }
    if (radio.playing) {
        radio.sound.pause();
        radio.playing = false;
        hint.textContent = '📻 Радио выключено';
    } else {
        radio.sound.play();
        radio.playing = true;
        hint.textContent = '📻 Радио включено';
    }
    setTimeout(() => hint.textContent = '👆 Веди пальцем по экрану для осмотра', 1200);
}

const npcVoice = new Audio(CONFIG.npc.voicePath);
function talkToNPC() {
    npcVoice.currentTime = 0;
    npcVoice.play().catch(() => {
        hint.textContent = '⚠️ Не найден файл ' + CONFIG.npc.voicePath;
        setTimeout(() => hint.textContent = '👆 Веди пальцем по экрану для осмотра', 1500);
    });
}

// ===== АМУЛЕТ И БРОНЯ =====
let hasAmulet = false;
let armorEquipped = false;
let armor = 0;
let armorAnimPieces = []; // летящие части брони при экипировке
let armorAnimTimer = 0;   // 0..1, длительность анимации экипировки

useAmuletBtn.addEventListener('click', () => {
    if (!hasAmulet || armorEquipped) return;
    useAmuletBtn.style.display = 'none';
    startArmorEquipAnimation();
});

function startArmorEquipAnimation() {
    const pieceCount = 8;
    const pieceMat = new THREE.MeshStandardMaterial({ color: 0x99aacc, metalness: 0.8, roughness: 0.3, emissive: 0x223344, emissiveIntensity: 0.3 });
    for (let i = 0; i < pieceCount; i++) {
        const piece = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.05), pieceMat);
        // Стартуют в случайных точках вокруг камеры (как будто прилетели из воздуха)
        piece.position.set(
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 2.5,
            -1.5 - Math.random() * 2
        );
        camera.add(piece);
        armorAnimPieces.push({
            mesh: piece,
            start: piece.position.clone(),
            target: new THREE.Vector3((Math.random() - 0.5) * 0.15, -0.35 + (Math.random() - 0.5) * 0.1, -0.6),
        });
    }
    armorAnimTimer = 0.0001;
}

function updateArmorEquipAnimation(dt) {
    if (armorAnimTimer <= 0) return;
    armorAnimTimer += dt / 1.0; // ~1 секунда на анимацию

    const t = Math.min(armorAnimTimer, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out

    armorAnimPieces.forEach(p => {
        p.mesh.position.lerpVectors(p.start, p.target, eased);
        const scale = 1 - eased * 0.85;
        p.mesh.scale.set(scale, scale, scale);
    });

    if (t >= 1) {
        armorAnimPieces.forEach(p => camera.remove(p.mesh));
        armorAnimPieces = [];
        armorAnimTimer = 0;
        armorEquipped = true;
        armor = CONFIG.armor.max;
        armorBar.style.display = 'block';
        armorFill.style.width = '100%';
        swordBtn.style.display = 'flex';
        hint.textContent = '🛡️ Броня надета! Теперь доступен меч ⚔️';
        setTimeout(() => hint.textContent = '👆 Веди пальцем по экрану для осмотра', 2000);
    }
}

// ===== МЕЧ =====
let swordEquipped = false;
let attackCooldownTimer = 0;
let swordDrawTimer = 0;  // 0..1
let swordSwingTimer = 0; // 0..1

const swordGroup = new THREE.Group();
const bladeMat = new THREE.MeshStandardMaterial({ color: 0xccccdd, metalness: 0.9, roughness: 0.2 });
const hiltMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 });
const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.02), bladeMat);
blade.position.y = 0.35;
swordGroup.add(blade);
const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), hiltMat);
hilt.position.y = 0.0;
swordGroup.add(hilt);
const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), hiltMat);
guard.position.y = 0.08;
swordGroup.add(guard);

swordGroup.position.set(0.35, -0.9, -0.6); // начальная поза перед первым доставанием
swordGroup.rotation.z = 0.3;
swordGroup.visible = false; // по-настоящему скрыт, пока игрок не нажмёт атаку
camera.add(swordGroup);

function onAttackPress() {
    if (attackCooldownTimer > 0 || gameOver) return;
    attackCooldownTimer = CONFIG.sword.cooldown;
    swordGroup.visible = true;

    if (!swordEquipped) {
        swordEquipped = true;
        swordDrawTimer = 0.0001;
    } else {
        swordSwingTimer = 0.0001;
        performSwordHit();
    }
}

swordBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onAttackPress(); }, { passive: false });
swordBtn.addEventListener('click', onAttackPress);

function updateSwordAnimation(dt) {
    if (swordDrawTimer > 0) {
        swordDrawTimer += dt / CONFIG.sword.drawTime;
        const t = Math.min(swordDrawTimer, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        swordGroup.position.y = -0.9 + eased * 0.55; // поднимается снизу
        swordGroup.rotation.z = 0.3 * (1 - eased);
        if (t >= 1) swordDrawTimer = 0;
    } else if (swordSwingTimer > 0) {
        swordSwingTimer += dt / CONFIG.sword.swingTime;
        const t = Math.min(swordSwingTimer, 1);
        // Быстрый взмах вправо-влево
        swordGroup.rotation.z = 0.3 + Math.sin(t * Math.PI) * -1.3;
        swordGroup.position.y = -0.35;
        if (t >= 1) {
            swordSwingTimer = 0;
            swordGroup.rotation.z = 0.3;
        }
    } else if (swordEquipped) {
        swordGroup.position.y = -0.35; // спокойное положение наготове
    }
}

// Проверяет врагов в конусе перед игроком и убивает попавших (с одного удара)
function performSwordHit() {
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), controls.yaw);
    const halfAngle = (CONFIG.sword.angleDeg / 2) * (Math.PI / 180);

    enemies.forEach(enemy => {
        if (enemy.dead || enemy.floor !== playerFloor) return;
        const toEnemy = new THREE.Vector3(enemy.mesh.position.x - playerPos.x, 0, enemy.mesh.position.z - playerPos.z);
        const dist = toEnemy.length();
        if (dist > CONFIG.sword.range || dist < 0.001) return;

        toEnemy.normalize();
        const dot = Math.max(-1, Math.min(1, forward.dot(toEnemy)));
        const angle = Math.acos(dot);
        if (angle <= halfAngle) {
            hitEnemy(enemy);
        }
    });
}

// Наносит удар врагу. Обычные враги (hp=1) умирают сразу. Крепкие враги замка
// (hp>1) выдерживают несколько ударов — при попадании коротко вспыхивают белым.
function hitEnemy(enemy) {
    enemy.hp -= 1;
    if (enemy.hp <= 0) {
        killEnemy(enemy);
        return;
    }
    enemy.mesh.traverse(obj => {
        if (obj.material && obj.material.color) {
            if (obj.userData.origColorHex === undefined) {
                obj.userData.origColorHex = obj.material.color.getHex ? obj.material.color.getHex() : null;
            }
            obj.material.color.set(0xffffff);
            const mat = obj.material;
            const origHex = obj.userData.origColorHex;
            setTimeout(() => {
                if (origHex !== null && origHex !== undefined) mat.color.set(origHex);
            }, 120);
        }
    });
}

function updatePlayerFloor() {
    for (const sz of stairZones) {
        if (playerPos.x >= sz.xMin && playerPos.x <= sz.xMax &&
            playerPos.z >= sz.zMin && playerPos.z <= sz.zMax) {
            const t = THREE.MathUtils.clamp((playerPos.x - sz.xMin) / (sz.xMax - sz.xMin), 0, 1);
            playerFeetY = THREE.MathUtils.lerp(sz.fromY, sz.toY, t);
            if (t >= 0.97) playerFloor = sz.toFloor;
            else if (t <= 0.03) playerFloor = sz.fromFloor;
            return;
        }
    }
    // Не в зоне лестницы — playerFeetY просто остаётся как есть (уже на высоте своего этажа)
}

// Та же логика, что и у игрока, но для врага — позволяет монстрам подниматься/спускаться
// по тем же лестницам (используется общий stairZones и для домов, и для замка).
function updateEnemyFloor(enemy) {
    const pos = enemy.mesh.position;
    for (const sz of stairZones) {
        if (pos.x >= sz.xMin && pos.x <= sz.xMax && pos.z >= sz.zMin && pos.z <= sz.zMax) {
            const t = THREE.MathUtils.clamp((pos.x - sz.xMin) / (sz.xMax - sz.xMin), 0, 1);
            enemy.feetY = THREE.MathUtils.lerp(sz.fromY, sz.toY, t);
            if (t >= 0.97) enemy.floor = sz.toFloor;
            else if (t <= 0.03) enemy.floor = sz.fromFloor;
            pos.y = enemyModelY(enemy);
            return;
        }
    }
    pos.y = enemyModelY(enemy);
}

// ===== УМНЫЕ ВРАГИ =====
function updateEnemies(time, dt) {
    const pPos = playerPos;

    enemies.forEach(enemy => {
        if (enemy.dead) return; // ждёт возрождения — не двигается, не атакует, невидим

        updateEnemyFloor(enemy);

        const data = enemy.mesh.userData;
        const dist = horizDist(pPos, enemy.mesh.position);

        if (data) {
            data.isWalking = false;
        }

        if (dist > CONFIG.enemies.loseRadius) {
            enemy.state = 'patrol';
            enemy.searchTimer += dt;

            if (enemy.searchTimer > 3 + Math.random() * 2) {
                const target = pickPatrolTarget(enemy);
                enemy.targetX = target.x;
                enemy.targetZ = target.z;
                enemy.searchTimer = 0;
            }
        } else if (dist < CONFIG.enemies.chaseRadius && enemy.floor === playerFloor) {
            enemy.state = 'chase';
            enemy.lastKnownX = pPos.x;
            enemy.lastKnownZ = pPos.z;
            enemy.lastKnownFloor = playerFloor;

            const dir = new THREE.Vector3()
                .copy(pPos)
                .sub(enemy.mesh.position);
            dir.y = 0; // враг должен ХОДИТЬ по земле, а не лететь к высоте камеры игрока
            dir.normalize();

            const step = enemy.speed * 1.5 * dt;
            const newPos = enemy.mesh.position.clone().add(dir.clone().multiplyScalar(step));

            if (checkCollision(newPos, enemy.floor)) {
                const dir2 = dir.clone();
                const temp = dir2.x;
                dir2.x = -dir2.z;
                dir2.z = temp;

                const newPos2 = enemy.mesh.position.clone().add(dir2.multiplyScalar(step));
                if (!checkCollision(newPos2, enemy.floor)) {
                    enemy.mesh.position.copy(newPos2);
                } else {
                    const dir3 = dir.clone();
                    const temp2 = dir3.x;
                    dir3.x = dir3.z;
                    dir3.z = -temp2;

                    const newPos3 = enemy.mesh.position.clone().add(dir3.multiplyScalar(step));
                    if (!checkCollision(newPos3, enemy.floor)) {
                        enemy.mesh.position.copy(newPos3);
                    }
                }
            } else {
                enemy.mesh.position.copy(newPos);
            }

            enemy.mesh.lookAt(new THREE.Vector3(pPos.x, enemy.mesh.position.y, pPos.z));

            if (data) {
                data.isWalking = true;
            }

            if (enemy.attackCooldown > 0) {
                enemy.attackCooldown -= dt;
            }

            if (dist < CONFIG.enemies.attackRadius && enemy.floor === playerFloor && damageCooldown <= 0 && enemy.attackCooldown <= 0) {
                let incoming = CONFIG.enemies.damage;
                if (armorEquipped && armor > 0) {
                    const absorbed = Math.min(armor, incoming);
                    armor -= absorbed;
                    incoming -= absorbed;
                    armorFill.style.width = Math.max(0, (armor / CONFIG.armor.max) * 100) + '%';
                }
                if (incoming > 0) {
                    health -= incoming;
                    healthFill.style.width = Math.max(0, health) + '%';
                }
                if (incoming > 0) {
                    health -= incoming;
                    healthFill.style.width = Math.max(0, health) + '%';
                }
                damageCooldown = 0.4;
                enemy.attackCooldown = CONFIG.enemies.attackCooldown;

                document.body.style.backgroundColor = 'rgba(255,0,0,0.2)';
                setTimeout(() => document.body.style.backgroundColor = '', 100);

                const pushDir = new THREE.Vector3()
                    .copy(enemy.mesh.position)
                    .sub(pPos);
                pushDir.y = 0;
                pushDir.normalize();
                enemy.mesh.position.add(pushDir.multiplyScalar(0.8));
                enemy.mesh.position.y = enemyModelY(enemy); // страховка — враг всегда на своём полу

                if (health <= 0) {
                    gameOver = true;
                    message.style.display = 'block';
                    message.innerHTML = '💀 ТЫ УМЕР<br><span style="font-size:18px;">Нажми чтобы рестарт</span>';
                    message.style.borderColor = '#ff0000';
                    message.style.color = '#ff4444';
                }
            }
        } else {
            if (enemy.lastKnownX !== null) {
                const dir = new THREE.Vector3(
                    enemy.lastKnownX - enemy.mesh.position.x,
                    0,
                    enemy.lastKnownZ - enemy.mesh.position.z
                ).normalize();

                const newPos = enemy.mesh.position.clone().add(dir.multiplyScalar(enemy.speed * dt));
                if (!checkCollision(newPos, enemy.floor)) {
                    enemy.mesh.position.copy(newPos);
                }
                if (data) {
                    data.isWalking = true;
                }
            } else {
                enemy.state = 'patrol';
                enemy.searchTimer += dt;

                if (enemy.searchTimer > 3 + Math.random() * 2) {
                    const target = pickPatrolTarget(enemy);
                    enemy.targetX = target.x;
                    enemy.targetZ = target.z;
                    enemy.searchTimer = 0;
                }
            }
        }

        if (enemy.state === 'patrol') {
            const dir = new THREE.Vector3(
                enemy.targetX - enemy.mesh.position.x,
                0,
                enemy.targetZ - enemy.mesh.position.z
            );
            const distToTarget = dir.length();

            if (distToTarget > 0.5) {
                dir.normalize();
                const newPos = enemy.mesh.position.clone().add(dir.multiplyScalar(enemy.speed * 0.6 * dt));
                if (!checkCollision(newPos, enemy.floor)) {
                    enemy.mesh.position.copy(newPos);
                }
                if (data) {
                    data.isWalking = true;
                }
            } else {
                enemy.searchTimer = 3 + Math.random() * 2;
                if (data) {
                    data.isWalking = false;
                }
            }
        }

        if (data) {
            if (data.isWalking) {
                data.animTime += dt;
                animateWalk(enemy.mesh, data.animTime);
            } else {
                if (data.legL) data.legL.rotation.x = 0;
                if (data.legR) data.legR.rotation.x = 0;
                if (data.armL) data.armL.rotation.x = 0.3;
                if (data.armR) data.armR.rotation.x = -0.3;
            }
        }
    });
}

// ===== ОСНОВНОЙ ЦИКЛ =====
function animate() {
    requestAnimationFrame(animate);

    // ИСПРАВЛЕНО: раньше все скорости/анимации/таймеры были жёстко привязаны
    // к предположению "кадр = 1/60 сек" (constants типа 0.016, 0.01 добавлялись
    // каждый кадр). На слабом телефоне при просадке FPS игра реально
    // замедлялась — персонаж и враги двигались медленнее в реальном времени.
    // Теперь используется THREE.Clock и реальная deltaTime (dt), значения
    // скоростей приведены в "юниты/секунду", а не "юниты/кадр".
    const dt = Math.min(clock.getDelta(), 0.1); // ограничение на случай долгих пауз (сворачивание вкладки)
    gameTime += dt;
    updateDayNight();

    if (damageCooldown > 0) damageCooldown -= dt;
    if (attackCooldownTimer > 0) attackCooldownTimer -= dt;
    updateSwordAnimation(dt);
    updateArmorEquipAnimation(dt);

    if (!gameOver) {
        // ===== ДВИЖЕНИЕ =====
        const moveForward = joystickData.dz;
        const moveRight = joystickData.dx;

        if (Math.abs(moveForward) > 0.05 || Math.abs(moveRight) > 0.05) {
            const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), controls.yaw);
            const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), controls.yaw);

            const moveVec = new THREE.Vector3()
                .add(forward.clone().multiplyScalar(moveForward))
                .add(right.clone().multiplyScalar(moveRight));

            if (moveVec.length() > 1) {
                moveVec.normalize();
            }

            const newPos = playerPos.clone().add(moveVec.multiplyScalar(PLAYER_SPEED * dt));

            // Сначала пробуем полный диагональный шаг — это надёжнее, чем только
            // раздельные проверки по X и Z, которые в редких случаях позволяли
            // "срезать угол" небольшой мебели по диагонали.
            if (!checkCollision(newPos, playerFloor)) {
                playerPos.x = newPos.x;
                playerPos.z = newPos.z;
            } else {
                const tryX = new THREE.Vector3(newPos.x, playerPos.y, playerPos.z);
                if (!checkCollision(tryX, playerFloor)) {
                    playerPos.x = newPos.x;
                }

                const tryZ = new THREE.Vector3(playerPos.x, playerPos.y, newPos.z);
                if (!checkCollision(tryZ, playerFloor)) {
                    playerPos.z = newPos.z;
                }
            }

            const pData = playerModel.userData;
            if (pData) {
                pData.isWalking = true;
                pData.animTime += dt;
                animateWalk(playerModel, pData.animTime);
            }
        } else {
            const pData = playerModel.userData;
            if (pData) {
                pData.isWalking = false;
                if (pData.legL) pData.legL.rotation.x = 0;
                if (pData.legR) pData.legR.rotation.x = 0;
                if (pData.armL) pData.armL.rotation.x = 0;
                if (pData.armR) pData.armR.rotation.x = 0;
            }
        }

        playerModel.position.copy(playerPos);
        playerModel.rotation.y = controls.yaw;

        updatePlayerFloor();
        updateInteractionTargets();

        camera.position.copy(playerPos);
        camera.position.y = playerFeetY + CONFIG.player.eyeHeight;

        const euler = new THREE.Euler(controls.pitch, controls.yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);

        // Подбор амулета из храма
        if (temple && !hasAmulet) {
            const distToAmulet = horizDist(playerPos, temple);
            if (distToAmulet < 1.0) {
                hasAmulet = true;
                temple.mesh.visible = false;
                useAmuletBtn.style.display = 'block';
                hint.textContent = '✨ Амулет найден! Нажми кнопку, чтобы надеть';
                setTimeout(() => hint.textContent = '👆 Веди пальцем по экрану для осмотра', 2000);
            }
        }

        // Сбор фонариков
        lanterns.forEach(lantern => {
            if (!lantern.collected) {
                const dist = horizDist(playerPos, lantern);
                if (dist < 0.8) {
                    lantern.collected = true;
                    lantern.group.visible = false;
                    flashlightPower += lantern.level;
                    updateFlashlight();
                    hint.textContent = `✨ Фонарик +${lantern.level}! Свет ярче`;
                    setTimeout(() => hint.textContent = '👆 Веди пальцем по экрану для осмотра', 1500);
                }
            }
        });

        // Сбор ключей
        keys.forEach(key => {
            if (!key.collected && key.floor === playerFloor) {
                const dist = horizDist(playerPos, key);
                if (dist < 0.8) {
                    key.collected = true;
                    key.group.visible = false;
                    keysCollected++;
                    keyCounter.textContent = `🔑 ${keysCollected}/${keys.length}`;
                    hint.textContent = `✅ +1 ключ! Осталось ${keys.length - keysCollected}`;
                    setTimeout(() => hint.textContent = '👆 Веди пальцем по экрану для осмотра', 1500);
                }
            }
        });

        if (keysCollected === keys.length) {
            gameOver = true;
            message.style.display = 'block';
            message.innerHTML = '🎉 ПОБЕДА!<br><span style="font-size:18px;">Ты нашёл все ключи!</span>';
            message.style.borderColor = '#ffd700';
            message.style.color = '#ffd700';
        }

        updateEnemies(gameTime, dt);
    }

    keys.forEach((key, i) => {
        if (!key.collected) {
            key.group.rotation.y += 1.2 * dt;
            key.group.position.y = key.y + 0.1 + Math.sin(gameTime * 2 + i) * 0.05;
        }
    });

    lanterns.forEach((lantern, i) => {
        if (!lantern.collected) {
            lantern.mesh.rotation.y += 1.2 * dt;
            lantern.glow.rotation.y += 1.2 * dt;
            const pulse = 1 + Math.sin(gameTime * 2 + i) * 0.05;
            lantern.mesh.scale.set(pulse, pulse, pulse);
        }
    });

    if (temple && !hasAmulet) {
        temple.mesh.rotation.y += 0.8 * dt;
        temple.mesh.position.y = temple.baseY + Math.sin(gameTime * 1.5) * 0.08;
    }

    if (npc) {
        animateNPCIdle(npc, gameTime);
    }

    renderer.render(scene, camera);
}

animate();

// ===== РЕСТАРТ =====
document.addEventListener('click', () => {
    if (gameOver) {
        location.reload();
    }
});