// js/app.js
import { LabAudio } from './audio.js';
import { EventsEngine } from './eventsEngine.js';
import { initWorkshopScene, createVoxelCharacter, updateCharacterWalk } from './scene.js';

console.log('[BeARocketEngineer] 辦公室核心引擎啟動...');

const sfx = new LabAudio();
const engine = new EventsEngine();

const STORAGE_KEY = 'BE_A_ROCKET_ENGINEER_SAVE_V1';

// 本地存檔讀取
function loadSavedGameState() {
  const defaultState = {
    hasStarted: false,
    playerName: '阿剛',
    playerRole: 'SE',
    playerTitle: '系統整合 Lead',
    budget: 1450,
    morale: 96,
    readiness: 20,
    countdownSeconds: 18 * 3600 - 20,
    solvedEventsList: []
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed };
    }
  } catch (err) {
    console.warn('[Storage] 讀取存檔失敗', err);
  }
  return defaultState;
}

const savedData = loadSavedGameState();

// 若尚未登入，導向 login.html
if (!savedData.hasStarted) {
  window.location.replace('login.html');
}

const gameState = {
  hasStarted: savedData.hasStarted,
  playerName: savedData.playerName,
  playerRole: savedData.playerRole,
  playerTitle: savedData.playerTitle,
  budget: savedData.budget,
  morale: savedData.morale,
  readiness: savedData.readiness,
  countdownSeconds: savedData.countdownSeconds,
  solvedEvents: new Set(savedData.solvedEventsList || []),
  keys: { w: false, a: false, s: false, d: false },
  joystickVector: { x: 0, y: 0 },
  nearbyNPC: null,
  activeDialogue: null
};

function saveGameState() {
  const dataToSave = {
    hasStarted: gameState.hasStarted,
    playerName: gameState.playerName,
    playerRole: gameState.playerRole,
    playerTitle: gameState.playerTitle,
    budget: gameState.budget,
    morale: gameState.morale,
    readiness: gameState.readiness,
    countdownSeconds: gameState.countdownSeconds,
    solvedEventsList: Array.from(gameState.solvedEvents)
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (err) {
    console.warn('[Storage] 存檔失敗', err);
  }
}

// 1. 初始化 3D 畫布與辦公室場景
const canvas = document.getElementById('webgl-canvas');
const badgeContainer = document.getElementById('badge-container');
const { scene, camera, renderer, baseD, wallColliders, roomZones, lockedDoors } = initWorkshopScene(canvas);

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

// 建立兩側大門的「Coming Soon」懸浮標籤
if (lockedDoors) {
  lockedDoors.forEach(door => {
    const pill = document.createElement('div');
    pill.className = 'hud-badge bg-slate-900/90 text-amber-400 border border-amber-500/60 font-black text-[11px] shadow-xl hidden px-3 py-1 flex items-center gap-1.5 backdrop-blur-md transition-all duration-200';
    pill.innerHTML = `<span>🚧</span><span>${door.name} Coming Soon</span>`;
    badgeContainer.appendChild(pill);
    door.badgeEl = pill;
  });
}

// 2. NPC 配置
const NPC_CONFIGS = [
  { roomId: 'avionics_room', shirtColor: 0x2563eb, pos: [-14.2, 0, -9.5], rot: Math.PI / 2 },
  { roomId: 'propulsion_room', shirtColor: 0xdc2626, pos: [0, 0, -12.2], rot: 0 },
  { roomId: 'structures_room', shirtColor: 0x059669, pos: [12.5, 0, -12.2], rot: 0 },
  { roomId: 'central_courtyard', shirtColor: 0x9333ea, pos: [0, 0, 4.2], rot: Math.PI }
];

let activeNPCs = [];

function setupNPCs() {
  activeNPCs = [];
  NPC_CONFIGS.forEach(cfg => {
    const room = engine.getRoomConfig(cfg.roomId) || {
      npcName: '組員',
      roleTitle: '研發組員',
      badgeColor: 'bg-slate-700 text-white'
    };

    const mesh = createVoxelCharacter(cfg.shirtColor);
    mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    mesh.rotation.y = cfg.rot;
    scene.add(mesh);

    const tag = document.createElement('div');
    tag.className = `hud-badge ${room.badgeColor}`;
    tag.innerText = `${room.npcName} | ${room.roleTitle}`;
    badgeContainer.appendChild(tag);

    const hint = document.createElement('div');
    hint.className = 'interact-pill px-2 py-0.5 rounded-full bg-slate-900 text-white font-bold text-[10px] hidden shadow-md';
    hint.innerText = '[互動]';
    badgeContainer.appendChild(hint);

    activeNPCs.push({ roomId: cfg.roomId, mesh, tagEl: tag, hintEl: hint });
  });
}

function updateMetricsUI() {
  const b = document.getElementById('stat-budget');
  const m = document.getElementById('stat-morale');
  const r = document.getElementById('stat-readiness');
  if (b) b.innerText = `$${gameState.budget.toLocaleString()}`;
  if (m) m.innerText = `${Math.max(0, gameState.morale)}%`;
  if (r) r.innerText = `${Math.min(100, gameState.readiness)}%`;
}
updateMetricsUI();

// 3. 對話系統邏輯
const diagBox = document.getElementById('dialogue-box');
const diagBadge = document.getElementById('diag-badge');
const diagSpeaker = document.getElementById('diag-speaker');
const diagText = document.getElementById('diag-text');
const diagOptions = document.getElementById('diag-options');
const btnMobileInteract = document.getElementById('btn-mobile-interact');

function openRoomDialogue(npc) {
  const ev = engine.getEligibleEvent(npc.roomId, gameState);
  if (!ev) return;

  gameState.activeDialogue = { npc, event: ev };
  sfx.playSelect();

  const rData = engine.getRoomConfig(npc.roomId) || { roleTitle: '工程人員', badgeColor: 'bg-slate-700 text-white' };
  diagBadge.className = `px-2 py-0.5 rounded-full text-[11px] md:text-xs font-black ${rData.badgeColor}`;
  diagBadge.innerText = rData.roleTitle;
  diagSpeaker.innerText = ev.speaker;
  diagText.innerText = ev.text;
  diagOptions.innerHTML = '';

  ev.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'p-3 rounded-2xl border text-xs font-bold text-left transition flex flex-col justify-center bg-slate-50 hover:bg-blue-50 border-slate-200 hover:border-blue-400 text-slate-800 shadow-sm active:scale-95';
    btn.innerText = opt.label;
    btn.onclick = () => {
      sfx.playTone(740, 'sine', 0.1);
      if (opt.effects) {
        if (opt.effects.budget) gameState.budget += opt.effects.budget;
        if (opt.effects.morale) gameState.morale += opt.effects.morale;
        if (opt.effects.readiness) gameState.readiness += opt.effects.readiness;
      }
      gameState.solvedEvents.add(ev.id);
      if (opt.unlockEvents) {
        opt.unlockEvents.forEach(uId => gameState.solvedEvents.delete(uId));
      }

      saveGameState();
      updateMetricsUI();

      diagText.innerText = opt.reply;
      diagOptions.innerHTML = `
        <button id="btn-close-step" class="col-span-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition">
          清楚了，前往下個隔間 (關閉)
        </button>
      `;
      document.getElementById('btn-close-step').onclick = closeDialogue;
    };
    diagOptions.appendChild(btn);
  });

  diagBox.classList.remove('hidden');
}

function closeDialogue() {
  if (diagBox) diagBox.classList.add('hidden');
  gameState.activeDialogue = null;
  window.focus();
}
const btnClose = document.getElementById('diag-btn-close');
if (btnClose) btnClose.onclick = closeDialogue;

if (btnMobileInteract) {
  btnMobileInteract.addEventListener('click', (e) => {
    e.preventDefault();
    if (gameState.activeDialogue) {
      closeDialogue();
    } else if (gameState.nearbyNPC) {
      openRoomDialogue(gameState.nearbyNPC);
    }
  });
}

// 音效控制
const btnSound = document.getElementById('btn-sound-toggle');
if (btnSound) {
  btnSound.onclick = () => {
    const on = sfx.toggle();
    document.getElementById('sound-icon').innerText = on ? '🔊' : '🔇';
  };
}

// 發射結算
const btnLaunch = document.getElementById('btn-final-launch');
if (btnLaunch) {
  btnLaunch.onclick = () => {
    const modal = document.getElementById('result-modal');
    const rIcon = document.getElementById('res-icon');
    const rTitle = document.getElementById('res-title');
    const rBadge = document.getElementById('res-badge');
    const rDesc = document.getElementById('res-desc');
    modal.classList.remove('hidden');

    if (gameState.readiness >= 75) {
      sfx.playSuccess();
      rIcon.innerText = '🚀';
      rTitle.innerText = '試車發射大成功！探空二號順利入軌！';
      rBadge.className = 'inline-block px-3 py-0.5 rounded-full text-[11px] font-mono-num font-bold mt-1 mb-2.5 bg-emerald-100 text-emerald-800 border border-emerald-300';
      rBadge.innerText = 'MISSION APOGEE: 1,650 METERS';
      rDesc.innerText = `整備度達到 ${gameState.readiness}%！各小間通力排除隱患，主傘於頂空精準彈出，全體隊員在沙灘順利尋回整箭！`;
    } else {
      sfx.playAlarm();
      rIcon.innerText = '💥';
      rTitle.innerText = '半空中斷！發射中止與殘骸尋回';
      rBadge.className = 'inline-block px-3 py-0.5 rounded-full text-[11px] font-mono-num font-bold mt-1 mb-2.5 bg-red-100 text-red-800 border border-red-300';
      rBadge.innerText = 'MISSION ABORTED';
      rDesc.innerText = `當前整備度僅 ${gameState.readiness}%。由於有獨立小間未完成巡檢排除隱患，火箭升空後姿態解體。收拾殘骸回辦公室準備檢討報告！`;
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

  activeNPCs.forEach(npc => {
    npc.mesh.getWorldPosition(vProj);
    vProj.y += 2.2;
    vProj.project(camera);
    const x = (vProj.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vProj.y * 0.5 + 0.5) * window.innerHeight;
    npc.tagEl.style.left = `${x}px`;
    npc.tagEl.style.top = `${y}px`;
    npc.hintEl.style.left = `${x}px`;
    npc.hintEl.style.top = `${y - 12}px`;
  });

  // 更新封鎖門口的 Coming Soon 膠囊投影位置
  if (lockedDoors) {
    lockedDoors.forEach(door => {
      if (door.badgeEl && !door.badgeEl.classList.contains('hidden')) {
        vProj.copy(door.pos);
        vProj.project(camera);
        door.badgeEl.style.left = `${(vProj.x * 0.5 + 0.5) * window.innerWidth}px`;
        door.badgeEl.style.top = `${(-vProj.y * 0.5 + 0.5) * window.innerHeight}px`;
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
    if (gameState.activeDialogue) closeDialogue();
    else if (gameState.nearbyNPC) openRoomDialogue(gameState.nearbyNPC);
  }
  if (code === 'Escape') closeDialogue();
});

window.addEventListener('keyup', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const code = e.code;
  if (code === 'KeyW' || code === 'ArrowUp') gameState.keys.w = false;
  if (code === 'KeyS' || code === 'ArrowDown') gameState.keys.s = false;
  if (code === 'KeyA' || code === 'ArrowLeft') gameState.keys.a = false;
  if (code === 'KeyD' || code === 'ArrowRight') gameState.keys.d = false;
});

// 手機虛擬搖桿
function setupMobileJoystick() {
  const zone = document.getElementById('joystick-zone');
  const knob = document.getElementById('joystick-knob');
  if (!zone || !knob) return;

  let activeTouchId = null, originX = 0, originY = 0;
  const maxRadius = 45;

  zone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (activeTouchId !== null) return;
    const touch = e.changedTouches[0];
    activeTouchId = touch.identifier;
    const rect = zone.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;
    updateKnob(touch.clientX, touch.clientY);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (activeTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId) {
        updateKnob(touch.clientX, touch.clientY);
        break;
      }
    }
  }, { passive: false });

  const endTouch = (e) => {
    if (activeTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        activeTouchId = null;
        gameState.joystickVector.x = 0;
        gameState.joystickVector.y = 0;
        knob.style.transform = `translate(0px, 0px)`;
        break;
      }
    }
  };

  window.addEventListener('touchend', endTouch);
  window.addEventListener('touchcancel', endTouch);

  function updateKnob(clientX, clientY) {
    const dx = clientX - originX;
    const dy = clientY - originY;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;
    knob.style.transform = `translate(${knobX}px, ${knobY}px)`;

    gameState.joystickVector.x = knobX / maxRadius;
    gameState.joystickVector.y = knobY / maxRadius;
  }
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

setInterval(() => {
  if (gameState.countdownSeconds > 0) {
    gameState.countdownSeconds--;
    const h = String(Math.floor(gameState.countdownSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((gameState.countdownSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(gameState.countdownSeconds % 60).padStart(2, '0');
    const tEl = document.getElementById('timer-display');
    if (tEl) tEl.innerText = `${h}:${m}:${s}`;
  }
}, 1000);

// 4. 動畫主循環
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

  // 鍵盤移動向量（核心公式：Camera at +X, +Y, +Z）
  if (gameState.keys.w) { mx -= speed * 0.7071; mz -= speed * 0.7071; }
  if (gameState.keys.s) { mx += speed * 0.7071; mz += speed * 0.7071; }
  if (gameState.keys.a) { mx -= speed * 0.7071; mz += speed * 0.7071; }
  if (gameState.keys.d) { mx += speed * 0.7071; mz -= speed * 0.7071; }

  // 手機虛擬搖桿
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

  // 人物雙腿擺動動畫
  updateCharacterWalk(player, isMoving, delta);

  // NPC 接近判定
  let closeOne = null;
  activeNPCs.forEach(npc => {
    const dist = player.position.distanceTo(npc.mesh.position);
    if (dist < 3.2) {
      closeOne = npc;
      npc.hintEl.classList.remove('hidden');
    } else {
      npc.hintEl.classList.add('hidden');
    }
  });
  gameState.nearbyNPC = closeOne;

  if (btnMobileInteract) {
    if (closeOne) {
      btnMobileInteract.classList.remove('opacity-40');
      btnMobileInteract.classList.add('opacity-100', 'ring-4', 'ring-blue-300', 'animate-pulse');
    } else {
      btnMobileInteract.classList.remove('opacity-100', 'ring-4', 'ring-blue-300', 'animate-pulse');
      btnMobileInteract.classList.add('opacity-40');
    }
  }

  // ----------------------------------------------------
  // 接近封鎖大門時浮現 Coming Soon 標籤
  // ----------------------------------------------------
  if (lockedDoors) {
    lockedDoors.forEach(door => {
      const dist = player.position.distanceTo(door.pos);
      if (dist < 4.2) {
        door.badgeEl.classList.remove('hidden');
      } else {
        door.badgeEl.classList.add('hidden');
      }
    });
  }

  // 動態 Zoom-In / Out
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

// 5. 載入資料庫並開局
async function loadEventsData() {
  try {
    await engine.load('./data/events.json');
    console.log('[BeARocketEngineer] 事件資料庫載入成功');
  } catch (err) {
    console.warn('[BeARocketEngineer] 網路讀取 events.json 失敗，啟動備用資料庫：', err);
    engine.database = {
      avionics_room: {
        npcName: '小陳', roleTitle: '航電組長', badgeColor: 'bg-blue-600 text-white',
        events: [{
          id: 'av_fallback', priority: 1, speaker: '小陳',
          text: '「報告隊長！航電板燒錄完成，電壓穩定 3.3V！」',
          options: [{ label: '確認供電正常 (+10% 整備度)', effects: { readiness: 10 }, reply: '「收到！」' }]
        }]
      },
      propulsion_room: {
        npcName: '阿豪', roleTitle: '推進工程師', badgeColor: 'bg-red-600 text-white',
        events: [{
          id: 'prop_fallback', priority: 1, speaker: '阿豪',
          text: '「推進藥柱氣密檢測完畢，O-Ring 已固定！」',
          options: [{ label: '推進組完成確認 (+10% 整備度)', effects: { readiness: 10 }, reply: '「妥當！」' }]
        }]
      },
      structures_room: {
        npcName: '林學姐', roleTitle: '結構碳纖組', badgeColor: 'bg-emerald-600 text-white',
        events: [{
          id: 'struct_fallback', priority: 1, speaker: '林學姐',
          text: '「碳纖筒身外層環氧樹脂固化完畢，準備總裝！」',
          options: [{ label: '合體組裝 (+10% 整備度)', effects: { readiness: 10 }, reply: '「沒問題！」' }]
        }]
      },
      central_courtyard: {
        npcName: '老張', roleTitle: '總隊長', badgeColor: 'bg-purple-600 text-white',
        events: [{
          id: 'lead_fallback', priority: 1, speaker: '老張',
          text: '「發財車司機快到了，準備做發射前最後清點！」',
          options: [{ label: '全員動員清點 (+10% 整備度)', effects: { readiness: 10 }, reply: '「收到！」' }]
        }]
      }
    };
  }

  setupNPCs();
  animate();
}

window.addEventListener('resize', () => {
  const asp = window.innerWidth / window.innerHeight;
  camera.left = -currentD * asp;
  camera.right = currentD * asp;
  camera.top = currentD;
  camera.bottom = -currentD;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

loadEventsData();