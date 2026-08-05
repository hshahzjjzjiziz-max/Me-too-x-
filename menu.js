// ============================================================
// СТАРТОВОЕ МЕНЮ
// Этот файл НЕ подключает Three.js и НЕ строит мир — только простая
// DOM-заставка. Именно поэтому она гарантированно появляется мгновенно,
// даже если сама игра (game.js) потом долго генерирует лес/дома/замок
// или где-то упадёт с ошибкой — меню к этому моменту уже на экране,
// а не "чёрный экран в никуда".
//
// game.js подключается ("import") только в момент нажатия "Играть",
// не раньше.
// ============================================================

const menuRoot = document.createElement('div');
menuRoot.style.cssText = `
    position: fixed; inset: 0; z-index: 100;
    background: #0d1410;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 18px; font-family: 'Courier New', monospace; color: #fff; text-align: center;
    padding: 20px;
`;

const menuTitle = document.createElement('div');
menuTitle.textContent = '🌲 Лесное выживание';
menuTitle.style.cssText = 'font-size: 26px; text-shadow: 0 0 15px #4a9a4a;';
menuRoot.appendChild(menuTitle);

const menuSubtitle = document.createElement('div');
menuSubtitle.textContent = 'Ищи ключи, берегись монстров, найди амулет и меч';
menuSubtitle.style.cssText = 'font-size: 13px; color: #aaddaa; max-width: 280px;';
menuRoot.appendChild(menuSubtitle);

const playBtn = document.createElement('button');
playBtn.textContent = '▶️ Играть';
playBtn.style.cssText = `
    padding: 16px 40px; font-size: 18px; font-family: 'Courier New', monospace;
    background: rgba(80,180,80,0.25); color: #fff; border: 2px solid #6fcf6f;
    border-radius: 12px; margin-top: 10px;
`;
menuRoot.appendChild(playBtn);

const menuStatus = document.createElement('div');
menuStatus.style.cssText = 'font-size: 12px; color: #88aa88; min-height: 16px;';
menuRoot.appendChild(menuStatus);

document.body.appendChild(menuRoot);

playBtn.addEventListener('click', async () => {
    playBtn.disabled = true;
    playBtn.textContent = 'Загрузка...';
    menuStatus.textContent = 'Строим лес, дома и замок — это может занять немного времени';

    try {
        await import('./game.js'); // вся тяжёлая работа — тут, меню уже видно, пока она идёт
        menuRoot.remove();
    } catch (err) {
        console.error('Не удалось запустить игру:', err);
        playBtn.disabled = false;
        playBtn.textContent = '▶️ Играть';
        menuStatus.textContent = '⚠️ Ошибка запуска игры — открой консоль браузера для подробностей';
    }
});
