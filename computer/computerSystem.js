// computer/computerSystem.js
import { OpenMotorApp } from './apps/openmotor/openmotor.js';

export class ComputerSystem {
  constructor() {
    this.appsDatabase = [];
    this.productsDatabase = { categories: [], items: [] };
    this.currentLaptopId = null;
    this.currentLaptopMeta = null;
    this.activeCategory = 'all';

    // 註冊獨立 App 模組庫
    this.registeredApps = {
      openmotor: new OpenMotorApp()
    };

    // 每台電腦各自獨立的硬碟狀態
    this.workstationStates = {
      propulsion: { installedApps: ['appstore', 'market', 'inventory'] },
      avionics: { installedApps: ['appstore', 'market', 'inventory'] },
      structures: { installedApps: ['appstore', 'market', 'inventory'] },
      integration: { installedApps: ['appstore', 'market', 'inventory'] }
    };
  }

  async init() {
    this.setupDOMListeners();

    try {
      const [resApps, resProducts] = await Promise.all([
        fetch('./computer/apps.json'),
        fetch('./computer/products.json')
      ]);

      if (resApps.ok && resProducts.ok) {
        this.appsDatabase = await resApps.json();
        this.productsDatabase = await resProducts.json();
      } else {
        this.loadFallbackDatabases();
      }
    } catch (err) {
      console.warn('[RocketOS] 啟用本地備用資料庫', err);
      this.loadFallbackDatabases();
    }
  }

  setupDOMListeners() {
    const btnCloseOs = document.getElementById('btn-close-os');
    const btnCloseApp = document.getElementById('btn-close-app');

    if (btnCloseOs) btnCloseOs.onclick = () => this.closeLaptop();
    if (btnCloseApp) btnCloseApp.onclick = () => this.closeAppWindow();
  }

  loadWorkstationsFromSave(savedWorkstations) {
    if (savedWorkstations && typeof savedWorkstations === 'object') {
      Object.keys(this.workstationStates).forEach(id => {
        if (savedWorkstations[id] && Array.isArray(savedWorkstations[id].installedApps)) {
          this.workstationStates[id] = savedWorkstations[id];
        }
      });
    }
  }

  getWorkstationSaveData() {
    return this.workstationStates;
  }

  openLaptop(laptop, gameState, sfx, onUpdate) {
    if (!laptop || !laptop.id) return;

    this.currentLaptopId = laptop.id;
    this.currentLaptopMeta = laptop;
    this.gameState = gameState;
    this.sfx = sfx;
    this.onUpdate = onUpdate;

    this.setupDOMListeners();

    if (!this.workstationStates[this.currentLaptopId]) {
      this.workstationStates[this.currentLaptopId] = {
        installedApps: ['appstore', 'market', 'inventory']
      };
    }

    const modal = document.getElementById('os-modal') || document.getElementById('laptop-modal');
    if (modal) modal.classList.remove('hidden');

    const titleEl = document.getElementById('os-laptop-title');
    if (titleEl) {
      titleEl.innerText = `RocketOS 2022 - [${laptop.name || '專用工作站'}]`;
    }

    this.closeAppWindow();
    this.renderDesktopIcons();
    this.updateTaskbar();

    if (this.sfx && typeof this.sfx.playSelect === 'function') {
      this.sfx.playSelect();
    }
  }

  closeLaptop() {
    const modal = document.getElementById('os-modal') || document.getElementById('laptop-modal');
    if (modal) modal.classList.add('hidden');
    this.closeAppWindow();
    this.currentLaptopId = null;
    this.currentLaptopMeta = null;
    window.focus();
  }

  closeAppWindow() {
    const appWin = document.getElementById('os-app-window');
    const appBody = document.getElementById('app-window-body');
    if (appWin) appWin.classList.add('hidden');
    if (appBody) appBody.innerHTML = '';
  }

  updateTaskbar() {
    const tbBudget = document.getElementById('os-taskbar-budget');
    if (tbBudget && this.gameState) {
      tbBudget.innerText = `$${this.gameState.budget.toLocaleString()}`;
    }
  }

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
        displayApps.push({ id: app.id, name: app.name.split(' ')[0], icon: app.icon });
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

  openApp(appId) {
    if (this.sfx && typeof this.sfx.playTone === 'function') {
      this.sfx.playTone(700, 'sine', 0.1);
    }

    const appWin = document.getElementById('os-app-window');
    const appBody = document.getElementById('app-window-body');
    if (!appWin || !appBody) return;

    appWin.classList.remove('hidden');

    // 檢查是否有獨立綁定的 App 模組
    if (this.registeredApps[appId]) {
      const appInstance = this.registeredApps[appId];
      document.getElementById('app-window-title').innerText = appInstance.name;
      document.getElementById('app-window-icon').innerText = appInstance.icon;
      appInstance.render(appBody, this.gameState, this.sfx, () => {
        this.updateTaskbar();
        if (this.onUpdate) this.onUpdate();
      });
      return;
    }

    if (appId === 'appstore') {
      this.renderAppStore();
    } else if (appId === 'market') {
      this.renderMarket();
    } else if (appId === 'inventory') {
      this.renderInventory();
    } else {
      this.renderGenericApp(appId);
    }
  }

  renderAppStore() {
    const title = document.getElementById('app-window-title');
    const icon = document.getElementById('app-window-icon');
    const body = document.getElementById('app-window-body');
    if (!title || !icon || !body) return;

    title.innerText = `Rocket App Store - 研發軟體市集 (${this.currentLaptopMeta ? this.currentLaptopMeta.name : '工作站'})`;
    icon.innerText = '📦';

    body.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-4">
        <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h3 class="text-base font-extrabold text-white">官方工程軟體庫</h3>
            <p class="text-xs text-slate-400">所有工具皆無庫存限制，可自由安裝。</p>
          </div>
          <div class="text-xs font-mono text-emerald-400 font-bold">
            團隊餘額：$${this.gameState.budget.toLocaleString()}
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5" id="app-store-list"></div>
      </div>
    `;

    const listEl = document.getElementById('app-store-list');
    const currentInstalled = this.workstationStates[this.currentLaptopId].installedApps;

    this.appsDatabase.forEach(app => {
      const isInstalled = currentInstalled.includes(app.id);
      const card = document.createElement('div');
      card.className = 'p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between gap-3 shadow-sm';

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
            ${app.isPaid ? `<span class="text-amber-400 font-mono font-bold text-[10px]">$${app.price}</span>` : '<span class="text-emerald-400 font-mono font-bold text-[10px]">免費</span>'}
          </div>
          <p class="text-[11px] text-slate-400 mt-2 leading-relaxed">${app.desc}</p>
        </div>
        <div class="flex justify-end pt-2 border-t border-slate-900">
          ${
            isInstalled
              ? '<button disabled class="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-500 font-bold text-xs">已安裝至本機</button>'
              : `<button data-app="${app.id}" class="btn-install-app px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition">安裝軟體</button>`
          }
        </div>
      `;

      const btnInstall = card.querySelector('.btn-install-app');
      if (btnInstall) {
        btnInstall.onclick = () => {
          if (app.isPaid && this.gameState.budget < app.price) {
            alert('經費不足！');
            return;
          }
          if (app.isPaid) this.gameState.budget -= app.price;

          this.workstationStates[this.currentLaptopId].installedApps.push(app.id);
          this.updateTaskbar();
          this.renderDesktopIcons();
          this.renderAppStore();
          if (this.onUpdate) this.onUpdate();
        };
      }

      listEl.appendChild(card);
    });
  }

  renderMarket() {
    const body = document.getElementById('app-window-body');
    if (body) body.innerHTML = '<div class="p-6 text-center text-slate-400">商城原料在庫已無限制，可前往相應專用 App 直接測試選配。</div>';
  }

  renderInventory() {
    const body = document.getElementById('app-window-body');
    if (body) body.innerHTML = '<div class="p-6 text-center text-slate-400">全組無限材料庫存已就緒。</div>';
  }

  renderGenericApp(appId) {
    const body = document.getElementById('app-window-body');
    if (body) body.innerHTML = `<div class="p-6 text-center text-slate-400">專用模組 ${appId} 運行中。</div>`;
  }

  loadFallbackDatabases() {
    this.appsDatabase = [
      { id: 'openmotor', name: 'OpenMotor 燃燒推力模擬器', icon: '🔥', category: '推進工程', size: '142 MB', price: 0, isPaid: false, desc: '固態發動機幾何、壓力量測與推力模擬。', targetWorkstation: 'propulsion' }
    ];
    this.productsDatabase = { categories: [], items: [] };
  }
}