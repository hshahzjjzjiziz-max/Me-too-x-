import * as THREE from 'three';

// ============================================================
// ДОМА
// Этот файл только СТРОИТ дома (меши + данные для коллизий).
// Он ничего не знает про игрока, врагов и т.д. — просто возвращает
// списки объектов, которые game.js использует в своей логике.
//
// Важное архитектурное решение: коллизии домов НЕ кладутся в общий
// wallPositions (который 2D и не различает этажи) — они кладутся в
// отдельный interiorColliders с полем floor (0 или 1), чтобы стены
// верхнего этажа не блокировали игрока внизу и наоборот.
// В wallPositions кладётся только одна "теневая" запись на весь дом
// с флагом noCollide:true — она нужна ТОЛЬКО чтобы деревья/кусты/ключи
// не заспавнились поверх дома (используется существующими проверками
// в game.js), но не мешает игроку — checkCollision её пропускает.
// ============================================================

function pickHouseType(types) {
    const totalWeight = types.reduce((sum, t) => sum + (t.weight || 1), 0);
    let r = Math.random() * totalWeight;
    for (const t of types) {
        r -= (t.weight || 1);
        if (r <= 0) return t;
    }
    return types[types.length - 1];
}

// Добавляет прямоугольную стену с дверным проёмом (2 сегмента + пустота между ними)
function addWallWithGap(scene, interiorColliders, opts) {
    const { axis, fixedCoord, from, to, thickness, height, y, floor, color, gapCenter, gapWidth } = opts;
    // axis: 'x' — стена идёт вдоль X (fixedCoord — это Z), 'z' — стена идёт вдоль Z (fixedCoord — это X)

    const segments = [];
    if (gapCenter === null) {
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

        let w, d, x, z;
        if (axis === 'x') {
            w = len; d = thickness;
            x = center; z = fixedCoord;
        } else {
            w = thickness; d = len;
            x = fixedCoord; z = center;
        }

        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, height, d),
            new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
        );
        mesh.position.set(x, y + height / 2, z);
        scene.add(mesh);

        interiorColliders.push({
            x, z,
            halfW: w / 2 + 0.05,
            halfD: d / 2 + 0.05,
            floor,
        });
    });
}

// Простая мебель — коробка, которая одновременно и меш, и коллайдер
function addFurniture(scene, interiorColliders, x, z, w, d, h, y, floor, color) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
    );
    mesh.position.set(x, y + h / 2, z);
    scene.add(mesh);

    interiorColliders.push({
        x, z,
        halfW: w / 2,
        halfD: d / 2,
        floor,
    });
}

function furnishRoom(scene, interiorColliders, cx, cz, w, d, floor, y) {
    // Раскидываем 1-2 случайных предмета мебели по комнате, подальше от стен
    const furnitureTypes = [
        { w: 1.2, d: 0.6, h: 0.5, color: 0x6b4a3a }, // кровать/лавка
        { w: 0.6, d: 0.6, h: 0.7, color: 0x4a3a2a }, // тумба
        { w: 0.8, d: 0.8, h: 0.05, color: 0x3a2a1a }, // стол (низкий, почти не мешает)
    ];
    const count = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
        const type = furnitureTypes[Math.floor(Math.random() * furnitureTypes.length)];
        const margin = 0.6;
        const maxOffsetX = Math.max(0, w / 2 - type.w / 2 - margin);
        const maxOffsetZ = Math.max(0, d / 2 - type.d / 2 - margin);
        const fx = cx + (Math.random() - 0.5) * 2 * maxOffsetX;
        const fz = cz + (Math.random() - 0.5) * 2 * maxOffsetZ;
        addFurniture(scene, interiorColliders, fx, fz, type.w, type.d, type.h, y, floor, type.color);
    }
}

// Строит один этаж дома: 4 внешние стены (с дверным проёмом, если передан) + внутренние перегородки
function buildFloor(scene, interiorColliders, house, floor, y, wallHeight, hasDoor, holeBounds = null) {
    const { x: hx, z: hz, width, depth } = house;
    const halfW = width / 2;
    const halfD = depth / 2;
    const wallColor = house.type.color;
    const doorWidth = house.doorWidth;

    // Южная стена (по +Z) — с дверью только на первом этаже
    addWallWithGap(scene, interiorColliders, {
        axis: 'x', fixedCoord: hz + halfD,
        from: hx - halfW, to: hx + halfW,
        thickness: 0.25, height: wallHeight, y, floor,
        color: wallColor,
        gapCenter: hasDoor ? hx : null,
        gapWidth: doorWidth,
    });
    // Северная стена
    addWallWithGap(scene, interiorColliders, {
        axis: 'x', fixedCoord: hz - halfD,
        from: hx - halfW, to: hx + halfW,
        thickness: 0.25, height: wallHeight, y, floor,
        color: wallColor, gapCenter: null, gapWidth: 0,
    });
    // Западная стена
    addWallWithGap(scene, interiorColliders, {
        axis: 'z', fixedCoord: hx - halfW,
        from: hz - halfD, to: hz + halfD,
        thickness: 0.25, height: wallHeight, y, floor,
        color: wallColor, gapCenter: null, gapWidth: 0,
    });
    // Восточная стена
    addWallWithGap(scene, interiorColliders, {
        axis: 'z', fixedCoord: hx + halfW,
        from: hz - halfD, to: hz + halfD,
        thickness: 0.25, height: wallHeight, y, floor,
        color: wallColor, gapCenter: null, gapWidth: 0,
    });

    // Деревянный пол дома (просто визуально, поверх общей травы)
    // Если передан holeBounds (проём лестницы) — пол строится "рамкой" из 4 кусков
    // вокруг дыры, чтобы над лестницей не было сплошной текстуры пола.
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9, side: THREE.DoubleSide });
    const fMinX = hx - width / 2 + 0.15, fMaxX = hx + width / 2 - 0.15;
    const fMinZ = hz - depth / 2 + 0.15, fMaxZ = hz + depth / 2 - 0.15;

    function addFloorPiece(x0, x1, z0, z1) {
        const w = x1 - x0, d = z1 - z0;
        if (w <= 0.05 || d <= 0.05) return;
        const piece = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
        piece.rotation.x = -Math.PI / 2;
        piece.position.set((x0 + x1) / 2, y + 0.02, (z0 + z1) / 2);
        scene.add(piece);
    }

    if (holeBounds) {
        const hMinX = Math.max(fMinX, holeBounds.xMin);
        const hMaxX = Math.min(fMaxX, holeBounds.xMax);
        const hMinZ = Math.max(fMinZ, holeBounds.zMin);
        const hMaxZ = Math.min(fMaxZ, holeBounds.zMax);

        addFloorPiece(fMinX, fMaxX, fMinZ, hMinZ);   // север от дыры
        addFloorPiece(fMinX, fMaxX, hMaxZ, fMaxZ);   // юг от дыры
        addFloorPiece(fMinX, hMinX, hMinZ, hMaxZ);   // запад от дыры
        addFloorPiece(hMaxX, fMaxX, hMinZ, hMaxZ);   // восток от дыры
    } else {
        addFloorPiece(fMinX, fMaxX, fMinZ, fMaxZ);
    }

    // Внутренние перегородки — грубое разбиение на комнаты
    const rooms = house.type.rooms;
    const roomCenters = [];

    if (rooms <= 1) {
        roomCenters.push([hx, hz]);
    } else {
        // Одна перегородка пополам по X
        const gapZ = hz - halfD + doorWidth; // проём ближе к одной стороне
        addWallWithGap(scene, interiorColliders, {
            axis: 'z', fixedCoord: hx,
            from: hz - halfD + 0.3, to: hz + halfD - 0.3,
            thickness: 0.2, height: wallHeight, y, floor,
            color: wallColor,
            gapCenter: gapZ, gapWidth: doorWidth,
        });

        const leftCx = hx - halfW / 2;
        const rightCx = hx + halfW / 2;

        if (rooms === 2) {
            roomCenters.push([leftCx, hz], [rightCx, hz]);
        } else {
            // Ещё одна перегородка делит правую половину пополам по Z
            addWallWithGap(scene, interiorColliders, {
                axis: 'x', fixedCoord: hz,
                from: hx + 0.2, to: hx + halfW - 0.3,
                thickness: 0.2, height: wallHeight, y, floor,
                color: wallColor,
                gapCenter: hx + halfW / 2, gapWidth: doorWidth,
            });
            const topRightCz = hz - halfD / 2;
            const botRightCz = hz + halfD / 2;
            roomCenters.push([leftCx, hz], [rightCx, topRightCz], [rightCx, botRightCz]);

            if (rooms >= 4) {
                // И левую половину тоже делим — получаем 4-ю комнату
                addWallWithGap(scene, interiorColliders, {
                    axis: 'x', fixedCoord: hz,
                    from: hx - halfW + 0.3, to: hx - 0.2,
                    thickness: 0.2, height: wallHeight, y, floor,
                    color: wallColor,
                    gapCenter: hx - halfW / 2, gapWidth: doorWidth,
                });
                const topLeftCz = hz - halfD / 2;
                const botLeftCz = hz + halfD / 2;
                roomCenters.length = 0;
                roomCenters.push(
                    [leftCx, topLeftCz], [leftCx, botLeftCz],
                    [rightCx, topRightCz], [rightCx, botRightCz]
                );
            }
        }
    }

    // Мебель в каждой комнате
    const roomW = rooms <= 1 ? width : halfW;
    const roomD = rooms <= 2 ? depth : halfD;
    roomCenters.forEach(([rx, rz]) => {
        furnishRoom(scene, interiorColliders, rx, rz, roomW, roomD, floor, y);
    });

    return roomCenters;
}

// Строит лестницу (визуальные ступени + зона для game.js, где считается высота)
// Возвращает границы проёма в полу над лестницей (holeBounds) — они нужны,
// чтобы верхний этаж не рисовался сплошным полом прямо над лестницей.
function buildStairs(scene, stairZones, house, floorHeight, groundY) {
    const { x: hx, z: hz, width, depth } = house;
    const halfW = width / 2;
    const halfD = depth / 2;

    const stairWidth = 1.2;
    const stairLength = Math.min(3.2, width - 2);
    const zPos = hz - halfD + 1.0;
    const xStart = hx + halfW - 1.0 - stairLength;
    const xEnd = hx + halfW - 1.0;

    const steps = 10;
    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const stepMesh = new THREE.Mesh(
            new THREE.BoxGeometry(stairLength / steps + 0.02, 0.15, stairWidth),
            new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 })
        );
        stepMesh.position.set(
            xStart + (t) * stairLength,
            groundY + t * floorHeight,
            zPos
        );
        scene.add(stepMesh);
    }

    stairZones.push({
        xMin: xStart, xMax: xEnd,
        zMin: zPos - stairWidth / 2, zMax: zPos + stairWidth / 2,
        fromFloor: 0, toFloor: 1,
        fromY: groundY, toY: groundY + floorHeight,
    });

    // Небольшой запас вокруг лестницы, чтобы дыра была чуть шире самих ступеней
    return {
        xMin: xStart - 0.3, xMax: xEnd + 0.3,
        zMin: zPos - stairWidth / 2 - 0.3, zMax: zPos + stairWidth / 2 + 0.3,
    };
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================
export function generateHouses(scene, wallPositions, interiorColliders, stairZones, keySpawnPoints, radioSpawnPoints, CONFIG, MAP_SIZE) {
    const cfg = CONFIG.houses;
    const houses = [];
    const GROUND_Y = -0.5; // та же база, что у земли/деревьев/каменной стены — иначе дома "парят"
    const radioHouseIndex = Math.floor(Math.random() * cfg.count); // ровно один дом получит радио

    for (let i = 0; i < cfg.count; i++) {
        const type = pickHouseType(cfg.types);
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 40) {
            const margin = Math.max(type.width, type.depth) / 2 + 3;
            const x = (Math.random() - 0.5) * (MAP_SIZE - margin * 2);
            const z = (Math.random() - 0.5) * (MAP_SIZE - margin * 2);

            const halfW = type.width / 2 + 2; // запас, чтобы дома не лепились друг к другу
            const halfD = type.depth / 2 + 2;

            // Не даём дому появиться на точке старта игрока (0,0) — иначе камера
            // окажется внутри/впритык к стене и экран будет выглядеть чёрным.
            const spawnClearRadius = 9;
            if (Math.sqrt(x * x + z * z) < spawnClearRadius) {
                attempts++;
                continue;
            }

            let overlap = false;
            for (const wall of wallPositions) {
                if (Math.abs(x - wall.x) < (wall.halfW + halfW) &&
                    Math.abs(z - wall.z) < (wall.halfD + halfD)) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                const house = { x, z, width: type.width, depth: type.depth, type, doorWidth: cfg.doorWidth };
                houses.push(house);

                // "Теневая" запись только для avoidance — игрока не блокирует (noCollide)
                wallPositions.push({
                    x, z,
                    halfW: type.width / 2 + 1,
                    halfD: type.depth / 2 + 1,
                    noCollide: true,
                });

                // Первый этаж — всегда floor 0, с дверью
                const roomsFloor0 = buildFloor(scene, interiorColliders, house, 0, GROUND_Y, type.wallHeight, true);

                if (i === radioHouseIndex) {
                    const [rx, rz] = roomsFloor0[Math.floor(Math.random() * roomsFloor0.length)];
                    radioSpawnPoints.push({ x: rx, z: rz, y: GROUND_Y, floor: 0 });
                }

                // Крыша (или перекрытие ко 2 этажу)
                if (type.floors === 2) {
                    const stairHole = buildStairs(scene, stairZones, house, type.wallHeight, GROUND_Y);
                    // Второй этаж — floor 1, без внешней двери, с дырой в полу над лестницей
                    buildFloor(scene, interiorColliders, house, 1, GROUND_Y + type.wallHeight, type.wallHeight, false, stairHole);

                    const roofY = GROUND_Y + type.wallHeight * 2;
                    const roof = new THREE.Mesh(
                        new THREE.ConeGeometry(Math.max(type.width, type.depth) * 0.75, 1.6, 4),
                        new THREE.MeshStandardMaterial({ color: 0x6a3a2a, roughness: 0.85 })
                    );
                    roof.rotation.y = Math.PI / 4;
                    roof.position.set(x, roofY + 0.8, z);
                    scene.add(roof);

                    // Шанс ключа — на любом из двух этажей
                    if (Math.random() < cfg.keyChance) {
                        const floor = Math.random() < 0.5 ? 0 : 1;
                        const rooms = floor === 0 ? roomsFloor0 : roomsFloor0; // разбивка комнат одинаковая на обоих этажах
                        const [rx, rz] = rooms[Math.floor(Math.random() * rooms.length)];
                        keySpawnPoints.push({ x: rx, z: rz, floor, y: GROUND_Y + (floor === 1 ? type.wallHeight : 0) });
                    }
                } else {
                    const roof = new THREE.Mesh(
                        new THREE.ConeGeometry(Math.max(type.width, type.depth) * 0.75, 1.4, 4),
                        new THREE.MeshStandardMaterial({ color: 0x6a3a2a, roughness: 0.85 })
                    );
                    roof.rotation.y = Math.PI / 4;
                    roof.position.set(x, GROUND_Y + type.wallHeight + 0.7, z);
                    scene.add(roof);

                    if (Math.random() < cfg.keyChance) {
                        const [rx, rz] = roomsFloor0[Math.floor(Math.random() * roomsFloor0.length)];
                        keySpawnPoints.push({ x: rx, z: rz, floor: 0, y: GROUND_Y });
                    }
                }

                placed = true;
            }
            attempts++;
        }
    }

    return houses;
}
