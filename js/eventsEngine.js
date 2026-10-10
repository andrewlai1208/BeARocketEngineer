export class EventsEngine {
  constructor() {
    this.database = null;
  }

  async load(url = './data/events.json') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load events database: ${res.status}`);
    this.database = await res.json();
    return this.database;
  }

  getRoomConfig(roomId) {
    return this.database ? this.database[roomId] : null;
  }

  getEligibleEvent(roomId, gameState) {
    const room = this.getRoomConfig(roomId);
    if (!room || !room.events) return null;

    // 依優先順序排序
    const sorted = [...room.events].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const ev of sorted) {
      const cond = ev.conditions || {};

      if (cond.requiresNotSolved && cond.requiresNotSolved.some(id => gameState.solvedEvents.has(id))) {
        continue;
      }
      if (cond.requiresSolved && !cond.requiresSolved.every(id => gameState.solvedEvents.has(id))) {
        continue;
      }
      if (cond.minReadiness !== undefined && gameState.readiness < cond.minReadiness) {
        continue;
      }
      if (cond.maxBudget !== undefined && gameState.budget > cond.maxBudget) {
        continue;
      }
      if (cond.roleSpecific && cond.roleSpecific !== gameState.playerRole) {
        continue;
      }
      return ev;
    }
    return null;
  }
}