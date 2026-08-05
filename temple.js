import * as THREE from 'three';

// ============================================================
// ХРАМ
// Колонны вместо сплошных стен — вход просто там, где нет колонны,
// не нужна логика дверного проёма как у домов. Коллизия колонн и
// постамента кладётся напрямую в wallPositions (обычные, не noCollide) —
// он не завязан на этажи, поэтому floor-логика домов тут не нужна.
// ============================================================

export function generateTemple(scene, wallPositions, MAP_SIZE, CONFIG) {
    const cfg = CONFIG.temple;
    const halfW = cfg.width / 2;
    const halfD = cfg.depth / 2;
    const GROUND_Y = -0.5;

    let x = 0, z = 0;
    let attempts = 0;
    let ok = false;

    while (!ok && attempts < 50) {
        x = (Math.random() - 0.5) * (MAP_SIZE - (cfg.width + 12));
        z = (Math.random() - 0.5) * (MAP_SIZE - (cfg.depth + 12));

        const clearOfSpawn = Math.sqrt(x * x + z * z) > 16;
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

    // "Теневая" запись — чтобы деревья/кусты не заспавнились внутри храма
    wallPositions.push({ x, z, halfW: halfW + 1.5, halfD: halfD + 1.5, noCollide: true });

    // Каменный пол храма
    const floorMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(cfg.width, cfg.depth),
        new THREE.MeshStandardMaterial({ color: cfg.floorColor, roughness: 0.85 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(x, GROUND_Y + 0.03, z);
    scene.add(floorMesh);

    // Колонны по периметру — с широким проёмом спереди (по +Z) для входа
    const columnHeight = cfg.wallHeight;
    const columnPositions = [
        [-halfW, -halfD], [0, -halfD], [halfW, -halfD],  // задняя стена
        [-halfW, 0], [halfW, 0],                          // боковые
        [-halfW, halfD], [halfW, halfD],                  // передние углы (вход между ними)
    ];

    columnPositions.forEach(([ox, oz]) => {
        const cx = x + ox, cz = z + oz;
        const column = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.42, columnHeight, 8),
            new THREE.MeshStandardMaterial({ color: cfg.columnColor, roughness: 0.8 })
        );
        column.position.set(cx, GROUND_Y + columnHeight / 2, cz);
        scene.add(column);

        wallPositions.push({ x: cx, z: cz, halfW: 0.45, halfD: 0.45 });
    });

    // Крыша — плоская каменная плита на колоннах
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.width + 0.6, 0.4, cfg.depth + 0.6),
        new THREE.MeshStandardMaterial({ color: cfg.roofColor, roughness: 0.9 })
    );
    roof.position.set(x, GROUND_Y + columnHeight + 0.2, z);
    scene.add(roof);

    // Постамент в центре — на нём амулет
    const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.8, 1.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 })
    );
    pedestal.position.set(x, GROUND_Y + 0.5, z);
    scene.add(pedestal);
    wallPositions.push({ x, z, halfW: 0.7, halfD: 0.7 });

    // Амулет — светящийся кулон, парит и вращается над постаментом
    const amuletGroup = new THREE.Group();
    amuletGroup.position.set(x, GROUND_Y + 1.35, z);

    const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22, 0),
        new THREE.MeshStandardMaterial({
            color: 0xff44cc,
            emissive: 0xaa0088,
            emissiveIntensity: 0.6,
            metalness: 0.6,
            roughness: 0.2,
        })
    );
    amuletGroup.add(gem);

    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff44cc, transparent: true, opacity: 0.15 })
    );
    amuletGroup.add(glow);

    scene.add(amuletGroup);

    return { x, z, mesh: amuletGroup, baseY: amuletGroup.position.y };
}
