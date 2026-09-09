/**
 * js/state.js - Game State Container & Data Accessors for Slingshots Edition
 */

window.GameState = {
  isStarted: false,
  isPaused: false,
  isGameOver: false,
  winner: null,
  matchTimeSec: 0,

  // Players mana: [P1, P2]
  mana: [
    window.GameConfig.MANA.START,
    window.GameConfig.MANA.START
  ],

  // 8 Summit Flags: 0 = neutral, 1 = Player 1 (Blue), 2 = Player 2 (Red)
  flags: [0, 0, 0, 0, 0, 0, 0, 0],

  // Currently loaded card in each player's slingshot: [CardObj or null, CardObj or null]
  loadedCard: [null, null],

  // Active flying projectiles launched from slingshots
  projectiles: [],

  // Active hikers climbing the 9 lanes: Array of Hiker
  units: [],

  // Active bombs ticking or on cells: Array of Bomb
  bombs: [],

  // Visual effects
  particles: [],
  floatingTexts: [],

  // AI Opponent enabled for Player 2
  aiEnabled: true,

  _nextId: 1,
  getNextId() {
    return this._nextId++;
  },

  reset() {
    this.isStarted = false;
    this.isPaused = false;
    this.isGameOver = false;
    this.winner = null;
    this.matchTimeSec = 0;
    this.mana = [
      window.GameConfig.MANA.START,
      window.GameConfig.MANA.START
    ];
    this.flags = [0, 0, 0, 0, 0, 0, 0, 0];
    this.loadedCard = [null, null];
    this.projectiles = [];
    this.units = [];
    this.bombs = [];
    this.particles = [];
    this.floatingTexts = [];
  },

  getUnitAt(x, y) {
    return this.units.find(u => u.x === x && u.y === y && u.hp > 0);
  },

  getUnitsInRadius(x, y, radius) {
    return this.units.filter(u => {
      if (u.hp <= 0) return false;
      const dx = Math.abs(u.x - x);
      const dy = Math.abs(u.y - y);
      return dx <= radius && dy <= radius;
    });
  },

  getBombAt(x, y) {
    return this.bombs.find(b => b.x === x && b.y === y);
  },

  isCellBlocked(x, y, hikerPlayer) {
    const occupant = this.getUnitAt(x, y);
    if (!occupant) return false;
    if (occupant.player === hikerPlayer) return true;
    if (occupant.card.isBlocker) return true;
    return false;
  },

  addFloatingText(x, y, text, color = "#ffffff", size = 18) {
    this.floatingTexts.push({
      x: x + (Math.random() * 20 - 10),
      y: y - 10,
      text: text,
      color: color,
      size: size,
      life: 1.2,
      maxLife: 1.2,
      vy: -35
    });
  },

  addExplosionParticles(x, y, color = "#f97316", count = 30) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 240;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.4 ? color : (Math.random() > 0.5 ? "#fbbf24" : "#ffffff"),
        radius: 3 + Math.random() * 5,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        gravity: 400
      });
    }
  },

  addSmokeParticle(x, y, color = "rgba(255, 255, 255, 0.4)") {
    this.particles.push({
      x: x + (Math.random() * 6 - 3),
      y: y + (Math.random() * 6 - 3),
      vx: (Math.random() * 20 - 10),
      vy: (Math.random() * 20 - 10),
      color: color,
      radius: 4 + Math.random() * 4,
      life: 0.35,
      maxLife: 0.35,
      gravity: -40
    });
  }
};
