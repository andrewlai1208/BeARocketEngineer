// js/app.js
import { LabAudio } from './audio.js';
import { initWorkshopScene, createVoxelCharacter, updateCharacterWalk } from './scene.js';
import { ComputerSystem } from '../computer/computerSystem.js';

console.log('[BeARocketEngineer] 研發系統啟動：模組化 ComputerSystem 連接中...');

const sfx = new LabAudio();
const computerSys = new ComputerSystem();
const STORAGE_KEY = 'BE_A_ROCKET_ENGINEER_SAVE_V1';

// ----------------------------------------------------
// 2022/07/01 正向計時系統
// ----------------------------------------------------
const PROJECT_START_TIME = new Date('2022-07-01T09:00:00').getTime();
const TIME_SCALE = 60; // 現實 1 秒 = 遊戲時間 1 分鐘

function formatGameDate(elapsedSeconds) {
  const current = new Date(PROJECT_START_TIME + elapsedSeconds * 1000);
  const y = current.getFullYear();
  const m = String(current.getMonth() + 1).padStart(2, '0');
  const d = String(current.getDate()).padStart(2, '0');
  const hh = String(current.getHours()).padStart(2, '0');
  const mm = String(current.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

// 讀取存檔
function loadSavedGameState() {
  const defaultState = {
    hasStarted: false,
    playerName: '阿剛',
    playerTitle: '新進研發隊員',
    budget: 35000,
    gameElapsedSeconds: 0,
    inventory: { chem_kno3: 0, chem_sorbitol: 0, graphite_rod: 0 },
    subsystems: { propulsion: 0, avionics: 0, structures: 0, integration: 0 },
    simResults: false,
    workstationStates: null
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed };
    }
  } catch (err) {
    console.warn('[Storage] 讀取失敗', err);
  }
  return defaultState;
}

const savedData = loadSavedGameState();
if (!savedData.hasStarted) {
  window.location.replace('login.html');
}

const gameState = {
  hasStarted: savedData.hasStarted,
  playerName: savedData.playerName,
  playerTitle: savedData.playerTitle || '新進研發隊員',
  budget: savedData.budget,
  gameElapsedSeconds: savedData.gameElapsedSeconds,
  inventory: savedData.inventory || {},
  subsystems: savedData.subsystems || { propulsion: 0, avionics: 0, structures: 0, integration: 0 },
  simResults: savedData.simResults || false,
  keys: { w: false, a: false, s: false, d: false },
  joystickVector: { x: 0, y: 0 },
  nearbyLaptop: null,
  isTeleporting: false
};

function saveGameState() {
  const dataToSave = {
    hasStarted: gameState.hasStarted,
    playerName: gameState.playerName,
    playerTitle: gameState.playerTitle,
    budget: gameState.budget,
    gameElapsedSeconds: gameState.gameElapsedSeconds,
    inventory: gameState.inventory,
    subsystems: gameState.subsystems,
    simResults: gameState.simResults,
    workstationStates: computerSys.getWorkstationSaveData()
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (err) {
    console.warn('[Storage] 存檔失敗', err);
  }
}

// 初始化 3D 畫布與場景
const canvas = document.getElementById('webgl-canvas');
const badgeContainer = document.getElementById('badge-container');
const { scene, camera, renderer, baseD, wallColliders, roomZones, portalZones, laptops } = initWorkshopScene(canvas);

// 生成主角
const player = createVoxelCharacter(0xf59e0b);
player.position.set(0, 0, 0);
scene.add(player);

const playerTag = document.createElement('div');
playerTag.id = 'player-tag';
playerTag.className = 'hud-badge bg-amber-500 text-white';
playerTag.innerText = `${gameState.playerName} | ${gameState.playerTitle}`;
badgeContainer.appendChild(playerTag);
player.userData.tagEl = playerTag;

// 為各筆電建立 3D 懸浮標籤
if (laptops) {
  laptops.forEach(lap => {
    const hint = document.createElement('div');
    hint.className = 'hud-badge bg-slate-900 text-cyan-300 font-bold text-[10px] hidden shadow-lg px-2.5 py-0.5 border border-cyan-500/40 pointer-events-none';
    hint.innerText = `[E] 操作 ${lap.name}`;
    badgeContainer.appendChild(hint);
    lap.hintEl = hint;
  });
}

function updateMetricsUI() {
  const b = document.getElementById('stat-budget');
  const t = document.getElementById('timer-display');
  const tb = document.getElementById('os-taskbar-budget');
  const tt = document.getElementById('os-taskbar-time');

  if (b) b.innerText = `$${gameState.budget.toLocaleString()}`;
  if (tb) tb.innerText = `$${gameState.budget.toLocaleString()}`;

  const dateStr = formatGameDate(gameState.gameElapsedSeconds);
  if (t) t.innerText = dateStr;
  if (tt) tt.innerText = dateStr;

  const pEl = document.getElementById('status-prop');
  const aEl = document.getElementById('status-av');
  const sEl = document.getElementById('status-struct');
  const iEl = document.getElementById('status-integ');

  if (pEl) pEl.innerText = `🔥 推進: ${gameState.subsystems.propulsion}/3`;
  if (aEl) aEl.innerText = `⚡ 航電: ${gameState.subsystems.avionics}/3`;
  if (sEl) sEl.innerText = `🛡️ 結構: ${gameState.subsystems.structures}/3`;
  if (iEl) iEl.innerText = `🧭 整合: ${gameState.subsystems.integration}/3`;
}
updateMetricsUI();

setInterval(() => {
  gameState.gameElapsedSeconds += TIME_SCALE;
  updateMetricsUI();
}, 1000);

// 初始化電腦系統並掛載存檔
async function startSystem() {
  await computerSys.init();
  if (savedData.workstationStates) {
    computerSys.loadWorkstationsFromSave(savedData.workstationStates);
  }
}
startSystem();

// 手機右下角互動按鈕
const btnMobileInteract = document.getElementById('btn-mobile-interact');
if (btnMobileInteract) {
  btnMobileInteract.addEventListener('click', (e) => {
    e.preventDefault();
    if (computerSys.currentLaptopId) {
      computerSys.closeLaptop();
    } else if (gameState.nearbyLaptop) {
      computerSys.openLaptop(gameState.nearbyLaptop, gameState, sfx, () => {
        saveGameState();
        updateMetricsUI();
      });
    }
  });
}

// 音效開關
const btnSound = document.getElementById('btn-sound-toggle');
if (btnSound) {
  btnSound.onclick = () => {
    const on = sfx.toggle();
    document.getElementById('sound-icon').innerText = on ? '🔊' : '🔇';
  };
}

// 試車發射檢驗
const btnLaunch = document.getElementById('btn-final-launch');
if (btnLaunch) {
  btnLaunch.onclick = () => {
    const modal = document.getElementById('result-modal');
    const rIcon = document.getElementById('res-icon');
    const rTitle = document.getElementById('res-title');
    const rBadge = document.getElementById('res-badge');
    const rDesc = document.getElementById('res-desc');
    modal.classList.remove('hidden');

    const p = gameState.subsystems.propulsion;
    const a = gameState.subsystems.avionics;
    const s = gameState.subsystems.structures;
    const i = gameState.subsystems.integration;
    const total = p + a + s + i;
    const dateStr = formatGameDate(gameState.gameElapsedSeconds);

    if (p >= 1 && total >= 4) {
      sfx.playSuccess();
      rIcon.innerText = '🚀';
      rTitle.innerText = '全系統試車圓滿成功！';
      rBadge.className = 'inline-block px-3 py-0.5 rounded-full text-[11px] font-mono-num font-bold mt-1 mb-2.5 bg-emerald-100 text-emerald-800 border border-emerald-300';
      rBadge.innerText = `COMPLETED AT: ${dateStr}`;
      rDesc.innerText = `推進發動機壓力曲線平穩、航電遙測封包順暢！全箭在試車場完成驗證！剩餘研發經費：$${gameState.budget.toLocaleString()}。`;
    } else {
      sfx.playAlarm();
      rIcon.innerText = '⚠️';
      rTitle.innerText = '次系統研發尚未齊備，無法點火試車';
      rBadge.className = 'inline-block px-3 py-0.5 rounded-full text-[11px] font-mono-num font-bold mt-1 mb-2.5 bg-amber-100 text-amber-800 border border-amber-300';
      rBadge.innerText = `CURRENT DATE: ${dateStr}`;
      rDesc.innerText = `推進組尚未在 OpenMotor 完成燃燒推力模擬。請走近推進組工作桌，打開筆電於應用商店下載 OpenMotor，至商城採購硝酸鉀與山梨醇進行試驗！`;
    }
  };
}

const btnRestart = document.getElementById('btn-restart');
if (btnRestart) {
  btnRestart.onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    document.body.style.transition = 'opacity 0.35s ease';
    document.body.style.opacity = '0';
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 350);
  };
}

// 投影標籤更新
const vProj = new THREE.Vector3();
function updateHUD() {
  if (player.userData.tagEl) {
    player.getWorldPosition(vProj);
    vProj.y += 2.2;
    vProj.project(camera);
    player.userData.tagEl.style.left = `${(vProj.x * 0.5 + 0.5) * window.innerWidth}px`;
    player.userData.tagEl.style.top = `${(-vProj.y * 0.5 + 0.5) * window.innerHeight}px`;
  }

  if (laptops) {
    laptops.forEach(lap => {
      if (lap.hintEl && !lap.hintEl.classList.contains('hidden')) {
        vProj.copy(lap.pos);
        vProj.y += 0.8;
        vProj.project(camera);
        lap.hintEl.style.left = `${(vProj.x * 0.5 + 0.5) * window.innerWidth}px`;
        lap.hintEl.style.top = `${(-vProj.y * 0.5 + 0.5) * window.innerHeight}px`;
      }
    });
  }
}

// 鍵盤監聽
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const code = e.code;
  if (code === 'KeyW' || code === 'ArrowUp') gameState.keys.w = true;
  if (code === 'KeyS' || code === 'ArrowDown') gameState.keys.s = true;
  if (code === 'KeyA' || code === 'ArrowLeft') gameState.keys.a = true;
  if (code === 'KeyD' || code === 'ArrowRight') gameState.keys.d = true;

  if (code === 'KeyE') {
    if (computerSys.currentLaptopId) {
      computerSys.closeLaptop();
    } else if (gameState.nearbyLaptop) {
      computerSys.openLaptop(gameState.nearbyLaptop, gameState, sfx, () => {
        saveGameState();
        updateMetricsUI();
      });
    }
  }
  if (code === 'Escape') {
    if (computerSys.currentLaptopId) computerSys.closeLaptop();
  }
});

window.addEventListener('keyup', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const code = e.code;
  if (code === 'KeyW' || code === 'ArrowUp') gameState.keys.w = false;
  if (code === 'KeyS' || code === 'ArrowDown') gameState.keys.s = false;
  if (code === 'KeyA' || code === 'ArrowLeft') gameState.keys.a = false;
  if (code === 'KeyD' || code === 'ArrowRight') gameState.keys.d = false;
});

// 手機搖桿觸控
function setupMobileJoystick() {
  const zone = document.getElementById('joystick-zone');
  const knob = document.getElementById('joystick-knob');
  if (!zone || !knob) return;

  let activeTouchId = null, originX = 0, originY = 0;
  const maxRadius = 45;

  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (activeTouchId !== null) return;
    const touch = e.changedTouches[0];
    activeTouchId = touch.identifier;
    const rect = zone.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;
  }, { passive: false });

  window.addEventListener('touchmove', e => {
    if (activeTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId) {
        const dx = touch.clientX - originX;
        const dy = touch.clientY - originY;
        const dist = Math.min(Math.hypot(dx, dy), maxRadius);
        const angle = Math.atan2(dy, dx);
        const knobX = Math.cos(angle) * dist;
        const knobY = Math.sin(angle) * dist;
        knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
        gameState.joystickVector.x = knobX / maxRadius;
        gameState.joystickVector.y = knobY / maxRadius;
        break;
      }
    }
  }, { passive: false });

  const endTouch = () => {
    if (activeTouchId === null) return;
    activeTouchId = null;
    gameState.joystickVector.x = 0;
    gameState.joystickVector.y = 0;
    knob.style.transform = 'translate(0px, 0px)';
  };

  window.addEventListener('touchend', endTouch);
  window.addEventListener('touchcancel', endTouch);
}
setupMobileJoystick();

function checkCollision(nx, nz) {
  const r = 0.35;
  for (const c of wallColliders) {
    if (nx + r > c.minX && nx - r < c.maxX && nz + r > c.minZ && nz - r < c.maxZ) {
      return true;
    }
  }
  return false;
}

function getCurrentRoom(x, z) {
  for (const zone of roomZones) {
    if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) {
      return zone;
    }
  }
  return null;
}

// 動畫主循環
let currentD = baseD || 9.5;
const targetLookAt = new THREE.Vector3(0, 0, 0);
const currentLookAt = new THREE.Vector3(0, 0, 0);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const rawDelta = clock.getDelta();
  const delta = Math.min(rawDelta, 0.05);

  let mx = 0;
  let mz = 0;
  const speed = 7.5 * delta;

  // 鍵盤移動向量校正 (D 鍵往 +X, -Z)
  if (gameState.keys.w) { mx -= speed * 0.7071; mz -= speed * 0.7071; }
  if (gameState.keys.s) { mx += speed * 0.7071; mz += speed * 0.7071; }
  if (gameState.keys.a) { mx -= speed * 0.7071; mz += speed * 0.7071; }
  if (gameState.keys.d) { mx += speed * 0.7071; mz -= speed * 0.7071; }

  // 手機搖桿
  const jx = gameState.joystickVector.x;
  const jy = gameState.joystickVector.y;
  if (Math.abs(jx) > 0.05 || Math.abs(jy) > 0.05) {
    const joySpeed = speed * Math.hypot(jx, jy);
    const rad = Math.atan2(jy, jx) - Math.PI / 4;
    mx += Math.cos(rad) * joySpeed;
    mz += Math.sin(rad) * joySpeed;
  }

  const isMoving = Math.abs(mx) > 0.0001 || Math.abs(mz) > 0.0001;
  if (isMoving) {
    const nextX = Math.max(-19.5, Math.min(19.5, player.position.x + mx));
    const nextZ = Math.max(-16.0, Math.min(13.8, player.position.z + mz));

    if (!checkCollision(nextX, player.position.z)) {
      player.position.x = nextX;
    }
    if (!checkCollision(player.position.x, nextZ)) {
      player.position.z = nextZ;
    }

    player.rotation.y = Math.atan2(mx, mz);
  }

  // 腿部擺動行走動畫
  updateCharacterWalk(player, isMoving, delta);

  // 筆電靠近判定
  let closeLaptop = null;
  if (laptops) {
    laptops.forEach(lap => {
      const dist = player.position.distanceTo(lap.pos);
      if (dist < 2.5) {
        closeLaptop = lap;
        lap.hintEl.classList.remove('hidden');
      } else {
        lap.hintEl.classList.add('hidden');
      }
    });
  }
  gameState.nearbyLaptop = closeLaptop;

  if (btnMobileInteract) {
    if (closeLaptop) {
      btnMobileInteract.classList.remove('opacity-40');
      btnMobileInteract.classList.add('opacity-100', 'ring-4', 'ring-cyan-300', 'animate-pulse');
      btnMobileInteract.innerText = '筆電';
    } else {
      btnMobileInteract.classList.remove('opacity-100', 'ring-4', 'ring-cyan-300', 'animate-pulse');
      btnMobileInteract.classList.add('opacity-40');
      btnMobileInteract.innerText = '互動';
    }
  }

  // 傳送跳轉偵測
  for (const portal of (portalZones || [])) {
    if (player.position.x >= portal.minX && player.position.x <= portal.maxX &&
        player.position.z >= portal.minZ && player.position.z <= portal.maxZ) {
      if (!gameState.isTeleporting) {
        gameState.isTeleporting = true;
        sfx.playSelect();
        saveGameState();

        document.body.style.transition = 'opacity 0.35s ease';
        document.body.style.opacity = '0';
        setTimeout(() => {
          window.location.href = portal.url;
        }, 350);
      }
      break;
    }
  }

  // 鏡頭動態跟隨
  const currentRoom = getCurrentRoom(player.position.x, player.position.z);
  let targetD = baseD || 9.5;
  if (currentRoom) {
    targetD = 6.2;
    targetLookAt.set(
      currentRoom.focusOffset[0] * 0.4 + player.position.x * 0.6,
      0.8,
      currentRoom.focusOffset[2] * 0.4 + player.position.z * 0.6
    );
  } else {
    targetLookAt.set(player.position.x * 0.8, 0, player.position.z * 0.8);
  }

  currentD += (targetD - currentD) * Math.min(1.0, delta * 3.5);
  if (isNaN(currentD) || currentD < 1.0) currentD = baseD || 9.5;

  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -currentD * aspect;
  camera.right = currentD * aspect;
  camera.top = currentD;
  camera.bottom = -currentD;
  camera.updateProjectionMatrix();

  currentLookAt.lerp(targetLookAt, Math.min(1.0, delta * 4.0));
  camera.position.set(
    currentLookAt.x + 18,
    currentLookAt.y + 22,
    currentLookAt.z + 18
  );
  camera.lookAt(currentLookAt);

  updateHUD();
  renderer.render(scene, camera);
}

// 修正：將變數統一宣告為 aspect
window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -currentD * aspect;
  camera.right = currentD * aspect;
  camera.top = currentD;
  camera.bottom = -currentD;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();