/**
 * js/mountain.js - Mountain Terrain, Ledges, Waypoint Pathfinding & Collision
 */

window.MountainSystem = {
  /**
   * Check if a flying projectile at (x, y) has hit any mountain terrain or ledge
   */
  checkImpact(x, y, vy) {
    const ledges = window.GameConfig.MOUNTAIN_LEDGES;
    const peak = window.GameConfig.SUMMIT_PEAK;

    // 1. Check Peak Flag impact
    const distToPeak = Math.hypot(x - peak.x, y - peak.y);
    if (distToPeak < peak.radius) {
      return { hit: true, type: "peak", x: peak.x, y: peak.y, tier: 6 };
    }

    // 2. Check Horizontal Ledges (projectile falling downwards vy > 0 or horizontal)
    for (const ledge of ledges) {
      if (x >= ledge.x1 && x <= ledge.x2) {
        if (Math.abs(y - ledge.y) < 14 && vy >= -50) {
          return { hit: true, type: "ledge", x: x, y: ledge.y, tier: ledge.tier };
        }
      }
    }

    // 3. Check Central Mountain rocky boundary (rough mountain silhouette)
    // Mountain gets wider from peak (y=110, half-width=50) down to base (y=720, half-width=480)
    if (y >= 110 && y <= 730) {
      const progress = (y - 110) / (720 - 110);
      const halfWidth = 60 + progress * 420;
      const mountainCenterX = 768;

      if (x >= mountainCenterX - halfWidth && x <= mountainCenterX + halfWidth) {
        // Projectile entered rocky mountain body
        if (vy > 0) {
          const nearestLedge = this.findNearestLedge(x, y);
          return { hit: true, type: "mountain", x: x, y: nearestLedge ? nearestLedge.y : y, tier: nearestLedge ? nearestLedge.tier : 1 };
        }
      }
    }

    // 4. Ground floor boundary (bottom valley)
    if (y >= 740) {
      return { hit: true, type: "ground", x: x, y: 720, tier: 0 };
    }

    return { hit: false };
  },

  /**
   * Find nearest horizontal ledge to a point
   */
  findNearestLedge(x, y) {
    let best = null;
    let minDist = Infinity;

    for (const ledge of window.GameConfig.MOUNTAIN_LEDGES) {
      // Clamp x to ledge segment
      const clampedX = Math.max(ledge.x1, Math.min(ledge.x2, x));
      const dist = Math.hypot(x - clampedX, y - ledge.y);
      if (dist < minDist) {
        minDist = dist;
        best = { ...ledge, x: clampedX };
      }
    }
    return best;
  },

  /**
   * Find the closest waypoint to start climbing from after landing
   */
  findNearestWaypoint(x, y) {
    const waypoints = window.GameConfig.MOUNTAIN_WAYPOINTS;
    let best = waypoints[0];
    let minDist = Infinity;

    for (const wp of waypoints) {
      const dist = Math.hypot(x - wp.x, y - wp.y);
      if (dist < minDist) {
        minDist = dist;
        best = wp;
      }
    }
    return best;
  },

  /**
   * Get waypoint object by id
   */
  getWaypoint(id) {
    return window.GameConfig.MOUNTAIN_WAYPOINTS.find(w => w.id === id) || null;
  },

  /**
   * Get next waypoint towards the summit peak
   */
  getNextWaypoint(currentWpId) {
    const current = this.getWaypoint(currentWpId);
    if (!current || !current.next || current.next.length === 0) {
      return null;
    }

    // If multiple branch choices, randomly select one or choose closest
    const nextId = current.next[Math.floor(Math.random() * current.next.length)];
    return this.getWaypoint(nextId);
  }
};
