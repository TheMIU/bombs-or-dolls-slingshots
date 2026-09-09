/**
 * js/ai.js - Intelligent AI Bot Opponent for Player 2
 * Evaluates mountain state, manages mana, aims right slingshot, and launches counters.
 */

window.AISystem = {
  decisionTimer: 0,
  minInterval: 2.2, // seconds between decisions
  maxInterval: 3.8,

  init() {
    this.decisionTimer = 1.5;
  },

  update(dt) {
    if (!window.GameState.aiEnabled || window.GameState.isGameOver || !window.GameState.isStarted || window.GameState.isPaused) {
      return;
    }

    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      this.decisionTimer = this.minInterval + Math.random() * (this.maxInterval - this.minInterval);
      this.makeMove();
    }
  },

  makeMove() {
    const p2Mana = window.GameState.mana[1];
    if (p2Mana < 2) return; // Need at least 2 mana to launch anything

    const p1Climbers = window.GameState.units.filter(u => u.player === 1 && u.hp > 0);
    const p2Climbers = window.GameState.units.filter(u => u.player === 2 && u.hp > 0);

    // Strategy 1: Defense - If P1 has a climber that is high up the mountain (y < 420), target with a Bomb!
    if (p1Climbers.length > 0 && Math.random() < 0.65) {
      // Find highest P1 climber
      p1Climbers.sort((a, b) => a.y - b.y);
      const threat = p1Climbers[0];

      if (threat.y < 500) {
        // Choose bomb
        const bombCards = window.GameConfig.CARDS.filter(c => c.kind === "bomb" && c.cost <= p2Mana);
        if (bombCards.length > 0) {
          // Prefer Shock if not stunned, otherwise Basic or Area
          let chosenBomb = bombCards.find(c => c.id === "shock") || bombCards[0];
          // Slight aim imperfection for realistic human-like feel
          const aimX = threat.x + (Math.random() * 30 - 15);
          const aimY = threat.y + (Math.random() * 20 - 10);

          const ok = window.SlingshotSystem.launchAI(2, chosenBomb, aimX, aimY);
          if (ok) {
            window.GameSystem?.updateStatus?.(`🤖 Bot launched ${chosenBomb.name} targeting Blue Climber!`);
            return;
          }
        }
      }
    }

    // Strategy 2: Offense - Deploy a Hiker (Scout, Knight, Sumo, Doctor)
    const hikerCards = window.GameConfig.CARDS.filter(c => c.kind === "hiker" && c.cost <= p2Mana);
    if (hikerCards.length > 0) {
      // Choose based on current team comp
      let chosenHiker;
      if (p2Climbers.length === 0) {
        // Open with Scout or Knight
        chosenHiker = hikerCards.find(c => c.id === "scout") || hikerCards[0];
      } else {
        // Randomly choose from affordable hikers
        chosenHiker = hikerCards[Math.floor(Math.random() * hikerCards.length)];
      }

      // Aim at one of the mountain ledges or base camp
      const targetLedges = [
        { x: 1040, y: 640 }, // Tier 1 Right
        { x: 970, y: 560 },  // Tier 2 Right
        { x: 860, y: 630 },  // Tier 1 Mid Right
        { x: 820, y: 530 }   // Tier 2 Mid Right
      ];
      const target = targetLedges[Math.floor(Math.random() * targetLedges.length)];
      const aimX = target.x + (Math.random() * 20 - 10);
      const aimY = target.y + (Math.random() * 15 - 5);

      const ok = window.SlingshotSystem.launchAI(2, chosenHiker, aimX, aimY);
      if (ok) {
        window.GameSystem?.updateStatus?.(`🤖 Bot launched ${chosenHiker.name} up the mountain!`);
      }
    }
  }
};
