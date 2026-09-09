/**
 * js/units.js - Hiker Unit Spawning, Mountain Climbing, Combat, and Healing Logic
 */

window.UnitSystem = {
  /**
   * Spawn a new hiker upon projectile landing
   */
  spawnHiker(player, card, landX, landY) {
    const nearestWp = window.MountainSystem.findNearestWaypoint(landX, landY);
    const targetWp = window.MountainSystem.getNextWaypoint(nearestWp.id) || nearestWp;

    const hiker = {
      id: window.GameState.getNextId(),
      player: player,
      card: card,
      x: landX,
      y: landY,
      targetWaypoint: targetWp,
      hp: card.hp,
      maxHp: card.maxHp,
      climbSpeed: card.climbSpeed,
      stunTimer: 0,
      actionCooldown: 0,
      isBlocked: false
    };

    window.GameState.units.push(hiker);
    window.GameState.addFloatingText(landX, landY, "CLIMB! ⛰️", player === 1 ? "#38bdf8" : "#fb7185");
    window.SoundFX.playLand();
    return hiker;
  },

  /**
   * Main real-time update loop for all climbers
   */
  update(dt, now) {
    const state = window.GameState;
    const peak = window.GameConfig.SUMMIT_PEAK;

    for (let i = 0; i < state.units.length; i++) {
      const u = state.units[i];
      if (u.hp <= 0) continue;

      // 1. Check Stun Timer
      if (u.stunTimer > 0) {
        u.stunTimer -= dt;
        continue; // Stunned climbers cannot move or act
      }

      // 2. Role Special Abilities (Attack / Heal)
      this.handleRoleAbilities(u, dt);

      // 3. Check Collision / Blocker
      u.isBlocked = this.checkIfBlocked(u);
      if (u.isBlocked) {
        continue;
      }

      // 4. Movement along Mountain Climbing Waypoints
      this.handleMovement(u, dt);

      // 5. Check Summit Peak Arrival
      const distToPeak = Math.hypot(u.x - peak.x, u.y - peak.y);
      if (distToPeak < peak.radius) {
        window.GameSystem?.triggerVictory?.(u.player, u);
        return;
      }
    }

    // Clean up defeated units
    state.units = state.units.filter(u => u.hp > 0);
  },

  /**
   * Check if an enemy Sumo or blocker is obstructing this hiker
   */
  checkIfBlocked(hiker) {
    const units = window.GameState.units;
    for (const other of units) {
      if (other.id === hiker.id || other.hp <= 0 || other.player === hiker.player) continue;

      // Check distance
      const dist = Math.hypot(other.x - hiker.x, other.y - hiker.y);
      if (dist < 40) {
        // If other unit is Sumo, this hiker is blocked
        if (other.card.isBlocker) {
          return true;
        }
      }
    }
    return false;
  },

  /**
   * Move hiker towards its current target waypoint
   */
  handleMovement(u, dt) {
    if (!u.targetWaypoint) return;

    const dx = u.targetWaypoint.x - u.x;
    const dy = u.targetWaypoint.y - u.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 12) {
      // Arrived at current waypoint -> get next one up the mountain
      const next = window.MountainSystem.getNextWaypoint(u.targetWaypoint.id);
      if (next) {
        u.targetWaypoint = next;
      }
    } else {
      // Step towards waypoint
      const step = u.climbSpeed * dt;
      u.x += (dx / dist) * step;
      u.y += (dy / dist) * step;
    }
  },

  /**
   * Knight Melee Slash and Doctor Healing Aura
   */
  handleRoleAbilities(u, dt) {
    if (u.actionCooldown > 0) {
      u.actionCooldown -= dt;
    }

    // 1. Knight: Melee Sword Slash
    if (u.card.attackDamage && u.actionCooldown <= 0) {
      const enemies = window.GameState.units.filter(other => {
        if (other.player === u.player || other.hp <= 0) return false;
        return Math.hypot(other.x - u.x, other.y - u.y) <= u.card.attackRange;
      });

      if (enemies.length > 0) {
        // Target lowest HP enemy
        enemies.sort((a, b) => a.hp - b.hp);
        const target = enemies[0];
        target.hp -= u.card.attackDamage;
        u.actionCooldown = u.card.attackCooldownSec;

        window.GameState.addFloatingText(target.x, target.y, `-${u.card.attackDamage}⚔️`, "#ef4444");
        window.GameState.addExplosionParticles(target.x, target.y, "#94a3b8", 8);
        window.SoundFX.playSlash();
      }
    }

    // 2. Doctor: Healing Aura
    if (u.card.healAmount && u.actionCooldown <= 0) {
      const woundedAllies = window.GameState.units.filter(other => {
        if (other.player !== u.player || other.hp <= 0 || other.hp >= other.maxHp) return false;
        return Math.hypot(other.x - u.x, other.y - u.y) <= u.card.healRange;
      });

      if (woundedAllies.length > 0) {
        woundedAllies.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
        const target = woundedAllies[0];
        const healed = Math.min(u.card.healAmount, target.maxHp - target.hp);
        target.hp += healed;
        u.actionCooldown = u.card.healCooldownSec;

        window.GameState.addFloatingText(target.x, target.y, `+${healed}❤️`, "#22c55e");
        window.SoundFX.playHeal();
      }
    }
  }
};
