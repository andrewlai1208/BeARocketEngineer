// computer/computerSystem.js

export class ComputerSystem {
  constructor() {
    this.appsDatabase = [];
    this.productsDatabase = { categories: [], items: [] };
    this.currentLaptopId = null;
    this.currentLaptopMeta = null;
    this.activeCategory = 'all';

    // 每台電腦各自獨立的硬碟狀態（各組下載的軟體互不相通）
    this.workstationStates = {
      propulsion: { installedApps: ['appstore', 'market', 'inventory'] },
      avionics: { installedApps: ['appstore', 'market', 'inventory'] },
      structures: { installedApps: ['appstore', 'market', 'inventory'] },
      integration: { installedApps: ['appstore', 'market', 'inventory'] }
    };
  }

  // 初始化並載入外部 JSON 資料庫
  async init() {
    this.setupDOMListeners();

    try {
      const [resApps, resProducts] = await Promise.all([
        fetch('./computer/apps.json'),
        fetch('./computer/products.json')
      ]);

      if (!resApps.ok || !resProducts.ok) {
        throw new Error('伺服器回應狀態碼異常');
      }

      this.appsDatabase = await resApps.json();
      this.productsDatabase = await resProducts.json();
      console.log('[RocketOS] 外部軟體庫 (apps.json) 與材料商城 (products.json) 載入成功');
    } catch (err) {
      console.warn('[RocketOS] 載入 JSON 資料庫失敗，啟用內建備用資料庫：', err);
      this.loadFallbackDatabases();
    }
  }

  // 綁定關閉視窗與關閉電腦的 DOM 按鈕事件
  setupDOMListeners() {
    const btnCloseOs = document.getElementById('btn-close-os');
    const btnCloseApp = document.getElementById('btn-close-app');

    if (btnCloseOs) {
      btnCloseOs.onclick = (e) => {
        e.stopPropagation();
        this.closeLaptop();
      };
    }

    if (btnCloseApp) {
      btnCloseApp.onclick = (e) => {
        e.stopPropagation();
        this.closeAppWindow();
      };
    }
  }

  // 讀取並還原每台電腦的獨立存檔
  loadWorkstationsFromSave(savedWorkstations) {
    if (savedWorkstations && typeof savedWorkstations === 'object') {
      Object.keys(this.workstationStates).forEach(id => {
        if (savedWorkstations[id] && Array.isArray(savedWorkstations[id].installedApps)) {
          this.workstationStates[id] = savedWorkstations[id];
        }
      });
    }
  }

  // 匯出儲存資料
  getWorkstationSaveData() {
    return this.workstationStates;
  }

  // 開啟指定筆記型電腦
  openLaptop(laptop, gameState, sfx, onUpdate) {
    if (!laptop || !laptop.id) return;

    this.currentLaptopId = laptop.id;
    this.currentLaptopMeta = laptop;
    this.gameState = gameState;
    this.sfx = sfx;
    this.onUpdate = onUpdate;

    this.setupDOMListeners();

    // 確保當前筆電擁有獨立的安裝清單
    if (!this.workstationStates[this.currentLaptopId]) {
      this.workstationStates[this.currentLaptopId] = {
        installedApps: ['appstore', 'market', 'inventory']
      };
    }

    const modal = document.getElementById('os-modal') || document.getElementById('laptop-modal');
    if (!modal) {
      console.error('[RocketOS Error] 找不到 id="os-modal" 元素！');
      return;
    }

    const titleEl = document.getElementById('os-laptop-title') || document.getElementById('laptop-title');
    if (titleEl) {
      titleEl.innerText = `RocketOS 2022 - [${laptop.name || '專用工作站'}]`;
    }

    this.closeAppWindow();
    this.renderDesktopIcons();
    this.updateTaskbar();

    modal.classList.remove('hidden');
    if (this.sfx && typeof this.sfx.playSelect === 'function') {
      this.sfx.playSelect();
    }
  }

  // 關閉整台筆電作業系統
  closeLaptop() {
    const modal = document.getElementById('os-modal') || document.getElementById('laptop-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    this.closeAppWindow();
    this.currentLaptopId = null;
    this.currentLaptopMeta = null;
    window.focus();
  }

  // 關閉目前正在跑的單一應用程式視窗
  closeAppWindow() {
    const appWin = document.getElementById('os-app-window');
    const appBody = document.getElementById('app-window-body');
    if (appWin) appWin.classList.add('hidden');
    if (appBody) appBody.innerHTML = '';
  }

  // 更新工作列經費與狀態
  updateTaskbar() {
    const tbBudget = document.getElementById('os-taskbar-budget');
    if (tbBudget && this.gameState) {
      tbBudget.innerText = `$${this.gameState.budget.toLocaleString()}`;
    }
  }

  // ----------------------------------------------------
  // 1. 桌面圖示繪製（僅渲染「本台電腦」安裝之軟體）
  // ----------------------------------------------------
  renderDesktopIcons() {
    const container = document.getElementById('os-desktop-icons');
    if (!container || !this.currentLaptopId) return;
    container.innerHTML = '';

    const currentInstalled = this.workstationStates[this.currentLaptopId].installedApps;

    const systemApps = [
      { id: 'appstore', name: '應用商店', icon: '📦' },
      { id: 'market', name: '原料商城', icon: '🛒' },
      { id: 'inventory', name: '物料倉庫', icon: '🗂️' }
    ];

    const displayApps = [...systemApps];

    this.appsDatabase.forEach(app => {
      if (currentInstalled.includes(app.id)) {
        displayApps.push({
          id: app.id,
          name: app.name.split(' ')[0],
          icon: app.icon
        });
      }
    });

    displayApps.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'os-icon-btn p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition text-white group cursor-pointer focus:outline-none';
      btn.innerHTML = `
        <div class="w-12 h-12 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-2xl shadow-lg group-hover:scale-105 transition">
          ${item.icon}
        </div>
        <span class="text-[11px] font-bold tracking-tight text-center truncate w-full text-slate-200 drop-shadow">${item.name}</span>
      `;
      btn.onclick = () => this.openApp(item.id);
      container.appendChild(btn);
    });
  }

  // 開啟指定應用程式
  openApp(appId) {
    if (this.sfx && typeof this.sfx.playTone === 'function') {
      this.sfx.playTone(700, 'sine', 0.1);
    }

    const appWin = document.getElementById('os-app-window');
    if (!appWin) return;
    appWin.classList.remove('hidden');

    if (appId === 'appstore') {
      this.renderAppStore();
    } else if (appId === 'market') {
      this.renderMarket();
    } else if (appId === 'inventory') {
      this.renderInventory();
    } else if (appId === 'openmotor') {
      this.renderOpenMotorApp();
    } else {
      this.renderGenericApp(appId);
    }
  }

  // ----------------------------------------------------
  // 2. 應用程式商店 (App Store - 付費與免費)
  // ----------------------------------------------------
  renderAppStore() {
    const title = document.getElementById('app-window-title');
    const icon = document.getElementById('app-window-icon');
    const body = document.getElementById('app-window-body');
    if (!title || !icon || !body) return;

    const workstationName = this.currentLaptopMeta ? this.currentLaptopMeta.name : '工作站';
    title.innerText = `Rocket App Store - 研發軟體市集 (${workstationName})`;
    icon.innerText = '📦';

    body.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-4">
        <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h3 class="text-base font-extrabold text-white">官方工程軟體庫</h3>
            <p class="text-xs text-slate-400">注意：軟體僅安裝於本台工作站。商業軟體需扣除研發經費以取得授權。</p>
          </div>
          <div class="text-xs font-mono text-emerald-400 font-bold">
            可用經費：$${this.gameState.budget.toLocaleString()}
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5" id="app-store-list"></div>
      </div>
    `;

    const listEl = document.getElementById('app-store-list');
    const currentInstalled = this.workstationStates[this.currentLaptopId].installedApps;

    this.appsDatabase.forEach(app => {
      const isInstalled = currentInstalled.includes(app.id);
      const isTarget = app.targetWorkstation === this.currentLaptopId || app.targetWorkstation === 'integration';

      const card = document.createElement('div');
      card.className = `p-4 rounded-2xl bg-slate-950/80 border ${isTarget ? 'border-blue-900/60' : 'border-slate-800/80'} flex flex-col justify-between gap-3 shadow-sm`;

      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">${app.icon}</span>
              <div>
                <div class="text-xs font-black text-white">${app.name}</div>
                <div class="text-[10px] text-cyan-400 font-mono">${app.category} • ${app.size}</div>
              </div>
            </div>
            <div>
              ${
                app.isPaid
                  ? `<span class="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px] border border-amber-500/30">授權費 $${app.price.toLocaleString()}</span>`
                  : `<span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px] border border-emerald-500/30">免費開源</span>`
              }
            </div>
          </div>
          <p class="text-[11px] text-slate-400 mt-2 leading-relaxed">${app.desc}</p>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
          <span class="text-[10px] text-slate-500">${isTarget ? '★ 本小組建議軟體' : '通用工具'}</span>
          <div>
            ${
              isInstalled
                ? '<button disabled class="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-500 font-bold text-xs cursor-default">已安裝至本機</button>'
                : `<button data-app="${app.id}" class="btn-install-app px-4 py-1.5 rounded-xl ${app.isPaid ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'} active:scale-95 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1 cursor-pointer">
                    <span>${app.isPaid ? '💳 購買授權並安裝' : '⬇️ 免費下載'}</span>
                  </button>`
            }
          </div>
        </div>
      `;

      const btnInstall = card.querySelector('.btn-install-app');
      if (btnInstall) {
        btnInstall.onclick = () => {
          if (app.isPaid && this.gameState.budget < app.price) {
            if (this.sfx && typeof this.sfx.playAlarm === 'function') this.sfx.playAlarm();
            alert(`經費不足！購買 ${app.name} 授權需要 $${app.price.toLocaleString()}。`);
            return;
          }

          if (app.isPaid) {
            this.gameState.budget -= app.price;
          }

          btnInstall.innerText = '正在部署安裝...';
          btnInstall.disabled = true;
          if (this.sfx && typeof this.sfx.playTone === 'function') {
            this.sfx.playTone(880, 'triangle', 0.15);
          }

          setTimeout(() => {
            this.workstationStates[this.currentLaptopId].installedApps.push(app.id);
            this.updateTaskbar();
            this.renderDesktopIcons();
            this.renderAppStore();
            if (this.onUpdate) this.onUpdate();
          }, 600);
        };
      }

      listEl.appendChild(card);
    });
  }

  // ----------------------------------------------------
  // 3. 原料線上商城 (RocketMarket)
  // ----------------------------------------------------
  renderMarket() {
    const title = document.getElementById('app-window-title');
    const icon = document.getElementById('app-window-icon');
    const body = document.getElementById('app-window-body');
    if (!title || !icon || !body) return;

    title.innerText = 'RocketMarket - 火箭原料線上採購商城';
    icon.innerText = '🛒';

    body.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 class="text-base font-extrabold text-white">材料採購專區</h3>
            <p class="text-xs text-slate-400">採購金屬、複合材料、電子零件與化學品，經費有限請審慎採買。</p>
          </div>
          <div class="text-right">
            <span class="text-[10px] text-slate-400 block">團隊可用經費</span>
            <span class="text-emerald-400 font-mono text-base font-bold">$${this.gameState.budget.toLocaleString()}</span>
          </div>
        </div>

        <div class="flex items-center gap-2 overflow-x-auto pb-1" id="market-category-tabs"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="market-item-list"></div>
      </div>
    `;

    const tabContainer = document.getElementById('market-category-tabs');
    if (this.productsDatabase.categories && tabContainer) {
      this.productsDatabase.categories.forEach(cat => {
        const tabBtn = document.createElement('button');
        const isActive = this.activeCategory === cat.id;
        tabBtn.className = `px-3.5 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap focus:outline-none ${
          isActive
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
        }`;
        tabBtn.innerText = cat.name;
        tabBtn.onclick = () => {
          this.activeCategory = cat.id;
          this.renderMarket();
        };
        tabContainer.appendChild(tabBtn);
      });
    }

    const listEl = document.getElementById('market-item-list');
    if (!listEl) return;

    const filteredItems = this.activeCategory === 'all'
      ? this.productsDatabase.items
      : this.productsDatabase.items.filter(i => i.category === this.activeCategory);

    filteredItems.forEach(item => {
      const currentQty = this.gameState.inventory[item.id] || 0;
      const card = document.createElement('div');
      card.className = 'p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3';
      card.innerHTML = `
        <div class="flex-1">
          <div class="text-xs font-black text-white">${item.name}</div>
          <div class="text-[11px] text-slate-400 mt-1 leading-relaxed">${item.desc}</div>
          <div class="flex items-center gap-3 mt-2 text-[11px] font-mono">
            <span class="text-amber-400 font-bold">$${item.price.toLocaleString()} / ${item.unit}</span>
            <span class="text-slate-500">庫存現有: ${currentQty} ${item.unit}</span>
          </div>
        </div>
        <div>
          <button data-id="${item.id}" class="btn-buy-item px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs shadow-md transition cursor-pointer">
            購買 1 ${item.unit}
          </button>
        </div>
      `;

      const btnBuy = card.querySelector('.btn-buy-item');
      if (btnBuy) {
        btnBuy.onclick = () => {
          if (this.gameState.budget < item.price) {
            if (this.sfx && typeof this.sfx.playAlarm === 'function') this.sfx.playAlarm();
            alert('經費不足！無法採購此原料。');
            return;
          }

          if (this.sfx && typeof this.sfx.playTone === 'function') {
            this.sfx.playTone(920, 'sine', 0.1);
          }
          this.gameState.budget -= item.price;
          this.gameState.inventory[item.id] = (this.gameState.inventory[item.id] || 0) + 1;
          this.updateTaskbar();
          this.renderMarket();
          if (this.onUpdate) this.onUpdate();
        };
      }

      listEl.appendChild(card);
    });
  }

  // ----------------------------------------------------
  // 4. 物料倉庫存量盤點
  // ----------------------------------------------------
  renderInventory() {
    const title = document.getElementById('app-window-title');
    const icon = document.getElementById('app-window-icon');
    const body = document.getElementById('app-window-body');
    if (!title || !icon || !body) return;

    title.innerText = '實驗室物料倉庫存量盤點';
    icon.innerText = '🗂️';

    body.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-4">
        <div class="border-b border-slate-800 pb-3">
          <h3 class="text-base font-extrabold text-white">全組共用物料庫存</h3>
          <p class="text-xs text-slate-400">所有於商城採購的金屬、複合材料、電子零件與化學品皆安全存放於此。</p>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          ${this.productsDatabase.items.map(i => `
            <div class="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
              <div class="text-[10px] text-slate-400 font-bold truncate">${i.name}</div>
              <div class="text-2xl font-black font-mono mt-1 ${ (this.gameState.inventory[i.id] || 0) > 0 ? 'text-emerald-400' : 'text-slate-600'}">
                ${this.gameState.inventory[i.id] || 0}
              </div>
              <div class="text-[10px] text-slate-500 font-mono">${i.unit}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------
  // 5. OpenMotor 推進模擬器
  // ----------------------------------------------------
  renderOpenMotorApp() {
    const title = document.getElementById('app-window-title');
    const icon = document.getElementById('app-window-icon');
    const body = document.getElementById('app-window-body');
    if (!title || !icon || !body) return;

    title.innerText = 'OpenMotor v2.4 - 固態推進燃燒推力數值模擬';
    icon.innerText = '🔥';

    const hasMaterials = (
      (this.gameState.inventory.chem_kno3 || 0) >= 1 &&
      (this.gameState.inventory.chem_sorbitol || 0) >= 1 &&
      (this.gameState.inventory.graphite_rod || 0) >= 1
    );

    body.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 class="text-base font-extrabold text-white">發動機幾何與燃燒曲線仿真</h3>
            <p class="text-xs text-slate-400">利用 Saint-Robert 燃速定律與熱力學等熵膨脹計算推力與壓力。</p>
          </div>
          <span class="px-2.5 py-1 rounded-xl bg-red-950/80 border border-red-800 text-red-300 font-bold text-xs font-mono">
            推進次系統階段：${this.gameState.subsystems.propulsion}/3
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <label class="text-[10px] font-bold text-slate-400 block mb-1">藥柱幾何構型</label>
            <select class="w-full bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white p-1.5 focus:outline-none">
              <option value="bates">BATES 圓柱型 (中性燃燒)</option>
              <option value="star">星星孔型 (漸增/漸減混合)</option>
            </select>
          </div>
          <div class="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <label class="text-[10px] font-bold text-slate-400 block mb-1">噴喉直徑 (Throat)</label>
            <input type="text" value="9.2 mm (石墨)" readonly class="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-300 p-1.5">
          </div>
          <div class="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <label class="text-[10px] font-bold text-slate-400 block mb-1">配方型號</label>
            <input type="text" value="KNSB 65/35" readonly class="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-300 p-1.5">
          </div>
        </div>

        <div class="p-3.5 rounded-2xl ${hasMaterials ? 'bg-emerald-950/40 border border-emerald-800' : 'bg-amber-950/40 border border-amber-800'} text-xs">
          <div class="font-bold text-white mb-1">仿真所需庫存原料檢核：</div>
          <div class="flex gap-4 text-[11px] font-mono">
            <span class="${(this.gameState.inventory.chem_kno3 || 0) >= 1 ? 'text-emerald-400' : 'text-red-400'}">• 硝酸鉀 KNO3: ${this.gameState.inventory.chem_kno3 || 0}/1</span>
            <span class="${(this.gameState.inventory.chem_sorbitol || 0) >= 1 ? 'text-emerald-400' : 'text-red-400'}">• 山梨醇 Sorbitol: ${this.gameState.inventory.chem_sorbitol || 0}/1</span>
            <span class="${(this.gameState.inventory.graphite_rod || 0) >= 1 ? 'text-emerald-400' : 'text-red-400'}">• 石墨噴喉棒材: ${this.gameState.inventory.graphite_rod || 0}/1</span>
          </div>
        </div>

        <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center">
          <button id="btn-run-openmotor" ${hasMaterials ? '' : 'disabled'}
            class="px-6 py-2.5 rounded-xl ${hasMaterials ? 'bg-red-600 hover:bg-red-500 active:scale-95 text-white cursor-pointer' : 'bg-slate-800 text-slate-500 cursor-not-allowed'} font-black text-xs shadow-lg transition">
            🚀 執行數值模擬計算
          </button>

          <div id="sim-output" class="mt-4 ${this.gameState.simResults ? '' : 'hidden'} text-left space-y-2 border-t border-slate-900 pt-3">
            <div class="text-xs font-bold text-emerald-400">✅ 數值求解收斂完畢 (Simulation Converged)：</div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div class="p-2 rounded-lg bg-slate-900"><span class="text-slate-400 block text-[10px]">峰值推力 (Max Thrust)</span><span class="font-bold text-white">412 N</span></div>
              <div class="p-2 rounded-lg bg-slate-900"><span class="text-slate-400 block text-[10px]">燃燒時間 (Burn Time)</span><span class="font-bold text-white">2.35 s</span></div>
              <div class="p-2 rounded-lg bg-slate-900"><span class="text-slate-400 block text-[10px]">總衝 (Total Impulse)</span><span class="font-bold text-cyan-300">785 N·s (I-Class)</span></div>
              <div class="p-2 rounded-lg bg-slate-900"><span class="text-slate-400 block text-[10px]">燃燒室壓力 (Max Pc)</span><span class="font-bold text-amber-300">3.65 MPa</span></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const btnRun = document.getElementById('btn-run-openmotor');
    if (btnRun && hasMaterials) {
      btnRun.onclick = () => {
        btnRun.innerText = '正在進行流體與燃燒迭代計算...';
        btnRun.disabled = true;
        if (this.sfx && typeof this.sfx.playTone === 'function') {
          this.sfx.playTone(440, 'sawtooth', 0.2);
        }

        setTimeout(() => {
          this.gameState.inventory.chem_kno3 -= 1;
          this.gameState.inventory.chem_sorbitol -= 1;
          this.gameState.inventory.graphite_rod -= 1;
          this.gameState.simResults = true;

          if (this.gameState.subsystems.propulsion < 3) {
            this.gameState.subsystems.propulsion += 1;
          }

          this.renderOpenMotorApp();
          if (this.onUpdate) this.onUpdate();
        }, 700);
      };
    }
  }

  // 6. 通用軟體介面佔位
  renderGenericApp(appId) {
    const title = document.getElementById('app-window-title');
    const icon = document.getElementById('app-window-icon');
    const body = document.getElementById('app-window-body');
    if (!title || !icon || !body) return;

    const app = this.appsDatabase.find(a => a.id === appId) || { name: '專用軟體', icon: '💻' };
    title.innerText = app.name;
    icon.innerText = app.icon;

    body.innerHTML = `
      <div class="p-6 text-center text-slate-400">
        <div class="text-4xl mb-3">${app.icon}</div>
        <p class="text-sm font-bold text-slate-200">${app.name} 運行中</p>
        <p class="text-xs mt-2 text-slate-400">${app.desc || '該模組已完成部署，等待小組硬體接入聯調。'}</p>
      </div>
    `;
  }

  loadFallbackDatabases() {
    this.appsDatabase = [
      { id: 'openmotor', name: 'OpenMotor 燃燒推力模擬器', icon: '🔥', category: '推進工程', size: '142 MB', price: 0, isPaid: false, desc: '固體發動機燃燒壓力與推力模擬。', targetWorkstation: 'propulsion' },
      { id: 'kicad', name: 'KiCad EDA 電路設計', icon: '⚡', category: '航電飛控', size: '260 MB', price: 0, isPaid: false, desc: '開源 PCB 佈線工具。', targetWorkstation: 'avionics' }
    ];
    this.productsDatabase = {
      categories: [
        { id: 'all', name: '全部原料' },
        { id: 'metals', name: '金屬材料' },
        { id: 'chemicals', name: '化學品' }
      ],
      items: [
        { id: 'chem_kno3', category: 'chemicals', name: '硝酸鉀 KNO3 5kg', price: 1200, unit: '包', desc: '固態推進劑氧化劑。' },
        { id: 'chem_sorbitol', category: 'chemicals', name: '山梨醇 3kg', price: 650, unit: '包', desc: '固態燃料。' },
        { id: 'graphite_rod', category: 'metals', name: '石墨噴喉棒材', price: 3200, unit: '根', desc: '耐高溫石墨噴喉。' }
      ]
    };
  }
}