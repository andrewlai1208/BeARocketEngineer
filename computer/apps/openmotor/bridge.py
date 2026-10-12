import sys
import os
import json
import types

def _make_mock(name):
    m = types.ModuleType(name)
    # 任何屬性都回傳一個假函式，避免 "from x import y" 失敗
    m.__getattr__ = lambda attr: (lambda *a, **k: 0.0)
    return m

# C 擴充套件在 WASM 無法使用，先塞假模組（必須在 import motorlib 之前）
for _name in ('skfmm', 'mathlib._find_perimeter_cy'):
    if _name not in sys.modules:
        sys.modules[_name] = _make_mock(_name)

# scikit-image 已用 loadPackage 安裝，優先用真的
try:
    import skimage.draw
except Exception:
    sys.modules['skimage'] = _make_mock('skimage')
    sys.modules['skimage.draw'] = _make_mock('skimage.draw')

if '/home/pyodide' not in sys.path:
    sys.path.insert(0, '/home/pyodide')

from motorlib.motor import Motor
from motorlib.propellant import Propellant
from motorlib.nozzle import Nozzle
from motorlib.grains.bates import BatesGrain

class OpenMotorBridge:
    def run_native_simulation(self, config_json_str):
        cfg = json.loads(config_json_str)
        p, g, nz = cfg['propellant'], cfg['grain'], cfg['nozzle']

        # 推進劑 (a: mm/s/MPa^n -> m/s/Pa^n)
        n = float(p['n'])
        a_si = float(p['a']) * 1e-3 / (1e6 ** n)
        prop = Propellant()
        prop.setProperties({
            'name': p.get('name', 'KNSB'),
            'density': float(p['density']),
            'tabs': [{
                'minPressure': 0.0,
                'maxPressure': 1.0342e7,
                'a': a_si,
                'n': n,
                'k': float(p['gamma']),
                'm': float(p.get('m', 41.3)),
                't': float(p.get('t', 1600)),
            }],
        })

        motor = Motor()
        motor.propellant = prop

        dt = float(nz['dt']) / 1000.0
        motor.nozzle.setProperties({
            'throat': dt,
            'exit': float(nz.get('de', nz['dt'] * 2.1)) / 1000.0,
            'efficiency': float(nz.get('efficiency', 0.95)),
            'divAngle': float(nz.get('divAngle', 15)),
            'convAngle': float(nz.get('convAngle', 45)),
            'throatLength': float(nz.get('throatLength', 0.005)),
            'slagCoeff': float(nz.get('slagCoeff', 0)),
            'erosionCoeff': float(nz.get('erosionCoeff', 0)),
        })

        for _ in range(int(g['count'])):
            grain = BatesGrain()
            grain.setProperties({
                'diameter': float(g['od']) / 1000.0,
                'length': float(g['len']) / 1000.0,
                'coreDiameter': float(g['id']) / 1000.0,
            })
            motor.grains.append(grain)

        simRes = motor.runSimulation()

        if not simRes.success:
            msgs = [f"{a.level} {a.type} {a.location}: {a.description}" for a in simRes.alerts]
            raise ValueError("openMotor 模擬失敗: " + " | ".join(msgs))

        ch = simRes.channels
        time_l   = [float(x) for x in ch['time'].getData()]
        thrust_l = [float(x) for x in ch['force'].getData()]
        pc_l     = [float(x) / 1e6 for x in ch['pressure'].getData()]  # Pa -> MPa
        kn_l     = [float(x) for x in ch['kn'].getData()]

        if not time_l:
            raise ValueError("模擬無時序資料; alerts: " +
                             " | ".join(str(a.description) for a in simRes.alerts))

        return json.dumps({
            'time': time_l,
            'thrust': thrust_l,
            'chamber_pressure': pc_l,
            'kn': kn_l,
            'peak_thrust': max(thrust_l),
            'max_pc': max(pc_l),
            'total_impulse': float(simRes.getImpulse()),
            'isp': float(simRes.getISP()),
        })

openmotor_bridge = OpenMotorBridge()