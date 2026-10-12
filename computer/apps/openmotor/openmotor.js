// computer/apps/openmotor/openmotor.js

export class OpenMotorApp {
  constructor() {
    this.id = 'openmotor';
    this.name = 'openMotor Native Engine Workstation';
    this.icon = '🐍';

    this.pyodide = null;
    this.isPyReady = false;
    this.simulationResult = null;
  }

  // 初始化 Pyodide 並解壓 motorlib / mathlib
  async initPyodideCore() {
    if (this.isPyReady) return;

    const statusBadge = document.getElementById('py-status-badge');

    try {
      if (!window.loadPyodide) {
        throw new Error('未在 index.html 檢測到 pyodide.js！');
      }

      if (statusBadge) statusBadge.innerText = '載入 Pyodide WASM...';
      this.pyodide = await window.loadPyodide();

      if (statusBadge) statusBadge.innerText = '載入科學計算套件 (NumPy, SciPy, Scikit-Image)...';
      await this.pyodide.loadPackage(['numpy', 'scipy', 'scikit-image']);

      if (statusBadge) statusBadge.innerText = '解壓 openMotor 核心庫...';
      const zipRes = await fetch('./computer/apps/openmotor/openmotor_lib.zip');
      if (!zipRes.ok) {
        throw new Error(`無法取得 openmotor_lib.zip (HTTP ${zipRes.status})`);
      }
      const zipBuffer = await zipRes.arrayBuffer();

      // 明確指定解壓至 /home/pyodide 目錄
      this.pyodide.unpackArchive(zipBuffer, 'zip', { extractDir: '/home/pyodide' });

      if (statusBadge) statusBadge.innerText = '連接 openMotor Bridge...';
      const bridgeRes = await fetch('./computer/apps/openmotor/bridge.py');
      if (!bridgeRes.ok) {
        throw new Error(`無法取得 bridge.py (HTTP ${bridgeRes.status})`);
      }
      const bridgeCode = await bridgeRes.text();
      await this.pyodide.runPythonAsync(bridgeCode);

      this.isPyReady = true;
      if (statusBadge) {
        statusBadge.innerText = 'openMotor motorlib 就緒';
        statusBadge.className = 'px-2 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[9px] font-bold';
      }
    } catch (err) {
      console.error('[openMotor Loader Error]:', err);
      if (statusBadge) {
        statusBadge.innerText = `載入失敗: ${err.message}`;
        statusBadge.className = 'px-2 py-0.2 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 font-mono text-[9px] font-bold';
      }
    }
  }

  render(container, gameState, sfx, onComplete) {
    this.gameState = gameState;
    this.sfx = sfx;
    this.onComplete = onComplete;

    container.innerHTML = `
      <div class="max-w-6xl mx-auto space-y-3 text-slate-100 font-sans select-none">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center text-xl shadow-md font-black text-white">
              🐍
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-extrabold text-white">openMotor Official Source Code Engine</h3>
                <span id="py-status-badge" class="px-2 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[9px] font-bold animate-pulse">
                  初始化 Pyodide 環境...
                </span>
              </div>
              <p class="text-[11px] text-slate-400">於網頁端直譯執行 reilleya/openMotor 官方 motorlib / mathlib 模組</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div class="md:col-span-4 space-y-2.5">
            <div class="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2">
              <div class="font-bold text-cyan-400 text-xs">📐 藥柱與噴嘴規格 (motorlib Input)</div>
              <div class="space-y-1.5 text-[10px] font-mono">
                <div>
                  <span class="text-slate-400 block">藥柱幾何構型</span>
                  <select id="om-grain-type" class="w-full bg-slate-900 border border-slate-700 rounded-md p-1 text-white font-bold">
                    <option value="bates">BATES 圓柱肉厚 (Bates Grain)</option>
                    <option value="star">Star Grain 星形核心 (Star Grain)</option>
                  </select>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div><span class="text-slate-400 block">外徑 OD (mm)</span><input type="number" id="om-grain-od" value="54" class="w-full bg-slate-900 border border-slate-700 rounded-md p-1 text-white font-bold text-center"></div>
                  <div><span class="text-slate-400 block">內孔 ID (mm)</span><input type="number" id="om-grain-id" value="18" class="w-full bg-slate-900 border border-slate-700 rounded-md p-1 text-white font-bold text-center"></div>
                  <div><span class="text-slate-400 block">長度 Length (mm)</span><input type="number" id="om-grain-len" value="140" class="w-full bg-slate-900 border border-slate-700 rounded-md p-1 text-white font-bold text-center"></div>
                  <div><span class="text-slate-400 block">節數 Count</span><input type="number" id="om-grain-count" value="3" min="1" max="8" class="w-full bg-slate-900 border border-slate-700 rounded-md p-1 text-white font-bold text-center"></div>
                </div>
                <div><span class="text-slate-400 block">噴喉直徑 Throat dt (mm)</span><input type="number" id="om-nozzle-dt" value="11.2" step="0.1" class="w-full bg-slate-900 border border-slate-700 rounded-md p-1 text-white font-bold text-center"></div>
              </div>
            </div>

            <button id="om-btn-solve" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 active:scale-95 text-white font-black text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2">
              <span>🔥</span> 呼叫 openMotor 原生類別求解
            </button>
          </div>

          <div class="md:col-span-8 bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between space-y-2">
            <div class="relative w-full h-56 bg-slate-900/90 rounded-xl overflow-hidden border border-slate-800">
              <canvas id="om-curves-canvas" class="w-full h-full block"></canvas>
            </div>

            <div id="om-results-panel" class="grid grid-cols-4 gap-2 text-xs font-mono pt-1">
              <div class="p-2 rounded-xl bg-slate-900 border border-slate-800"><span class="text-[9px] text-slate-400 block">峰值推力 Peak Thrust</span><span id="res-peak-thrust" class="text-xs font-bold text-red-400">-- N</span></div>
              <div class="p-2 rounded-xl bg-slate-900 border border-slate-800"><span class="text-[9px] text-slate-400 block">最高壓力 Max Pc</span><span id="res-max-pc" class="text-xs font-bold text-cyan-400">-- MPa</span></div>
              <div class="p-2 rounded-xl bg-slate-900 border border-slate-800"><span class="text-[9px] text-slate-400 block">總衝量 Impulse</span><span id="res-total-impulse" class="text-xs font-bold text-emerald-400">-- N·s</span></div>
              <div class="p-2 rounded-xl bg-slate-900 border border-slate-800"><span class="text-[9px] text-slate-400 block">質量比衝 Isp</span><span id="res-isp" class="text-xs font-bold text-purple-400">-- s</span></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.initPyodideCore().then(() => this.runSimulation());
  }

  bindEvents() {
    const btnSolve = document.getElementById('om-btn-solve');
    if (btnSolve) {
      btnSolve.onclick = () => {
        btnSolve.innerText = 'motorlib 原生計算中...';
        btnSolve.disabled = true;
        setTimeout(async () => {
          await this.runSimulation();
          btnSolve.innerText = '🔥 呼叫 openMotor 原生類別求解';
          btnSolve.disabled = false;
        }, 100);
      };
    }
  }

  async runSimulation() {
    if (!this.isPyReady) return;

    const grainType = document.getElementById('om-grain-type').value;
    const od = parseFloat(document.getElementById('om-grain-od').value) || 54;
    const id = parseFloat(document.getElementById('om-grain-id').value) || 18;
    const len = parseFloat(document.getElementById('om-grain-len').value) || 140;
    const count = parseInt(document.getElementById('om-grain-count').value) || 3;
    const dt = parseFloat(document.getElementById('om-nozzle-dt').value) || 11.2;

    const config = {
      propellant: { name: 'KNSB', density: 1840, c_star: 895, gamma: 1.130, a: 8.264, n: 0.319 },
      grain: { type: grainType, od, id, len, count },
      nozzle: { dt }
    };

    try {
      const pyCmd = `openmotor_bridge.run_native_simulation('${JSON.stringify(config)}')`;
      const resJsonStr = await this.pyodide.runPythonAsync(pyCmd);
      const res = JSON.parse(resJsonStr);

      this.simulationResult = res;
      this.renderCanvas();

      document.getElementById('res-peak-thrust').innerText = `${Math.round(res.peak_thrust)} N`;
      document.getElementById('res-max-pc').innerText = `${res.max_pc.toFixed(2)} MPa`;
      document.getElementById('res-total-impulse').innerText = `${Math.round(res.total_impulse)} N·s`;
      document.getElementById('res-isp').innerText = `${res.isp.toFixed(1)} s`;
    } catch (err) {
      console.error('[motorlib 計算錯誤]:', err);
    }
  }

  renderCanvas() {
    const canvas = document.getElementById('om-curves-canvas');
    if (!canvas || !this.simulationResult) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const { time, thrust, chamber_pressure, peak_thrust, max_pc } = this.simulationResult;
    const maxTime = time[time.length - 1] || 1;

    const padL = 35, padR = 35, padT = 15, padB = 20;
    const graphW = w - padL - padR;
    const graphH = h - padT - padB;

    // 網格底紋
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (graphH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
    }

    // 壓力曲線 (青藍色)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < time.length; i++) {
      const x = padL + (time[i] / maxTime) * graphW;
      const y = padT + graphH - (chamber_pressure[i] / (max_pc * 1.15 || 1)) * graphH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 推力曲線 (紅色)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < time.length; i++) {
      const x = padL + (time[i] / maxTime) * graphW;
      const y = padT + graphH - (thrust[i] / (peak_thrust * 1.15 || 1)) * graphH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}