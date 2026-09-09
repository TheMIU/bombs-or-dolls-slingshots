/**
 * js/config.js - Game Configuration & Balance Parameters for Slingshots Edition
 * Updated to match the new 1920x1080 background and repositioned slingshots:
 * - 1920x1080 Virtual Canvas Resolution
 * - 9 Columns x 8 Rows Mountain Grid (X: 444 to 1516, Y: 128 to 1080)
 * - Row 0: Peak Summit with 8 Flags and Central Trophy
 * - Rows 6-7: Base Camp deployment zone (level with slingshots)
 * - Left Slingshot (P1): x=268, y=885
 * - Right Slingshot (P2): x=1660, y=885
 */

window.GameConfig = {
  // 1920x1080 Full HD Virtual Canvas
  CANVAS: {
    WIDTH: 1920,
    HEIGHT: 1080,
    GRAVITY: 1100
  },

  // 9x8 Grid Layout - Centered mountain, leaving bottom clear for cards dock
  GRID: {
    COLS: 9,
    ROWS: 8,
    X_START: 465,
    X_END: 1455,
    Y_START: 120,
    Y_END: 840,
    get COL_WIDTH() { return (this.X_END - this.X_START) / this.COLS; }, // 110.0px
    get ROW_HEIGHT() { return (this.Y_END - this.Y_START) / this.ROWS; } // 90.0px
  },

  // Mountain & Arena Configuration
  ARENA: {
    peakRow: 0,                   // Summit Peak at Row 0
    climbDirection: -1,           // Both players climb upwards (y decreases toward 0)
    deployRows: [6, 7],           // Unified bottom base camp (Rows 6-7, all 9 columns)
    flagCols: [0, 1, 2, 3, 5, 6, 7, 8], // 8 summit flag columns (col 4 has summit trophy)
    trophyCol: 4
  },

  // Mana parameters
  MANA: {
    MAX: 10,
    START: 10,
    REGEN_PER_SECOND: 0.35 // ~2.8s per 1 mana point
  },

  speedMultiplier: 1.0,

  // Baseline climb speeds (seconds per vertical row step)
  BASE_SPEEDS: {
    scout: 2.2,
    sumo: 5.0,
    knight: 3.2,
    doctor: 3.8
  },

  // Slingshot Physics & Positions (Mounted on simple-shape stone bastions)
  SLINGSHOTS: {
    P1: {
      id: 1,
      x: 270,
      y: 720,
      prongLeft: { x: 220, y: 645 },
      prongRight: { x: 320, y: 645 },
      restX: 270,
      restY: 685,
      maxPull: 140,
      launchSpeedMultiplier: 9.5, // Less sensitive, smooth deliberate aiming across all 9 columns
      teamColor: "#0284c7",
      teamColorGlow: "rgba(56, 189, 248, 0.4)",
      bandColor: "#92400e",
      pouchColor: "#451a03"
    },
    P2: {
      id: 2,
      x: 1650,
      y: 720,
      prongLeft: { x: 1600, y: 645 },
      prongRight: { x: 1700, y: 645 },
      restX: 1650,
      restY: 685,
      maxPull: 140,
      launchSpeedMultiplier: 9.5,
      teamColor: "#e11d48",
      teamColorGlow: "rgba(251, 113, 133, 0.4)",
      bandColor: "#92400e",
      pouchColor: "#451a03"
    }
  },

  getDefaultSettings() {
    return {
      startMana: 10,
      regenRate: 0.35,
      speedMultiplier: 1.0,
      cardCosts: {
        scout: 2,
        knight: 3,
        sumo: 4,
        doctor: 3,
        basic: 2,
        timer: 3,
        area: 4,
        shock: 4
      }
    };
  },

  CARDS: [
    // --- BOMBS ---
    {
      id: "basic",
      kind: "bomb",
      category: "bombs",
      name: "Basic Bomb",
      cost: 2,
      damage: 80,
      blastRadius: 90,
      sprite: "assets/sprite_basic_bomb.png",
      cardImg: "assets/card_basic_bomb.png",
      description: "Direct impact blast dealing 80 damage. Can strike anywhere on the mountain."
    },
    {
      id: "timer",
      kind: "bomb",
      category: "bombs",
      name: "Timer Bomb",
      cost: 3,
      fuseSec: 3.5,
      damage: 85,
      blastRadius: 120,
      sprite: "assets/sprite_timer_bomb.png",
      cardImg: "assets/card_timer_bomb.png",
      description: "Delayed blast: sticks and detonates after 3.5s dealing 85 damage in 3x3."
    },
    {
      id: "area",
      kind: "bomb",
      category: "bombs",
      name: "Area Bomb",
      cost: 4,
      damage: 50,
      blastRadius: 150,
      sprite: "assets/sprite_area_bomb.png",
      cardImg: "assets/card_area_bomb.png",
      description: "Quick explosive wave dealing 50 damage across multiple lanes."
    },
    {
      id: "shock",
      kind: "bomb",
      category: "bombs",
      name: "Shock Bomb",
      cost: 4,
      damage: 20,
      stunDurationSec: 4.0,
      blastRadius: 130,
      sprite: "assets/sprite_shock_bomb.png",
      cardImg: "assets/card_shock_bomb.png",
      description: "Zaps enemy units, freezing and disabling them for 4.0 seconds."
    },

    // --- HIKERS ---
    {
      id: "scout",
      kind: "hiker",
      category: "hikers",
      name: "Scout",
      role: "Fast Climber",
      cost: 2,
      hp: 45,
      maxHp: 45,
      stepIntervalSec: 2.2,
      sprite: "assets/sprite_scout.png",
      cardImg: "assets/card_scout.png",
      description: "Low health, fastest climber for racing toward summit flags."
    },
    {
      id: "knight",
      kind: "hiker",
      category: "hikers",
      name: "Knight",
      role: "Combat Striker",
      cost: 3,
      hp: 75,
      maxHp: 75,
      stepIntervalSec: 3.2,
      attackDamage: 22,
      attackCooldownSec: 1.6,
      attackRange: 1,
      sprite: "assets/sprite_knight.png",
      cardImg: "assets/card_knight.png",
      description: "Attacks nearby enemy climbers with melee slashes."
    },
    {
      id: "sumo",
      kind: "hiker",
      category: "hikers",
      name: "Sumo",
      role: "Tank / Blocker",
      cost: 4,
      hp: 120,
      maxHp: 120,
      stepIntervalSec: 5.0,
      isBlocker: true,
      sprite: "assets/sprite_sumo.png",
      cardImg: "assets/card_sumo.png",
      description: "Huge 120 HP pool with Heavy Armor. Cannot be one-shot by bombs and blocks enemies."
    },
    {
      id: "doctor",
      kind: "hiker",
      category: "hikers",
      name: "Doctor",
      role: "Support Healer",
      cost: 3,
      hp: 50,
      maxHp: 50,
      stepIntervalSec: 3.8,
      healAmount: 16,
      healCooldownSec: 2.0,
      healRange: 1,
      sprite: "assets/sprite_doctor.png",
      cardImg: "assets/card_doctor.png",
      description: "Passively heals damaged friendly climbers nearby."
    }
  ],

  applySettings(s, persist = true) {
    if (!s) return;

    if (typeof s.startMana === "number") {
      this.MANA.START = Math.max(1, Math.min(10, s.startMana));
    }

    if (typeof s.regenRate === "number") {
      this.MANA.REGEN_PER_SECOND = Math.max(0.1, Math.min(2.0, s.regenRate));
    }

    if (typeof s.speedMultiplier === "number") {
      this.speedMultiplier = Math.max(0.4, Math.min(3.0, s.speedMultiplier));
      this.CARDS.forEach(card => {
        if (card.kind === "hiker" && this.BASE_SPEEDS[card.id]) {
          card.stepIntervalSec = parseFloat((this.BASE_SPEEDS[card.id] / this.speedMultiplier).toFixed(2));
        }
      });
    }

    if (s.cardCosts && typeof s.cardCosts === "object") {
      this.CARDS.forEach(card => {
        if (typeof s.cardCosts[card.id] === "number") {
          card.cost = Math.max(1, Math.min(10, s.cardCosts[card.id]));
        }
      });
    }

    if (persist) {
      try {
        localStorage.setItem("bod_slingshot_settings", JSON.stringify({
          startMana: this.MANA.START,
          regenRate: this.MANA.REGEN_PER_SECOND,
          speedMultiplier: this.speedMultiplier,
          cardCosts: this.getCurrentCosts()
        }));
      } catch (e) {}
    }
  },

  getCurrentCosts() {
    const costs = {};
    this.CARDS.forEach(c => { costs[c.id] = c.cost; });
    return costs;
  },

  loadSavedSettings() {
    try {
      const saved = localStorage.getItem("bod_slingshot_settings");
      if (saved) {
        this.applySettings(JSON.parse(saved), false);
      }
    } catch (e) {}
  }
};

window.GameConfig.loadSavedSettings();
