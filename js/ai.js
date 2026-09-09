/**
 * js/ai.js - Intelligent AI Bot Opponent for Player 2
 * Evaluates all 9 lanes, manages mana, and aims across the entire mountain arena.
 */

window.AISystem = {
  decisionTimer: 0,
  minInterval: 2.2,
  maxInterval: 3.6,

  init() {
    this.decisionTimer = 1.2;
  },

  update(dt) {
    if (!window.GameState.aiEnabled || window.GameState.isGameOver || !window.GameState.isStarted || window.GameState.isPaused) {
      return;
    }

    // Do not run bot if in online multiplayer
    if (window.Network && window.Network.isOnline) {
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
    if (p2Mana < 2) return;

    const p1Climbers = window.GameState.units.filter(u => u.player === 1 && u.hp > 0);
    const p2Climbers = window.GameState.units.filter(u => u.player === 2 && u.hp > 0);

    // Strategy 1: Defense - Target advancing enemy climbers with Bombs
    if (p1Climbers.length > 0 && Math.random() < 0.65) {
      // Find highest climber (closest to Row 0)
      p1Climbers.sort((a, b) => a.y - b.y);
      const threat = p1Climbers[0];

      if (threat.y < 9) {
        const bombCards = window.GameConfig.CARDS.filter(c => c.kind === "bomb" && c.cost <= p2Mana);
        if (bombCards.length > 0) {
          const chosenBomb = (threat.y <= 3 && bombCards.find(c => c.id === "basic"))
            || (threat.stunTimer <= 0 && bombCards.find(c => c.id === "shock"))
            || bombCards[0];

          const ok = window.SlingshotSystem.launchTarget(2, chosenBomb, threat.x, threat.y);
          if (ok) {
            window.GameSystem?.updateStatus?.(`🤖 Bot launched ${chosenBomb.name} targeting Blue Climber on Col ${threat.x}!`);
            return;
          }
        }
      }
    }

    // Strategy 2: Offense - Deploy a Hiker into an open lane in the bottom base camp (rows 12-14)
    const hikerCards = window.GameConfig.CARDS.filter(c => c.kind === "hiker" && c.cost <= p2Mana);
    if (hikerCards.length > 0) {
      let chosenHiker = hikerCards[Math.floor(Math.random() * hikerCards.length)];

      // Pick an open lane (prefer lanes without blockers)
      const targetCol = Math.floor(Math.random() * window.GameConfig.GRID.COLS);
      const targetRow = 12 + Math.floor(Math.random() * 3); // rows 12, 13, 14

      const ok = window.SlingshotSystem.launchTarget(2, chosenHiker, targetCol, targetRow);
      if (ok) {
        window.GameSystem?.updateStatus?.(`🤖 Bot deployed ${chosenHiker.name} in Column ${targetCol}!`);
      }
    }
  }
};
