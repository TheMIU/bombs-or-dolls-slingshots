/**
 * js/slingshot.js - Interactive Slingshot Physics, Rubber Bands & Trajectory Engine
 */

window.SlingshotSystem = {
  // Drag state for human players:
  // player: 1 | 2 | null
  activePlayer: null,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  currentDragX: 0,
  currentDragY: 0,
  pullVector: { x: 0, y: 0 },
  pullDistance: 0,

  // Slingshot wobble animation after release
  wobble: [
    { amp: 0, angle: 0, decay: 0.9 }, // P1
    { amp: 0, angle: 0, decay: 0.9 }  // P2
  ],

  init() {
    this.bindEvents();
  },

  /**
   * Bind mouse & touch events to the canvas container
   */
  bindEvents() {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;

    // Convert mouse/touch coordinates to 1536x1024 virtual canvas space
    const getCanvasPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = window.GameConfig.CANVAS.WIDTH / rect.width;
      const scaleY = window.GameConfig.CANVAS.HEIGHT / rect.height;

      const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    // Pointer down: Check if touching left slingshot or right slingshot
    const handleDown = (e) => {
      if (window.GameState.isGameOver || window.GameState.isPaused || !window.GameState.isStarted) return;

      const pos = getCanvasPos(e);
      const cfgP1 = window.GameConfig.SLINGSHOTS.P1;
      const cfgP2 = window.GameConfig.SLINGSHOTS.P2;

      const distP1 = Math.hypot(pos.x - cfgP1.restX, pos.y - cfgP1.restY);
      const distP2 = Math.hypot(pos.x - cfgP2.restX, pos.y - cfgP2.restY);

      // 1. Check Player 1 (Left Slingshot) - touch radius 130px around slingshot
      if (distP1 < 130) {
        // If no card loaded, auto-select first affordable card
        if (!window.GameState.loadedCard[0]) {
          window.GameSystem?.autoSelectCard?.(1);
        }

        if (window.GameState.loadedCard[0]) {
          this.activePlayer = 1;
          this.isDragging = true;
          this.dragStartX = cfgP1.restX;
          this.dragStartY = cfgP1.restY;
          this.currentDragX = pos.x;
          this.currentDragY = pos.y;
          this.updatePull(1);
          window.SoundFX.playStretch(0.3);
          e.preventDefault();
        }
      }
      // 2. Check Player 2 (Right Slingshot) - if AI is disabled (2-Player local)
      else if (distP2 < 130 && !window.GameState.aiEnabled) {
        if (!window.GameState.loadedCard[1]) {
          window.GameSystem?.autoSelectCard?.(2);
        }

        if (window.GameState.loadedCard[1]) {
          this.activePlayer = 2;
          this.isDragging = true;
          this.dragStartX = cfgP2.restX;
          this.dragStartY = cfgP2.restY;
          this.currentDragX = pos.x;
          this.currentDragY = pos.y;
          this.updatePull(2);
          window.SoundFX.playStretch(0.3);
          e.preventDefault();
        }
      }
    };

    // Pointer move: update pull distance and trajectory
    const handleMove = (e) => {
      if (!this.isDragging || !this.activePlayer) return;

      const pos = getCanvasPos(e);
      this.currentDragX = pos.x;
      this.currentDragY = pos.y;
      this.updatePull(this.activePlayer);
      e.preventDefault();
    };

    // Pointer up: release and launch!
    const handleUp = (e) => {
      if (!this.isDragging || !this.activePlayer) return;
      this.release(this.activePlayer);
      this.isDragging = false;
      this.activePlayer = null;
    };

    canvas.addEventListener("mousedown", handleDown);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    canvas.addEventListener("touchstart", handleDown, { passive: false });
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
  },

  /**
   * Calculate pull vector clamped to maxPull radius
   */
  updatePull(player) {
    const cfg = player === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
    let dx = this.currentDragX - cfg.restX;
    let dy = this.currentDragY - cfg.restY;

    // For Player 1 (left slingshot), you pull DOWN and LEFT to aim up and right towards the mountain
    // For Player 2 (right slingshot), you pull DOWN and RIGHT to aim up and left towards the mountain
    let dist = Math.hypot(dx, dy);

    if (dist > cfg.maxPull) {
      dx = (dx / dist) * cfg.maxPull;
      dy = (dy / dist) * cfg.maxPull;
      dist = cfg.maxPull;
    }

    this.pullVector = { x: dx, y: dy };
    this.pullDistance = dist;

    // Trigger stretch sound periodically when pulling
    if (Math.random() < 0.25) {
      window.SoundFX.playStretch(dist / cfg.maxPull);
    }
  },

  /**
   * Release slingshot and launch loaded projectile
   */
  release(player) {
    const card = window.GameState.loadedCard[player - 1];
    if (!card) return;

    const cfg = player === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
    const dist = this.pullDistance;

    // Minimum pull threshold to avoid accidental click-launches
    if (dist < 15) {
      return;
    }

    // Check mana
    const currentMana = window.GameState.mana[player - 1];
    if (currentMana < card.cost) {
      window.GameSystem?.updateStatus?.(`Player ${player}: Not enough mana! (${card.cost} needed)`);
      return;
    }

    // Deduct mana
    window.GameState.mana[player - 1] -= card.cost;

    // Compute launch velocity: opposite of pull vector multiplied by launch speed
    const vx = -this.pullVector.x * cfg.launchSpeedMultiplier;
    const vy = -this.pullVector.y * cfg.launchSpeedMultiplier;

    // Spawn flying projectile
    window.GameState.projectiles.push({
      id: window.GameState.getNextId(),
      player: player,
      card: card,
      x: cfg.restX + this.pullVector.x,
      y: cfg.restY + this.pullVector.y,
      vx: vx,
      vy: vy,
      gravity: window.GameConfig.CANVAS.GRAVITY,
      flightTime: 0,
      trailTimer: 0
    });

    // Sound FX: Slingshot snap/twang
    window.SoundFX.playRelease();

    // Trigger slingshot wobble
    this.wobble[player - 1].amp = 18;

    // Clear loaded card
    window.GameState.loadedCard[player - 1] = null;
    window.GameSystem?.updateCardsUI?.();
    window.GameSystem?.updateStatus?.(`Player ${player} launched ${card.name}!`);
  },

  /**
   * Trigger launch programmatically (e.g. for AI Bot on Player 2)
   */
  launchAI(player, card, targetX, targetY) {
    const cfg = player === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;

    // Check mana
    if (window.GameState.mana[player - 1] < card.cost) return false;
    window.GameState.mana[player - 1] -= card.cost;

    // Compute ballistic velocity to hit (targetX, targetY)
    const g = window.GameConfig.CANVAS.GRAVITY;
    const dx = targetX - cfg.restX;
    const dy = targetY - cfg.restY;

    // Flight time estimated based on horizontal distance
    const flightTime = Math.max(0.65, Math.min(1.4, Math.abs(dx) / 600));
    const vx = dx / flightTime;
    const vy = (dy - 0.5 * g * flightTime * flightTime) / flightTime;

    window.GameState.projectiles.push({
      id: window.GameState.getNextId(),
      player: player,
      card: card,
      x: cfg.restX,
      y: cfg.restY,
      vx: vx,
      vy: vy,
      gravity: g,
      flightTime: 0,
      trailTimer: 0
    });

    window.SoundFX.playRelease();
    this.wobble[player - 1].amp = 18;
    return true;
  },

  /**
   * Update slingshots wobble animation
   */
  update(dt) {
    for (let p = 0; p < 2; p++) {
      if (this.wobble[p].amp > 0.1) {
        this.wobble[p].amp *= Math.pow(0.05, dt);
        this.wobble[p].angle += dt * 35;
      } else {
        this.wobble[p].amp = 0;
      }
    }
  },

  /**
   * Render Slingshots, Rubber Bands, Loaded Ammo, and Trajectory on Canvas
   */
  render(ctx) {
    [1, 2].forEach(p => {
      const cfg = p === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
      const isCurrentDrag = this.isDragging && this.activePlayer === p;

      // Pouch position: pulled if dragging, otherwise at rest (with wobble)
      let pouchX = cfg.restX;
      let pouchY = cfg.restY;

      if (isCurrentDrag) {
        pouchX += this.pullVector.x;
        pouchY += this.pullVector.y;
      } else if (this.wobble[p - 1].amp > 0.1) {
        pouchX += Math.sin(this.wobble[p - 1].angle) * this.wobble[p - 1].amp;
      }

      // 1. Draw Dual Rubber Bands (Back band first, then ammo, then front band)
      ctx.save();
      ctx.lineWidth = 6;
      ctx.strokeStyle = cfg.bandColor;
      ctx.lineCap = "round";

      // Left Band
      ctx.beginPath();
      ctx.moveTo(cfg.prongLeft.x, cfg.prongLeft.y);
      ctx.lineTo(pouchX - 6, pouchY);
      ctx.stroke();

      // Right Band
      ctx.beginPath();
      ctx.moveTo(cfg.prongRight.x, cfg.prongRight.y);
      ctx.lineTo(pouchX + 6, pouchY);
      ctx.stroke();

      // 2. Draw Leather Pouch
      ctx.fillStyle = cfg.pouchColor;
      ctx.beginPath();
      ctx.roundRect(pouchX - 14, pouchY - 10, 28, 20, 6);
      ctx.fill();
      ctx.strokeStyle = "#292524";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 3. Draw Loaded Ammo in Pouch
      const loaded = window.GameState.loadedCard[p - 1];
      if (loaded) {
        const spriteKey = `sprite_${loaded.id}`;
        const img = window.SpriteManager.get(spriteKey);
        const size = 36;
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, pouchX - size / 2, pouchY - size / 2, size, size);
        } else {
          ctx.fillStyle = cfg.teamColor;
          ctx.beginPath();
          ctx.arc(pouchX, pouchY, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Draw Trajectory Arc Preview if dragging
      if (isCurrentDrag && this.pullDistance > 15) {
        this.renderTrajectory(ctx, p, pouchX, pouchY);
      }

      ctx.restore();
    });
  },

  /**
   * Render parabolic trajectory dots and impact landing reticle
   */
  renderTrajectory(ctx, player, startX, startY) {
    const cfg = player === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
    const vx = -this.pullVector.x * cfg.launchSpeedMultiplier;
    const vy = -this.pullVector.y * cfg.launchSpeedMultiplier;
    const g = window.GameConfig.CANVAS.GRAVITY;

    const timeStep = 0.055;
    const maxSteps = 28;

    let currX = startX;
    let currY = startY;
    let impactPoint = null;

    ctx.save();
    for (let step = 1; step <= maxSteps; step++) {
      const t = step * timeStep;
      const nextX = startX + vx * t;
      const nextY = startY + vy * t + 0.5 * g * t * t;
      const currentVy = vy + g * t;

      // Check impact along this segment
      const check = window.MountainSystem.checkImpact(nextX, nextY, currentVy);
      if (check.hit) {
        impactPoint = { x: check.x, y: check.y, type: check.type };
        break;
      }

      // Draw trajectory dot
      const alpha = 1.0 - (step / maxSteps) * 0.65;
      const radius = Math.max(2.5, 5.5 - (step / maxSteps) * 2.5);

      ctx.beginPath();
      ctx.arc(nextX, nextY, radius, 0, Math.PI * 2);
      ctx.fillStyle = player === 1 ? `rgba(56, 189, 248, ${alpha})` : `rgba(251, 113, 133, ${alpha})`;
      ctx.fill();
    }

    // If an impact point was detected, render a glowing target reticle on the mountain ledge
    if (impactPoint) {
      ctx.beginPath();
      ctx.arc(impactPoint.x, impactPoint.y, 18, 0, Math.PI * 2);
      ctx.strokeStyle = player === 1 ? "#38bdf8" : "#fb7185";
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Inner pulse dot
      ctx.beginPath();
      ctx.arc(impactPoint.x, impactPoint.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = player === 1 ? "#0284c7" : "#e11d48";
      ctx.fill();
    }

    ctx.restore();
  }
};
