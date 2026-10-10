// js/app.js
import { LabAudio } from './audio.js';
import { EventsEngine } from './eventsEngine.js';
import { initWorkshopScene, createVoxelCharacter } from './scene.js';

console.log('[Rocket24hr] 遊戲引擎啟動...');

const sfx = new LabAudio();
const engine = new EventsEngine();

const gameState = {
  budget: 1450,
  morale: 96,
  readiness: 20,
  countdownSeconds: 18 * 3600 - 20,
  playerRole: 'SE',
  playerTitle: '系統整合 Lead',
  solvedEvents: new Set(),
  keys: { w: false, a: false, s: false, d: false },
  nearbyNPC: null,
  activeDialogue: null
};

// 1. 初始化 3D 畫布與場景
const canvas = document.getElementById('webgl-canvas');
const badgeContainer = document.getElementById('badge-container');
const { scene, camera, renderer, baseD, wallColliders, roomZones } = initWorkshopScene(canvas);

// 生成主角
const player = createVoxelCharacter(0xf59e0b);
player.position.set(0, 0, 0);
scene.add(player);

const playerTag = document.createElement('div');
playerTag.id = 'player-tag';
playerTag.className = 'hud-badge bg-amber-500 text-white';
playerTag.innerText = `你 | ${gameState.playerTitle}`;
badgeContainer.appendChild(playerTag);
player.userData.tagEl = playerTag;

// 2. 封面事件綁定
function bindCoverEvents() {
  const btnStart = document.getElementById('btn-start-game');
  const cover = document.getElementById('cover-screen');
  const roleButtons = document.querySelectorAll('.role-btn');

  roleButtons.forEach(btn => {
    btn.onclick = () => {
      sfx.playClick();
      roleButtons.forEach(b => {
        b.className = 'role-btn py-2.5 px-3 rounded-xl border text-xs font-bold text-center transition flex flex-col items-center gap-1 bg-white border-slate-200 text-slate-600 hover:border-slate-300';
      });
      btn.className = 'role-btn active py-2.5 px-3 rounded-xl border text-xs font-bold text-center transition flex flex-col items-center gap-1 bg-blue-50 border-blue-500 text-blue-900';
      gameState.playerRole = btn.dataset.role || 'SE';
      gameState.playerTitle = btn.dataset.title || '系統整合 Lead';
    };
  });

  if (btnStart) {
    btnStart.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const inputName = document.getElementById('input-player-name');
      const name = (inputName && inputName.value.trim()) ? inputName.value.trim() : '阿剛';
      if (inputName) inputName.blur();

      const tag = document.getElementById('player-tag');
      if (tag) tag.innerText = `${name} | ${gameState.playerTitle}`;

      sfx.playSelect();

      if (cover) {
        cover.style.transition = 'opacity 0.35s ease';
        cover.style.opacity = '0';
        cover.style.pointerEvents = 'none';
        setTimeout(() => {
          cover.classList.add('hidden');
          cover.style.display = 'none';
          window.focus();
        }, 350);
      }
    });
  }
}
bindCoverEvents();

// 3. 各小間 NPC 站位
const NPC_CONFIGS = [
  { roomId: 'avionics_room', shirtColor: 0x2563eb, pos: [-14.2, 0, -9.5], rot: Math.PI / 2 },
  { roomId: 'propulsion_room', shirtColor: 0xdc2626, pos: [0, 0, -12.2], rot: 0 },
  { roomId: 'structures_room', shirtColor: 0x059669, pos: [14.2, 0, -9.5], rot: -Math.PI / 2 },
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
    hint.innerText = '[E 互動]';
    badgeContainer.appendChild(hint);

    activeNPCs.push({ roomId: cfg.roomId, mesh, tagEl: tag, hintEl: hint });
  });
}

function updateMetricsUI() {
  const b = document.getElementById('stat-budget');
  const m = document.getElementById('stat-morale');
  const r = document.getElementById('stat-readiness');
  if (b) b.innerText = `$${gameState.budget.toLocaleString()} NTD`;
  if (m) m.innerText = `${Math.max(0, gameState.morale)}%`;
  if (r) r.innerText = `${Math.min(100, gameState.readiness)}%`;
}

// 4. 對話面板
const diagBox = document.getElementById('dialogue-box');
const diagBadge = document.getElementById('diag-badge');
const diagSpeaker = document.getElementById('diag-speaker');
const diagText = document.getElementById('diag-text');
const diagOptions = document.getElementById('diag-options');

function openRoomDialogue(npc) {
  const ev = engine.getEligibleEvent(npc.roomId, gameState);
  if (!ev) return;

  gameState.activeDialogue = { npc, event: ev };
  sfx.playSelect();

  const rData = engine.getRoomConfig(npc.roomId) || { roleTitle: '工程人員', badgeColor: 'bg-slate-700 text-white' };
  diagBadge.className = `px-2.5 py-0.5 rounded-full text-xs font-black ${rData.badgeColor}`;
  diagBadge.innerText = rData.roleTitle;
  diagSpeaker.innerText = ev.speaker;
  diagText.innerText = ev.text;
  diagOptions.innerHTML = '';

  ev.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'p-3 rounded-2xl border text-xs font-bold text-left transition flex flex-col justify-center bg-slate-50 hover:bg-blue-50 border-slate-200 hover:border-blue-400 text-slate-800 shadow-sm';
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

// 音效與發射結算
const btnSound = document.getElementById('btn-sound-toggle');
if (btnSound) {
  btnSound.onclick = () => {
    const on = sfx.toggle();
    document.getElementById('sound-icon').innerText = on ? '🔊' : '🔇';
    document.getElementById('sound-text').innerText = on ? '音效' : '靜音';
  };
}

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
      rBadge.className = 'inline-block px-3 py-0.5 rounded-full text-[11px] font-mono-num font-bold mt-1 mb-3 bg-emerald-100 text-emerald-800 border border-emerald-300';
      rBadge.innerText = 'MISSION APOGEE: 1,650 METERS';
      rDesc.innerText = `整備度達到 ${gameState.readiness}%！各小間排查順利，主傘頂空精準彈出，全體隊員在沙灘順利尋回整箭！`;
    } else {
      sfx.playAlarm();
      rIcon.innerText = '💥';
      rTitle.innerText = '半空中斷！發射中止與殘骸尋回';
      rBadge.className = 'inline-block px-3 py-0.5 rounded-full text-[11px] font-mono-num font-bold mt-1 mb-3 bg-red-100 text-red-800 border border-red-300';
      rBadge.innerText = 'MISSION ABORTED';
      rDesc.innerText = `當前整備度僅 ${gameState.readiness}%。由於有獨立小間未完成巡檢排除隱患，火箭升空後姿態解體。收拾殘骸回工坊準備檢討報告！`;
    }
  };
}
const btnRestart = document.getElementById('btn-restart');
if (btnRestart) btnRestart.onclick = () => window.location.reload();

// 5. 投影標籤更新
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
}

// 6. 鍵盤事件監聽
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

// 7. 動畫主循環（強化防護與相機數值安全檢查）
let currentD = baseD || 9.5;
const targetLookAt = new THREE.Vector3(0, 0, 0);
const currentLookAt = new THREE.Vector3(0, 0, 0);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  
  // 防護：限制 delta 最大值，避免分頁切換時產生過大的插值突波
  const rawDelta = clock.getDelta();
  const delta = Math.min(rawDelta, 0.05);

  let mx = 0;
  let mz = 0;
  const speed = 7.5 * delta;

  // 正交相機等角走位向量
// ----------------------------------------------------
  // 正交相機等角視角（Iso view）方向向量校正：
  // ----------------------------------------------------
  if (gameState.keys.w) {
    // 螢幕往上（朝工坊後方前進）
    mx -= speed * 0.7071;
    mz -= speed * 0.7071;
  }
  if (gameState.keys.s) {
    // 螢幕往下（朝工坊前方前進）
    mx += speed * 0.7071;
    mz += speed * 0.7071;
  }
  if (gameState.keys.a) {
    // 螢幕往左（朝航電組走）
    mx -= speed * 0.7071;
    mz += speed * 0.7071;
  }
  if (gameState.keys.d) {
    // 螢幕往右（朝結構組走）
    mx += speed * 0.7071;
    mz -= speed * 0.7071;
  }

  if (Math.abs(mx) > 0.0001 || Math.abs(mz) > 0.0001) {
    const nextX = Math.max(-18.0, Math.min(18.0, player.position.x + mx));
    const nextZ = Math.max(-16.0, Math.min(13.8, player.position.z + mz));

    if (!checkCollision(nextX, player.position.z)) {
      player.position.x = nextX;
    }
    if (!checkCollision(player.position.x, nextZ)) {
      player.position.z = nextZ;
    }

    player.rotation.y = Math.atan2(mx, mz);
    player.userData.walkCycle += delta * 15;
    const legAngle = Math.sin(player.userData.walkCycle) * 0.5;
    player.userData.leftLeg.rotation.x = legAngle;
    player.userData.rightLeg.rotation.x = -legAngle;
  } else {
    player.userData.leftLeg.rotation.x = 0;
    player.userData.rightLeg.rotation.x = 0;
  }

  // 接近 NPC 判定
  let closeOne = null;
  activeNPCs.forEach(npc => {
    const dist = player.position.distanceTo(npc.mesh.position);
    if (dist < 3.0) {
      closeOne = npc;
      npc.hintEl.classList.remove('hidden');
    } else {
      npc.hintEl.classList.add('hidden');
    }
  });
  gameState.nearbyNPC = closeOne;

  // 鏡頭動態縮放與平滑跟隨
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

  // 插值計算並保證數字有效性
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

// 8. 載入資料庫
async function loadEventsData() {
  try {
    await engine.load('./data/events.json');
    console.log('[Rocket24hr] 事件庫載入成功');
  } catch (err) {
    console.warn('[Rocket24hr] 使用內建備用資料庫：', err);
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