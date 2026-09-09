/**
 * js/config.js - Game Configuration & Balance Parameters for Slingshots Edition
 */

window.GameConfig = {
  // Virtual resolution of the game arena (matching slingshot.png)
  CANVAS: {
    WIDTH: 1536,
    HEIGHT: 1024,
    GRAVITY: 980 // pixels / sec^2 for realistic ballistic arc
  },

  // Mana parameters
  MANA: {
    MAX: 10,
    START: 10,
    REGEN_PER_SECOND: 0.40 // ~2.5s per mana point
  },

  // Slingshot Physics & Positions
  SLINGSHOTS: {
    // Left Slingshot (Player 1 - Blue)
    P1: {
      id: 1,
      x: 236,
      y: 486,
      prongLeft: { x: 198, y: 448 },
      prongRight: { x: 275, y: 448 },
      restX: 236,
      restY: 486,
      maxPull: 110,
      launchSpeedMultiplier: 9.5, // pixels/sec per pixel of pull
      teamColor: "#0284c7",
      teamColorGlow: "rgba(56, 189, 248, 0.4)",
      bandColor: "#854d0e",
      pouchColor: "#451a03"
    },
    // Right Slingshot (Player 2 - Red)
    P2: {
      id: 2,
      x: 1300,
      y: 486,
      prongLeft: { x: 1262, y: 448 },
      prongRight: { x: 1338, y: 448 },
      restX: 1300,
      restY: 486,
      maxPull: 110,
      launchSpeedMultiplier: 9.5,
      teamColor: "#e11d48",
      teamColorGlow: "rgba(251, 113, 133, 0.4)",
      bandColor: "#854d0e",
      pouchColor: "#451a03"
    }
  },

  // Card Definitions matching slingshot.png
  CARDS: [
    // --- BOMBS ---
    {
      id: "basic",
      kind: "bomb",
      category: "bombs",
      name: "Basic Bomb",
      cost: 2,
      damage: 75,
      blastRadius: 80,
      sprite: "assets/sprite_basic_bomb.png",
      cardImg: "assets/card_basic_bomb.png",
      description: "Direct impact blast dealing 75 damage to enemy climbers."
    },
    {
      id: "timer",
      kind: "bomb",
      category: "bombs",
      name: "Timer Bomb",
      cost: 3,
      fuseSec: 3.0,
      damage: 90,
      blastRadius: 110,
      sprite: "assets/sprite_timer_bomb.png",
      cardImg: "assets/card_timer_bomb.png",
      description: "Lands on ledge and ticks for 3.0s before a devastating 90 damage explosion."
    },
    {
      id: "area",
      kind: "bomb",
      category: "bombs",
      name: "Area Bomb",
      cost: 4,
      damage: 55,
      blastRadius: 140,
      sprite: "assets/sprite_area_bomb.png",
      cardImg: "assets/card_area_bomb.png",
      description: "Massive cluster blast hitting multiple ledges with 55 damage."
    },
    {
      id: "shock",
      kind: "bomb",
      category: "bombs",
      name: "Shock Bomb",
      cost: 4,
      damage: 20,
      stunDurationSec: 4.0,
      blastRadius: 120,
      sprite: "assets/sprite_shock_bomb.png",
      cardImg: "assets/card_shock_bomb.png",
      description: "Electric EMP wave that zaps and freezes enemy climbers for 4.0 seconds."
    },

    // --- HIKERS ---
    {
      id: "scout",
      kind: "hiker",
      category: "hikers",
      name: "Scout",
      cost: 2,
      hp: 50,
      maxHp: 50,
      climbSpeed: 65, // pixels / second along climbing path
      sprite: "assets/sprite_scout.png",
      cardImg: "assets/card_scout.png",
      description: "Agile, lightweight climber with fastest climbing speed."
    },
    {
      id: "knight",
      kind: "hiker",
      category: "hikers",
      name: "Knight",
      cost: 3,
      hp: 85,
      maxHp: 85,
      climbSpeed: 42,
      attackDamage: 22,
      attackCooldownSec: 1.6,
      attackRange: 60,
      sprite: "assets/sprite_knight.png",
      cardImg: "assets/card_knight.png",
      description: "Armed melee fighter with sword slashes to defeat nearby enemy hikers."
    },
    {
      id: "sumo",
      kind: "hiker",
      category: "hikers",
      name: "Sumo",
      cost: 4,
      hp: 140,
      maxHp: 140,
      climbSpeed: 28,
      isBlocker: true,
      sprite: "assets/sprite_sumo.png",
      cardImg: "assets/card_sumo.png",
      description: "Massive 140 HP tank armor that blocks enemy climbers from overtaking."
    },
    {
      id: "doctor",
      kind: "hiker",
      category: "hikers",
      name: "Doctor",
      cost: 3,
      hp: 60,
      maxHp: 60,
      climbSpeed: 38,
      healAmount: 18,
      healCooldownSec: 2.0,
      healRange: 80,
      sprite: "assets/sprite_doctor.png",
      cardImg: "assets/card_doctor.png",
      description: "Passively radiates healing aura (+18 HP) to wounded friendly climbers."
    }
  ],

  // Summit Peak capture coordinate (x, y)
  SUMMIT_PEAK: {
    x: 768,
    y: 110,
    flagX: 772,
    flagY: 48,
    radius: 45
  },

  // Mountain Climbing Path & Waypoints
  // Waypoints form a directed graph of ledges and ladders climbing up to the Summit Peak
  MOUNTAIN_WAYPOINTS: [
    // Tier 0 - Ground Base Camps
    { id: "base_left", x: 420, y: 720, tier: 0, next: ["tier1_left"] },
    { id: "base_mid", x: 768, y: 720, tier: 0, next: ["tier1_mid_left", "tier1_mid_right"] },
    { id: "base_right", x: 1110, y: 720, tier: 0, next: ["tier1_right"] },

    // Tier 1 - Lower Mountain Terraces
    { id: "tier1_left", x: 480, y: 640, tier: 1, next: ["tier2_left"] },
    { id: "tier1_mid_left", x: 670, y: 630, tier: 1, next: ["tier2_mid_left"] },
    { id: "tier1_mid_right", x: 860, y: 630, tier: 1, next: ["tier2_mid_right"] },
    { id: "tier1_right", x: 1040, y: 640, tier: 1, next: ["tier2_right"] },

    // Tier 2 - Mid Terraces & Wooden Scaffolding Base
    { id: "tier2_left", x: 540, y: 550, tier: 2, next: ["tier3_left_scaffold"] },
    { id: "tier2_mid_left", x: 710, y: 530, tier: 2, next: ["tier3_center"] },
    { id: "tier2_mid_right", x: 820, y: 530, tier: 2, next: ["tier3_center"] },
    { id: "tier2_right", x: 970, y: 560, tier: 2, next: ["tier3_right_scaffold"] },

    // Tier 3 - Scaffolding Platforms & Mid Cliffs
    { id: "tier3_left_scaffold", x: 570, y: 440, tier: 3, next: ["tier4_left"] },
    { id: "tier3_center", x: 768, y: 420, tier: 3, next: ["tier4_left", "tier4_right"] },
    { id: "tier3_right_scaffold", x: 940, y: 450, tier: 3, next: ["tier4_right"] },

    // Tier 4 - Upper Mountain & Ladders
    { id: "tier4_left", x: 680, y: 310, tier: 4, next: ["tier5_subsummit"] },
    { id: "tier4_right", x: 860, y: 310, tier: 4, next: ["tier5_subsummit"] },

    // Tier 5 - Sub-summit High Ridge
    { id: "tier5_subsummit", x: 768, y: 220, tier: 5, next: ["summit"] },

    // Peak Summit (Victory Flag)
    { id: "summit", x: 768, y: 110, tier: 6, next: [] }
  ],

  // Mountain Ledges (horizontal ground surfaces where climbers walk or bombs land)
  MOUNTAIN_LEDGES: [
    // Base line
    { x1: 300, x2: 1240, y: 720, tier: 0 },
    // Tier 1
    { x1: 440, x2: 560, y: 640, tier: 1 },
    { x1: 630, x2: 900, y: 630, tier: 1 },
    { x1: 980, x2: 1100, y: 640, tier: 1 },
    // Tier 2
    { x1: 500, x2: 600, y: 550, tier: 2 },
    { x1: 660, x2: 870, y: 530, tier: 2 },
    { x1: 920, x2: 1020, y: 560, tier: 2 },
    // Tier 3
    { x1: 530, x2: 620, y: 440, tier: 3 },
    { x1: 710, x2: 830, y: 420, tier: 3 },
    { x1: 900, x2: 990, y: 450, tier: 3 },
    // Tier 4
    { x1: 640, x2: 740, y: 310, tier: 4 },
    { x1: 800, x2: 900, y: 310, tier: 4 },
    // Tier 5 & Summit
    { x1: 720, x2: 820, y: 220, tier: 5 },
    { x1: 740, x2: 796, y: 110, tier: 6 }
  ]
};
