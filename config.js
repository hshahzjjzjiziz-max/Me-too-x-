// ============================================================
// КОНФИГ ИГРЫ
// Здесь только ДАННЫЕ: сколько чего, какие враги, скорости и т.д.
// Логика (как это всё работает) находится в game.js и её трогать
// для обычных правок не нужно — правь только этот файл.
// ============================================================

export const CONFIG = {
    // ----- Мир -----
    world: {
        mapSize: 180,
        grassCount: 1400,
    },

    // ----- Деревья -----
    trees: {
        min: 70,
        max: 150,
    },

    // ----- Кусты -----
    bushes: {
        min: 50,
        max: 120,
    },

    // ----- Предметы -----
    items: {
        keys: { min: 6, max: 8 },
        lanterns: { min: 30, max: 50 },
    },

    // ----- Враги -----
    enemies: {
        count: { min: 4, max: 6 },

        // Каждый тип — это цвет + диапазон скорости (юниты/сек).
        // Чтобы добавить нового врага, просто добавь новый объект в массив.
        types: [
            { name: 'Красный',    color: 0xff3333, speedMin: 1.3, speedMax: 2.3 },
            { name: 'Оранжевый',  color: 0xff6633, speedMin: 1.3, speedMax: 2.3 },
            { name: 'Фиолетовый', color: 0xcc33ff, speedMin: 1.3, speedMax: 2.3 },
            { name: 'Розовый',    color: 0xff3366, speedMin: 1.3, speedMax: 2.3 },
        ],

        chaseRadius: 4,
        loseRadius: 8,
        attackRadius: 1.2,
        damage: 14,
        attackCooldown: 0.5,
    },

    // ----- Игрок -----
    player: {
        speed: 3.2,
        eyeHeight: 0.5,
        maxHealth: 100,
    },

    // ----- Управление -----
    joystick: {
        size: 140,
        lookSensitivity: 0.005,
    },

    // ----- Дома -----
    houses: {
        count: 5,
        doorWidth: 1.4,

        types: [
            {
                name: 'small',
                floors: 1,
                width: 6, depth: 5,
                wallHeight: 2.6,
                rooms: 1,
                color: 0xc9a876,
                weight: 3,
            },
            {
                name: 'medium',
                floors: 1,
                width: 9, depth: 7,
                wallHeight: 2.7,
                rooms: 3,
                color: 0xb08968,
                weight: 2,
            },
            {
                name: 'large',
                floors: 2,
                width: 12, depth: 9,
                wallHeight: 2.8,
                rooms: 4,
                color: 0x9c7c5c,
                weight: 1,
            },
        ],

        keyChance: 0.55,
    },

    // ----- Храм (амулет брони) -----
    temple: {
        width: 8, depth: 8,
        wallHeight: 4,
        columnColor: 0xd9d2c3,
        roofColor: 0x8a7f6d,
        floorColor: 0x6b6255,
    },

    // ----- Броня -----
    armor: {
        max: 100, // сколько брони даёт амулет; тратится как щит, до здоровья
    },

    // ----- Меч -----
    sword: {
        range: 3.2,      // дальность удара, юниты
        angleDeg: 75,     // ширина конуса удара (полный угол), градусы
        cooldown: 0.5,    // пауза между ударами, сек
        drawTime: 0.4,    // сколько длится анимация доставания меча
        swingTime: 0.25,  // сколько длится анимация взмаха
    },

    // ----- Возрождение врагов -----
    enemyRespawn: {
        minDelay: 20, // сек после смерти
        maxDelay: 30,
    },

    // ----- День/ночь -----
    dayNight: {
        cycleDuration: 240,  // полный круг день+ночь, сек (по 2 минуты на каждый)
        orbitRadius: 70,     // на каком расстоянии "летают" солнце/луна

        sunColor: 0xfff2cc,
        sunIntensity: 1.15,
        moonColor: 0x8fa8d9,
        moonIntensity: 0.35,

        dayAmbient: { color: 0x88aa88, intensity: 0.55 },
        nightAmbient: { color: 0x334455, intensity: 0.35 },

        daySky: 0x8fb8d9,
        nightSky: 0x1a2a1a,
    },

    // ----- Замок -----
    castle: {
        width: 22, depth: 16,
        wallHeight: 3.2,      // высота КАЖДОГО этажа
        floors: 5,
        roomsPerSide: 3,      // комнат с каждой стороны коридора на этаже
        color: 0x7a7268,
        roofColor: 0x4a4038,
        enemiesPerFloor: 2,
        enemyHp: 3,           // сколько ударов мечом нужно, чтобы убить врага замка
        enemyColor: 0x882222, // цвет "рыцарей" замка (отдельный от обычных монстров)
        enemySpeedMin: 1.0,
        enemySpeedMax: 1.6,
    },

    // ----- Радио -----
    radio: {
        // Файл звука — положи его в папку sounds/ рядом с index.html и укажи имя тут
        trackPath: 'sounds/radio.mp3',
        useDistance: 2.5,   // с какого расстояния можно нажать "использовать"
        refDistance: 3,     // на этой дистанции звук ещё "полный", дальше — тише
        rolloffFactor: 1.3, // как быстро звук затухает с расстоянием
        volume: 1.0,
    },

    // ----- НПС у замка -----
    npc: {
        voicePath: 'sounds/npc_greeting.mp3', // положи файл сюда — имя можно поменять
        talkDistance: 2.5,
        searchRadius: 15, // искать дерево для НПС в этом радиусе от замка
    },
};