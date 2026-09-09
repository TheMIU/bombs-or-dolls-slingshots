/**
 * js/bombs.js - Bomb Detonation Effects, Delayed Fuse Timers & Projectile Physics
 */

window.BombSystem = {
  /**
   * Update all flying projectiles and ticking bombs
   */
  update(dt) {
    this.updateProjectiles(dt);
    this.updateTickingBombs(dt);
  },

  /**
   * Physics loop for flying projectiles launched from slingshots
   */
  updateProjectiles(dt) {
    const state = window.GameState;
    const toRemove = [];

    for (let i = 0; i < state.projectiles.length; i++) {
      const p = state.projectiles[i];

      // Gravity & velocity
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.flightTime += dt;

      // Particle smoke trail
      p.trailTimer += dt;
      if (p.trailTimer > 0.035) {
        p.trailTimer = 0;
        const trailColor = p.player === 1 ? "rgba(56, 189, 248, 0.45)" : "rgba(251, 113, 133, 0.45)";
        state.addSmokeParticle(p.x, p.y, trailColor);
      }

      // Check boundary: off-screen
      if (p.x < -100 || p.x > window.GameConfig.CANVAS.WIDTH + 100 || p.y > window.GameConfig.CANVAS.HEIGHT + 50) {
        toRemove.push(p.id);
        continue;
      }

      // Check impact against mountain terrain
      const impact = window.MountainSystem.checkImpact(p.x, p.y, p.vy);
      if (impact.hit) {
        this.handleImpact(p, impact.x, impact.y);
        toRemove.push(p.id);
      }
    }

    if (toRemove.length > 0) {
      state.projectiles = state.projectiles.filter(p => !toRemove.includes(p.id));
    }
  },

  /**
   * Handle projectile hitting the mountain
   */
  handleImpact(proj, hitX, hitY) {
    const card = proj.card;
    const player = proj.player;

    // 1. If it's a Hiker, spawn climber on the mountain
    if (card.kind === "hiker") {
      window.UnitSystem.spawnHiker(player, card, hitX, hitY);
      return;
    }

    // 2. If it's a Bomb
    if (card.kind === "bomb") {
      if (card.id === "timer") {
        // Place ticking bomb on ledge
        window.GameState.bombs.push({
          id: window.GameState.getNextId(),
          player: player,
          card: card,
          x: hitX,
          y: hitY,
          fuseTimer: card.fuseSec || 3.0,
          totalFuse: card.fuseSec || 3.0,
          tickTimer: 0
        });
        window.GameState.addFloatingText(hitX, hitY, "ARMED! ⏱️", "#ef4444");
        window.SoundFX.playTick();
      } else {
        // Instant detonation on impact (Basic, Area, Shock)
        this.detonateBomb(player, card, hitX, hitY);
      }
    }
  },

  /**
   * Update active ticking bombs on ledges
   */
  updateTickingBombs(dt) {
    const state = window.GameState;
    const toRemove = [];

    for (let i = 0; i < state.bombs.length; i++) {
      const bomb = state.bombs[i];
      bomb.fuseTimer -= dt;
      bomb.tickTimer += dt;

      // Audible beep every second
      if (bomb.tickTimer >= 0.8) {
        bomb.tickTimer = 0;
        window.SoundFX.playTick();
      }

      if (bomb.fuseTimer <= 0) {
        this.detonateBomb(bomb.player, bomb.card, bomb.x, bomb.y);
        toRemove.push(bomb.id);
      }
    }

    if (toRemove.length > 0) {
      state.bombs = state.bombs.filter(b => !toRemove.includes(b.id));
    }
  },

  /**
   * Execute bomb detonation effect and damage enemy climbers in radius
   */
  detonateBomb(player, card, x, y) {
    const state = window.GameState;
    const radius = card.blastRadius || 100;
    const damage = card.damage || 75;

    // Visual Explosion Particles
    const isShock = card.id === "shock";
    const particleColor = isShock ? "#38bdf8" : (card.id === "timer" ? "#ef4444" : "#f97316");
    state.addExplosionParticles(x, y, particleColor, isShock ? 32 : 45);

    // Sound FX
    if (isShock) {
      window.SoundFX.playShock();
    } else {
      window.SoundFX.playExplosion(card.id === "timer" || card.id === "area");
    }

    // Floating text
    const blastMsg = isShock ? "⚡ EMP SHOCK!" : (card.id === "timer" ? "💥 BOOM!" : "💥 BLAST!");
    state.addFloatingText(x, y, blastMsg, particleColor, 22);

    // Affect enemy climbers in radius
    const enemies = state.units.filter(u => {
      if (u.player === player || u.hp <= 0) return false;
      return Math.hypot(u.x - x, u.y - y) <= radius;
    });

    enemies.forEach(u => {
      let dmg = damage;

      // Sumo Heavy Armor: cannot be killed in a single bomb shot from full health
      if (u.card.id === "sumo" && u.hp === u.maxHp && dmg >= u.hp) {
        dmg = u.hp - 25;
      }

      u.hp -= dmg;
      const dmgText = (u.card.id === "sumo" && u.hp > 0) ? `-${dmg} (SUMO TANK!)` : `-${dmg}`;
      state.addFloatingText(u.x, u.y, dmgText, "#ef4444");

      // Electric Shock freezes enemy climbers
      if (isShock && card.stunDurationSec) {
        u.stunTimer = Math.max(u.stunTimer, card.stunDurationSec);
        state.addFloatingText(u.x, u.y - 18, "FROZEN! ❄️", "#38bdf8");
      }
    });
  }
};
