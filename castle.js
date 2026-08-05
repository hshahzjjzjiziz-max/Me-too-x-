import * as THREE from 'three';

// ============================================================
// ЗАМОК
// Много этажей (по умолчанию 5), на каждом — коридор посередине
// и комнаты по бокам. Одна лестничная шахта проходит через все этажи
// в одном и том же месте (X,Z), меняется только высота — так и получается
// "настоящая" лестница наверх через всё здание.
//
// Как и в домах: коллизии стен/комнат кладутся в interiorColliders с полем
// floor — так игрок и враги не проваливаются друг в друга сквозь этажи.
// Врагов сам файл не создаёт (у него нет доступа к общему списку enemies
// в game.js) — вместо этого он вызывает переданную функцию spawnEnemyFn
// для каждой точки, где нужен враг.
// ============================================================

function addWallSeg(scene, interiorColliders, x, z, w, d, height, y, floor, color) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, height, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
    );
    mesh.position.set(x, y + height / 2, z);
    scene.add(mesh);
    interiorColliders.push({ x, z, halfW: w / 2 + 0.05, halfD: d / 2 + 0.05, floor });
}

function addWallWithGap(scene, interiorColliders, opts) {
    const { axis, fixedCoord, from, to, thickness, height, y, floor, color, gapCenter, gapWidth } = opts;
    const segments = [];
    if (gapCenter === null || gapCenter === undefined) {
        segments.push([from, to]);
    } else {
        const gapStart = gapCenter - gapWidth / 2;
        const gapEnd = gapCenter + gapWidth / 2;
        if (gapStart > from) segments.push([from, gapStart]);
        if (gapEnd < to) segments.push([gapEnd, to]);
    }
    segments.forEach(([segFrom, segTo]) => {
        const len = segTo - segFrom;
        if (len <= 0.05) return;
        const center = (segFrom + segTo) / 2;
        if (axis === 'x') {
            addWallSeg(scene, interiorColliders, center, fixedCoord, len, thickness, height, y, floor, color);
        } else {
            addWallSeg(scene, interiorColliders, fixedCoord, center, thickness, len, height, y, floor, color);
        }
    });
}

function addFloorPiece(scene, mat, x0, x1, z0, z1, y) {
    const w = x1 - x0, d = z1 - z0;
    if (w <= 0.05 || d <= 0.05) return;
    const piece = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    piece.rotation.x = -Math.PI / 2;
    piece.position.set((x0 + x1) / 2, y + 0.02, (z0 + z1) / 2);
    scene.add(piece);
}

// Пол этажа. Если передан holeBounds — вырезает над ним дыру (там, где снизу
// поднимается лестница), иначе — сплошной пол.
function buildFloorSurface(scene, mat, cx, cz, width, depth, y, holeBounds) {
    const fMinX = cx - width / 2 + 0.15, fMaxX = cx + width / 2 - 0.15;
    const fMinZ = cz - depth / 2 + 0.15, fMaxZ = cz + depth / 2 - 0.15;

    if (!holeBounds) {
        addFloorPiece(scene, mat, fMinX, fMaxX, fMinZ, fMaxZ, y);
        return;
    }
    const hMinX = Math.max(fMinX, holeBounds.xMin), hMaxX = Math.min(fMaxX, holeBounds.xMax);
    const hMinZ = Math.max(fMinZ, holeBounds.zMin), hMaxZ = Math.min(fMaxZ, holeBounds.zMax);

    addFloorPiece(scene, mat, fMinX, fMaxX, fMinZ, hMinZ, y);
    addFloorPiece(scene, mat, fMinX, fMaxX, hMaxZ, fMaxZ, y);
    addFloorPiece(scene, mat, fMinX, hMinX, hMinZ, hMaxZ, y);
    addFloorPiece(scene, mat, hMaxX, fMaxX, hMinZ, hMaxZ, y);
}

// Строит один пролёт лестницы между двумя этажами и возвращает границы проёма в полу.
function buildStaircase(scene, stairZones, cx, cz, fromFloor, toFloor, fromY, toY) {
    const stairWidth = 1.4;
    const stairLength = 3.6;
    const xStart = cx - stairLength / 2;
    const xEnd = cx + stairLength / 2;
    const zPos = cz;

    const steps = 12;
    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const step = new THREE.Mesh(
            new THREE.BoxGeometry(stairLength / steps + 0.02, 0.15, stairWidth),
            new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 })
        );
        step.position.set(xStart + t * stairLength, fromY + t * (toY - fromY), zPos);
        scene.add(step);
    }

    stairZones.push({
        xMin: xStart, xMax: xEnd,
        zMin: zPos - stairWidth / 2, zMax: zPos + stairWidth / 2,
        fromFloor, toFloor, fromY, toY,
    });

    return {
        xMin: xStart - 0.3, xMax: xEnd + 0.3,
        zMin: zPos - stairWidth / 2 - 0.3, zMax: zPos + stairWidth / 2 + 0.3,
    };
}

// spawnEnemyFn(x, z, floor, feetY, homeBounds) — вызывается для каждой точки спавна врага
export function generateCastle(scene, wallPositions, interiorColliders, stairZones, CONFIG, MAP_SIZE, spawnEnemyFn) {
    const cfg = CONFIG.castle;
    const halfW = cfg.width / 2, halfD = cfg.depth / 2;
    const GROUND_Y = -0.5;

    let x = 0, z = 0, attempts = 0, ok = false;
    while (!ok && attempts < 60) {
        x = (Math.random() - 0.5) * (MAP_SIZE - (cfg.width + 16));
        z = (Math.random() - 0.5) * (MAP_SIZE - (cfg.depth + 16));
        const clearOfSpawn = Math.sqrt(x * x + z * z) > 22;
        let overlap = false;
        for (const wall of wallPositions) {
            if (Math.abs(x - wall.x) < (wall.halfW + halfW + 2) &&
                Math.abs(z - wall.z) < (wall.halfD + halfD + 2)) {
                overlap = true;
                break;
            }
        }
        ok = clearOfSpawn && !overlap;
        attempts++;
    }

    wallPositions.push({ x, z, halfW: halfW + 2, halfD: halfD + 2, noCollide: true });

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9, side: THREE.DoubleSide });
    const roomsByFloor = []; // roomsByFloor[f] = [{xMin,xMax,zMin,zMax}, ...]

    // Одна и та же X,Z-точка на всех этажах — так лестницы стоят друг над другом,
    // образуя сквозную лестничную шахту через всё здание.
    const stairCx = x + halfW - 3;
    const stairCz = z - halfD + 3;

    let prevHole = null;

    for (let f = 0; f < cfg.floors; f++) {
        const y = GROUND_Y + f * cfg.wallHeight;
        const hasDoor = f === 0;
        roomsByFloor[f] = [];

        // Внешние стены (дверь только на первом этаже)
        addWallWithGap(scene, interiorColliders, { axis: 'x', fixedCoord: z + halfD, from: x - halfW, to: x + halfW, thickness: 0.3, height: cfg.wallHeight, y, floor: f, color: cfg.color, gapCenter: hasDoor ? x : null, gapWidth: 1.6 });
        addWallWithGap(scene, interiorColliders, { axis: 'x', fixedCoord: z - halfD, from: x - halfW, to: x + halfW, thickness: 0.3, height: cfg.wallHeight, y, floor: f, color: cfg.color, gapCenter: null, gapWidth: 0 });
        addWallWithGap(scene, interiorColliders, { axis: 'z', fixedCoord: x - halfW, from: z - halfD, to: z + halfD, thickness: 0.3, height: cfg.wallHeight, y, floor: f, color: cfg.color, gapCenter: null, gapWidth: 0 });
        addWallWithGap(scene, interiorColliders, { axis: 'z', fixedCoord: x + halfW, from: z - halfD, to: z + halfD, thickness: 0.3, height: cfg.wallHeight, y, floor: f, color: cfg.color, gapCenter: null, gapWidth: 0 });

        // Центральный коридор вдоль Z, комнаты по обе стороны от него
        const corridorWidth = 2.4;
        const roomCountPerSide = cfg.roomsPerSide;
        const sideDepth = (halfD * 2 - 1) / roomCountPerSide;

        for (let side = -1; side <= 1; side += 2) {
            const wallX = x + side * corridorWidth / 2;
            for (let r = 0; r < roomCountPerSide; r++) {
                const rZFrom = z - halfD + 0.5 + sideDepth * r;
                const rZTo = z - halfD + 0.5 + sideDepth * (r + 1);
                const roomZCenter = (rZFrom + rZTo) / 2;

                addWallWithGap(scene, interiorColliders, {
                    axis: 'z', fixedCoord: wallX,
                    from: rZFrom, to: rZTo,
                    thickness: 0.2, height: cfg.wallHeight, y, floor: f, color: cfg.color,
                    gapCenter: roomZCenter, gapWidth: 1.3,
                });

                roomsByFloor[f].push({
                    xMin: side > 0 ? wallX : x - halfW + 0.3,
                    xMax: side > 0 ? x + halfW - 0.3 : wallX,
                    zMin: rZFrom,
                    zMax: rZTo,
                });
            }
        }

        // Лестница вверх (кроме самого верхнего этажа) + дыра в полу ЭТОГО этажа
        // под лестницу, которая поднимается СЮДА снизу (prevHole)
        let hole = null;
        if (f < cfg.floors - 1) {
            hole = buildStaircase(scene, stairZones, stairCx, stairCz, f, f + 1, y, y + cfg.wallHeight);
        }
        buildFloorSurface(scene, floorMat, x, z, cfg.width, cfg.depth, y, prevHole);
        prevHole = hole;

        if (f === cfg.floors - 1) {
            const roof = new THREE.Mesh(
                new THREE.BoxGeometry(cfg.width + 0.6, 0.4, cfg.depth + 0.6),
                new THREE.MeshStandardMaterial({ color: cfg.roofColor, roughness: 0.9 })
            );
            roof.position.set(x, y + cfg.wallHeight + 0.2, z);
            scene.add(roof);
        }
    }

    // Враги — по несколько на каждом этаже, в случайных комнатах
    for (let f = 0; f < cfg.floors; f++) {
        const rooms = roomsByFloor[f];
        for (let i = 0; i < cfg.enemiesPerFloor; i++) {
            const room = rooms[Math.floor(Math.random() * rooms.length)];
            if (!room) continue;
            const ex = (room.xMin + room.xMax) / 2;
            const ez = (room.zMin + room.zMax) / 2;
            spawnEnemyFn(ex, ez, f, GROUND_Y + f * cfg.wallHeight, room);
        }
    }

    return { x, z };
}
