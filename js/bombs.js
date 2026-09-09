/**
 * js/bombs.js - Bomb Detonation Effects, Fuse Timers & Area Blast Logic
 */

window.BombSystem = {
  update(dt) {
    this.updateProjectiles(dt);
    this.updateTickingBombs(dt);
  },

  updateProjectiles(dt) {
    const state = window.GameState;
    const toRemove = [];

    for (let i = 0; i < state.projectiles.length; i++) {
      const p = state.projectiles[i];

      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.flightTime += dt;

      p.trailTimer += dt;
      if (p.trailTimer > 0.03) {
        p.trailTimer = 0;
        const trailColor = p.player === 1 ? "rgba(56, 189, 248, 0.45)" : "rgba(251, 113, 133, 0.45)";
        state.addSmokeParticle(p.x, p.y, trailColor);
      }

      // Check boundary
      if (p.x < -150 || p.x > window.GameConfig.CANVAS.WIDTH + 150 || p.y > window.GameConfig.CANVAS.HEIGHT + 50) {
        toRemove.push(p.id);
        continue;
      }

      // Check target destination arrival
      if (p.targetCol !== undefined && p.targetRow !== undefined && p.maxFlightTime) {
        const reachedTarget = p.flightTime >= p.maxFlightTime ||
          (p.vy > 0 && Math.hypot(p.x - p.targetX, p.y - p.targetY) < 36) ||
          (p.vy > 0 && p.y >= p.targetY && Math.abs(p.x - p.targetX) < 55);

        if (reachedTarget) {
          this.handleImpact(p, p.targetCol, p.targetRow, p.targetX, p.targetY);
          toRemove.push(p.id);
          continue;
        }
      } else {
        // Fallback impact check against mountain grid
        const impact = window.MountainSystem.checkImpact(p.x, p.y, p.vy, p.card.kind);
        if (impact.hit) {
          this.handleImpact(p, impact.col, impact.row, impact.x, impact.y);
          toRemove.push(p.id);
          continue;
        }
      }
    }

    if (toRemove.length > 0) {
      state.projectiles = state.projectiles.filter(p => !toRemove.includes(p.id));
    }
  },

  handleImpact(proj, col, row, px, py) {
    const card = proj.card;
    const player = proj.player;

    if (card.kind === "hiker") {
      window.UnitSystem.spawnHiker(player, card, col, row);
      return;
    }

    if (card.kind === "bomb") {
      if (card.id === "timer") {
        window.GameState.bombs.push({
          id: window.GameState.getNextId(),
          player: player,
          card: card,
          x: col,
          y: row,
          renderX: px,
          renderY: py,
          fuseTimer: card.fuseSec || 3.5,
          totalFuse: card.fuseSec || 3.5,
          tickTimer: 0
        });
        window.GameState.addFloatingText(px, py, "ARMED! ⏱️", "#ef4444");
        window.SoundFX.playTick();
      } else {
        this.detonateBomb(player, card, col, row, px, py);
      }
    }
  },

  updateTickingBombs(dt) {
    const state = window.GameState;
    const toRemove = [];

    for (let i = 0; i < state.bombs.length; i++) {
      const bomb = state.bombs[i];
      bomb.fuseTimer -= dt;
      bomb.tickTimer += dt;

      if (bomb.tickTimer >= 0.8) {
        bomb.tickTimer = 0;
        window.SoundFX.playTick();
      }

      if (bomb.fuseTimer <= 0) {
        this.detonateBomb(bomb.player, bomb.card, bomb.x, bomb.y, bomb.renderX, bomb.renderY);
        toRemove.push(bomb.id);
      }
    }

    if (toRemove.length > 0) {
      state.bombs = state.bombs.filter(b => !toRemove.includes(b.id));
    }
  },

  detonateBomb(player, card, col, row, px, py) {
    const state = window.GameState;
    const damage = card.damage || 80;
    const isShock = card.id === "shock";
    const cellRadius = card.id === "area" || card.id === "timer" || card.id === "shock" ? 1 : 0;

    const particleColor = isShock ? "#38bdf8" : (card.id === "timer" ? "#ef4444" : "#f97316");
    state.addExplosionParticles(px, py, particleColor, isShock ? 35 : 45);

    if (isShock) {
      window.SoundFX.playShock();
    } else {
      window.SoundFX.playExplosion(card.id === "timer" || card.id === "area");
    }

    const blastMsg = isShock ? "⚡ EMP SHOCK!" : (card.id === "timer" ? "💥 BOOM!" : "💥 BLAST!");
    state.addFloatingText(px, py, blastMsg, particleColor, 22);

    // Find enemies in grid radius
    const enemies = state.units.filter(u => {
      if (u.player === player || u.hp <= 0) return false;
      const dx = Math.abs(u.x - col);
      const dy = Math.abs(u.y - row);
      return dx <= cellRadius && dy <= cellRadius;
    });

    enemies.forEach(u => {
      let dmg = damage;
      if (u.card.id === "sumo" && u.hp === u.maxHp && dmg >= u.hp) {
        dmg = u.hp - 20; // Sumo survives one-shot bomb
      }

      u.hp -= dmg;
      const dmgText = (u.card.id === "sumo" && u.hp > 0) ? `-${dmg} (SUMO TANK!)` : `-${dmg}`;
      state.addFloatingText(u.renderX, u.renderY, dmgText, "#ef4444");

      if (isShock && card.stunDurationSec) {
        u.stunTimer = Math.max(u.stunTimer, card.stunDurationSec);
        state.addFloatingText(u.renderX, u.renderY - 18, "FROZEN! ❄️", "#38bdf8");
      }
    });
  }
};
