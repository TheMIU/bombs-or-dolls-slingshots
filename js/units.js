/**
 * js/units.js - Hiker Unit Logic, Climbing, Sumo Blocker, Combat, and Summit Flag Claims
 */

window.UnitSystem = {
  spawnHiker(player, card, col, row) {
    const pos = window.MountainSystem.gridToPixel(col, row);

    const hiker = {
      id: window.GameState.getNextId(),
      player: player,
      card: card,
      x: col,
      y: row,
      renderX: pos.x,
      renderY: pos.y,
      hp: card.hp,
      maxHp: card.maxHp,
      stepTimer: 0,
      stunTimer: 0,
      actionCooldown: 0,
      isBlocked: false
    };

    window.GameState.units.push(hiker);
    window.GameState.addFloatingText(pos.x, pos.y, "CLIMB! ⛰️", player === 1 ? "#38bdf8" : "#fb7185");
    window.SoundFX.playLand();
    return hiker;
  },

  update(dt) {
    const state = window.GameState;
    const peakRow = window.GameConfig.ARENA.peakRow;

    for (let i = 0; i < state.units.length; i++) {
      const u = state.units[i];
      if (u.hp <= 0) continue;

      // 1. Stunned check
      if (u.stunTimer > 0) {
        u.stunTimer -= dt;
        continue;
      }

      // 2. Role Abilities
      this.handleRoleAbilities(u, dt);

      // 3. Movement Step (Bottom to Top)
      this.handleMovement(u, dt);

      // 4. Smooth visual render coordinate lerp
      const targetPos = window.MountainSystem.gridToPixel(u.x, u.y);
      u.renderX += (targetPos.x - u.renderX) * Math.min(1, dt * 12);
      u.renderY += (targetPos.y - u.renderY) * Math.min(1, dt * 12);

      // 5. Reached Summit Peak (Row 0)
      if (u.y <= peakRow) {
        window.GameSystem?.claimSummitFlag?.(u.player, u);
        u.hp = 0; // Finishes climbing
        window.GameState.addFloatingText(u.renderX, u.renderY, "SUMMIT! 🚩", u.player === 1 ? "#38bdf8" : "#fb7185");
        window.GameState.addExplosionParticles(u.renderX, u.renderY, u.player === 1 ? "#38bdf8" : "#f43f5e");
      }
    }

    state.units = state.units.filter(u => u.hp > 0);
  },

  handleRoleAbilities(unit, dt) {
    if (unit.actionCooldown > 0) {
      unit.actionCooldown -= dt;
    }

    // Knight: Melee attack
    if (unit.card.attackDamage && unit.actionCooldown <= 0) {
      const enemies = window.GameState.getUnitsInRadius(unit.x, unit.y, unit.card.attackRange || 1)
        .filter(t => t.player !== unit.player && t.hp > 0);

      if (enemies.length > 0) {
        enemies.sort((a, b) => a.hp - b.hp);
        const target = enemies[0];
        target.hp -= unit.card.attackDamage;
        unit.actionCooldown = unit.card.attackCooldownSec;

        window.GameState.addFloatingText(target.renderX, target.renderY, `-${unit.card.attackDamage}⚔️`, "#ef4444");
        window.GameState.addExplosionParticles(target.renderX, target.renderY, "#94a3b8", 8);
        window.SoundFX.playSlash();
      }
    }

    // Doctor: Healing aura
    if (unit.card.healAmount && unit.actionCooldown <= 0) {
      const allies = window.GameState.getUnitsInRadius(unit.x, unit.y, unit.card.healRange || 1)
        .filter(a => a.player === unit.player && a.hp < a.maxHp && a.hp > 0);

      if (allies.length > 0) {
        allies.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
        const target = allies[0];
        const healed = Math.min(unit.card.healAmount, target.maxHp - target.hp);
        target.hp += healed;
        unit.actionCooldown = unit.card.healCooldownSec;

        window.GameState.addFloatingText(target.renderX, target.renderY, `+${healed}❤️`, "#22c55e");
        window.SoundFX.playHeal();
      }
    }
  },

  handleMovement(unit, dt) {
    unit.stepTimer += dt;
    if (unit.stepTimer < unit.card.stepIntervalSec) return;

    const climbDir = window.GameConfig.ARENA.climbDirection; // -1 (upward)
    const targetY = unit.y + climbDir;
    if (targetY < 0) return;

    const targetOccupant = window.GameState.getUnitAt(unit.x, targetY);

    if (targetOccupant) {
      // Friendly unit ahead -> try side dodge or wait
      if (targetOccupant.player === unit.player) {
        const sideDodge = this.trySideDodge(unit, targetY);
        if (sideDodge) {
          unit.x = sideDodge.x;
          unit.y = sideDodge.y;
          unit.stepTimer = 0;
        }
        return;
      }

      // Sumo Hiker blocks enemy from advancing!
      if (targetOccupant.card.isBlocker) {
        unit.isBlocked = true;
        unit.stepTimer = 0;
        return;
      }
    }

    unit.isBlocked = false;
    unit.y = targetY;
    unit.stepTimer = 0;
  },

  trySideDodge(unit, targetY) {
    const cols = [unit.x - 1, unit.x + 1].filter(c => c >= 0 && c < window.GameConfig.GRID.COLS);
    cols.sort(() => Math.random() - 0.5);

    for (const c of cols) {
      if (!window.GameState.isCellBlocked(c, targetY, unit.player)) {
        return { x: c, y: targetY };
      }
      if (!window.GameState.isCellBlocked(c, unit.y, unit.player)) {
        return { x: c, y: unit.y };
      }
    }
    return null;
  }
};
