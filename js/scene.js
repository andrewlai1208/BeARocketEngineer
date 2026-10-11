// js/scene.js

// 門牌文字貼圖生成器（3D 門楣招牌）
function createSignTexture(text, bgColor = '#2563eb') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Noto Sans TC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  return new THREE.CanvasTexture(canvas);
}

// 建立可操作的 3D 筆記型電腦模型
function createLaptopModel(screenColorHex = 0x38bdf8) {
  const laptop = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
  const matScreen = new THREE.MeshBasicMaterial({ color: screenColorHex });

  // 底座與鍵盤
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.4), matBody);
  base.position.y = 0.015;
  base.castShadow = true;
  laptop.add(base);

  // 翻開的螢幕
  const lid = new THREE.Group();
  lid.position.set(0, 0.03, -0.2);
  const lidBack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.03), matBody);
  lidBack.position.set(0, 0.19, 0);
  lid.add(lidBack);

  // 發光螢幕面板
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), matScreen);
  screen.position.set(0, 0.19, 0.016);
  lid.add(screen);

  lid.rotation.x = -0.3; // 向後仰約 17 度
  laptop.add(lid);

  return laptop;
}

// 角色生成（包含腿部骨架）
export function createVoxelCharacter(shirtColorHex) {
  const char = new THREE.Group();
  const matSkin = new THREE.MeshLambertMaterial({ color: 0xfcd34d });
  const matShirt = new THREE.MeshLambertMaterial({ color: shirtColorHex });
  const matPants = new THREE.MeshLambertMaterial({ color: 0x334155 });
  const matHair = new THREE.MeshLambertMaterial({ color: 0x1e293b });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.4), matShirt);
  torso.position.y = 1.0;
  torso.castShadow = true;
  char.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.45), matSkin);
  head.position.y = 1.62;
  head.castShadow = true;
  char.add(head);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.2, 0.48), matHair);
  hair.position.y = 1.82;
  char.add(hair);

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.65, 0.24), matPants);
  leftLeg.position.set(-0.16, 0.35, 0);
  leftLeg.castShadow = true;
  char.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.65, 0.24), matPants);
  rightLeg.position.set(0.16, 0.35, 0);
  rightLeg.castShadow = true;
  char.add(rightLeg);

  char.userData = { leftLeg, rightLeg, walkCycle: 0 };
  return char;
}

// 雙腿擺動行走動畫運算
export function updateCharacterWalk(char, isMoving, delta) {
  if (!char || !char.userData || !char.userData.leftLeg) return;
  if (isMoving) {
    char.userData.walkCycle += delta * 15;
    const legAngle = Math.sin(char.userData.walkCycle) * 0.5;
    char.userData.leftLeg.rotation.x = legAngle;
    char.userData.rightLeg.rotation.x = -legAngle;
  } else {
    char.userData.leftLeg.rotation.x = 0;
    char.userData.rightLeg.rotation.x = 0;
  }
}

// 1. 辦公室主場景 (Office - 暢通解封版 + 工作桌配置筆電)
export function initWorkshopScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfafafa);

  const aspect = window.innerWidth / window.innerHeight;
  const baseD = 9.5;
  const camera = new THREE.OrthographicCamera(-baseD * aspect, baseD * aspect, baseD, -baseD, 0.1, 1000);
  camera.position.set(18, 22, 18);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // 採光系統
  const hemiLight = new THREE.HemisphereLight(0xffffcc, 0xFFF3BF, 0.8);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xBDBDBD, 0.85);
  sunLight.position.set(22, 35, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  const sD = 28;
  sunLight.shadow.camera.left = -sD;
  sunLight.shadow.camera.right = sD;
  sunLight.shadow.camera.top = sD;
  sunLight.shadow.camera.bottom = -sD;
  scene.add(sunLight);

  const labGroup = new THREE.Group();

  // 地面 (水泥灰，無格線)
  const floorGeo = new THREE.BoxGeometry(38, 0.4, 32);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xB0ACAB, roughness: 0.5, metalness: 0.05 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, -0.2, -1.0);
  floor.receiveShadow = true;
  labGroup.add(floor);

  // 材質
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });
  const matWood = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.35, metalness: 0.05 });
  const matSteel = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });

  const wallColliders = [];
  function addSolidWall(w, h, depth, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), wallMat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = true;
    labGroup.add(m);

    wallColliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
    return m;
  }

  function addDoorLintel(x, z, rotY = 0, doorWidth = 3.2, labelText = '', labelBg = '#2563eb') {
    const f = new THREE.Group();
    const half = doorWidth / 2;
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.0, 0.25), frameMat);
    p1.position.set(-half, 2.0, 0);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.0, 0.25), frameMat);
    p2.position.set(half, 2.0, 0);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.4, 0.25, 0.25), frameMat);
    lintel.position.set(0, 3.9, 0);
    f.add(p1, p2, lintel);

    if (labelText) {
      const signMat = new THREE.MeshBasicMaterial({ map: createSignTexture(labelText, labelBg) });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(doorWidth * 0.75, 0.45), signMat);
      sign.position.set(0, 3.45, 0.15);
      f.add(sign);
    }

    f.rotation.y = rotY;
    f.position.set(x, 0, z);
    labGroup.add(f);
  }

  // --- 四周外牆（密合無縫）---
  addSolidWall(37.5, 4.2, 0.4, 0, 2.1, -16.5);   // 後總外牆
  addSolidWall(37.5, 1.2, 0.4, 0, 0.6, 14.5);    // 前護欄

  // 左外牆：測試廠房
  addSolidWall(0.4, 4.2, 16.9, -18.5, 2.1, -8.05);
  addSolidWall(0.4, 4.2, 10.9, -18.5, 2.1, 9.05);
  addDoorLintel(-18.5, 2.0, Math.PI / 2, 3.2, '測試廠房', '#0284c7');
  addSolidWall(0.4, 0.2, 3.2, -18.5, 4.1, 2.0);

  // 右外牆：加工車間
  addSolidWall(0.4, 4.2, 16.9, 18.5, 2.1, -8.05);
  addSolidWall(0.4, 4.2, 10.9, 18.5, 2.1, 9.05);
  addDoorLintel(18.5, 2.0, -Math.PI / 2, 3.2, '加工車間', '#d97706');
  addSolidWall(0.4, 0.2, 3.2, 18.5, 4.1, 2.0);

  // --- 內部小組隔牆 ---
  // 1. 推進室隔牆
  addSolidWall(0.3, 4.2, 11.0, -6.5, 2.1, -11.0);
  addSolidWall(0.3, 4.2, 11.0, 6.5, 2.1, -11.0);
  addSolidWall(4.8, 4.2, 0.3, -4.1, 2.1, -5.5);
  addSolidWall(4.8, 4.2, 0.3, 4.1, 2.1, -5.5);
  addDoorLintel(0, -5.5, 0, 3.2);

  // 2. 航電室隔牆
  addSolidWall(0.3, 4.2, 13.5, -6.8, 2.1, -9.75);
  addSolidWall(8.8, 4.2, 0.3, -14.1, 2.1, -3.0);
  addDoorLintel(-8.2, -3.0, 0, 2.8);

  // 3. 結構室隔牆
  addSolidWall(0.3, 4.2, 13.5, 6.8, 2.1, -9.75);
  addSolidWall(8.8, 4.2, 0.3, 14.1, 2.1, -3.0);
  addDoorLintel(8.2, -3.0, 0, 2.8);

  // 工作桌
  function workbench(x, z, rotY, w = 4.2, depth = 2.0) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, depth), matWood);
    top.position.y = 1.15;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);

    const legGeo = new THREE.BoxGeometry(0.18, 1.15, 0.18);
    [[-w/2 + 0.2, -depth/2 + 0.2], [w/2 - 0.2, -depth/2 + 0.2], [-w/2 + 0.2, depth/2 - 0.2], [w/2 - 0.2, depth/2 - 0.2]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, matSteel);
      leg.position.set(lx, 0.575, lz);
      leg.castShadow = true;
      g.add(leg);
    });

    g.rotation.y = rotY;
    g.position.set(x, 0, z);
    labGroup.add(g);

    const halfW = (rotY !== 0 ? depth : w) / 2;
    const halfD = (rotY !== 0 ? w : depth) / 2;
    wallColliders.push({ minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD });
  }

  workbench(-16.8, -9.5, Math.PI / 2, 5.0, 2.0); // 航電組主桌
  workbench(0, -14.8, 0, 5.5, 2.2);              // 推進組試驗桌
  workbench(12.5, -14.8, 0, 5.0, 2.0);            // 結構組長桌
  workbench(0, 6.0, 0, 4.0, 2.0);                // 隊長指揮桌
  workbench(-9.0, 5.0, 0, 3.8, 2.0);             // 降落傘桌

  // ----------------------------------------------------
  // 配置 4 組次系統研發筆電（放置在工作桌面上）
  // ----------------------------------------------------
  const laptops = [
    {
      id: 'propulsion',
      name: '推進次系統筆電',
      pos: new THREE.Vector3(0, 1.28, -14.2),
      rotY: 0,
      screenColor: 0xef4444
    },
    {
      id: 'avionics',
      name: '航電次系統筆電',
      pos: new THREE.Vector3(-16.2, 1.28, -9.5),
      rotY: Math.PI / 2,
      screenColor: 0x3b82f6
    },
    {
      id: 'structures',
      name: '結構次系統筆電',
      pos: new THREE.Vector3(12.5, 1.28, -14.2),
      rotY: 0,
      screenColor: 0x10b981
    },
    {
      id: 'integration',
      name: '系統整合總控筆電',
      pos: new THREE.Vector3(0, 1.28, 5.5),
      rotY: Math.PI,
      screenColor: 0xa855f7
    }
  ];

  laptops.forEach(item => {
    const model = createLaptopModel(item.screenColor);
    model.position.copy(item.pos);
    model.rotation.y = item.rotY;
    labGroup.add(model);
    item.mesh = model;
  });

  scene.add(labGroup);

  const roomZones = [
    { id: 'propulsion_room', minX: -6.0, maxX: 6.0, minZ: -16.0, maxZ: -5.6, focusOffset: [0, 0, -11.0] },
    { id: 'avionics_room',   minX: -18.0, maxX: -7.0, minZ: -16.0, maxZ: -3.2, focusOffset: [-12.5, 0, -9.5] },
    { id: 'structures_room', minX: 7.0, maxX: 18.0, minZ: -16.0, maxZ: -3.2, focusOffset: [12.5, 0, -9.5] }
  ];

  const portalZones = [
    { id: 'test_bay', name: '測試廠房', url: 'test_bay.html', minX: -19.5, maxX: -17.5, minZ: 0.5, maxZ: 3.5 },
    { id: 'machine_shop', name: '加工車間', url: 'machine_shop.html', minX: 17.5, maxX: 19.5, minZ: 0.5, maxZ: 3.5 }
  ];

  return { scene, camera, renderer, baseD, wallColliders, roomZones, portalZones, laptops };
}

// 2. 測試廠房場景 (Test Bay)
export function initTestBayScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);

  const aspect = window.innerWidth / window.innerHeight;
  const d = 9.0;
  const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 1000);
  camera.position.set(16, 20, 16);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  scene.add(new THREE.HemisphereLight(0xffffcc, 0xFFF3BF, 0.8));
  const sun = new THREE.DirectionalLight(0xBDBDBD, 0.9);
  sun.position.set(15, 25, 12);
  sun.castShadow = true;
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.4, 22), new THREE.MeshStandardMaterial({ color: 0xB0ACAB, roughness: 0.4 }));
  floor.position.set(0, -0.2, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.0, 3.2), new THREE.MeshStandardMaterial({ color: 0x38bdf8 }));
  doorFrame.position.set(12.8, 2.0, 0);
  scene.add(doorFrame);

  return { scene, camera, renderer, d };
}

// 3. 加工車間場景 (Machine Shop)
export function initMachineShopScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfef3c7);

  const aspect = window.innerWidth / window.innerHeight;
  const d = 9.0;
  const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 1000);
  camera.position.set(16, 20, 16);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  scene.add(new THREE.HemisphereLight(0xffffcc, 0xFFF3BF, 0.8));
  const sun = new THREE.DirectionalLight(0xfffbeb, 0.9);
  sun.position.set(18, 30, 15);
  sun.castShadow = true;
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.4, 22), new THREE.MeshStandardMaterial({ color: 0x858585, roughness: 0.35 }));
  floor.position.set(0, -0.2, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.0, 3.2), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
  doorFrame.position.set(-12.8, 2.0, 0);
  scene.add(doorFrame);

  return { scene, camera, renderer, d };
}