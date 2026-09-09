/**
 * js/slingshot.js - Full-Field Slingshot Aiming & Launch Engine
 * Calibrated for new slingshot positions: P1 at (268, 885), P2 at (1660, 885)
 */

window.SlingshotSystem = {
  activePlayer: null,
  isDragging: false,
  touchStartX: 0,
  touchStartY: 0,
  currentDragX: 0,
  currentDragY: 0,
  pullVector: { x: 0, y: 0 },
  pullDistance: 0,

  wobble: [
    { amp: 0, angle: 0, decay: 0.9 }, // P1
    { amp: 0, angle: 0, decay: 0.9 }  // P2
  ],

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;

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

    const handleDown = (e) => {
      if (window.GameState.isGameOver || window.GameState.isPaused || !window.GameState.isStarted) return;

      const pos = getCanvasPos(e);
      const W = window.GameConfig.CANVAS.WIDTH;
      let player = 1;

      // Online mode: always control your assigned player (1 or 2) anywhere on screen
      if (window.Network && window.Network.isOnline) {
        player = window.Network.myPlayer || 1;
      }
      // Single-player mode (AI on): control Player 1 anywhere on screen
      else if (window.GameState.aiEnabled) {
        player = 1;
      }
      // Local 2-player mode: left half controls P1, right half controls P2
      else {
        player = pos.x < W / 2 ? 1 : 2;
      }

      this.startDrag(player, pos);
      e.preventDefault();
    };

    const handleMove = (e) => {
      if (!this.isDragging || !this.activePlayer) return;
      const pos = getCanvasPos(e);
      this.currentDragX = pos.x;
      this.currentDragY = pos.y;
      this.updatePull(this.activePlayer);
      e.preventDefault();
    };

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

  startDrag(player, pos) {
    if (!window.GameState.loadedCard[player - 1]) {
      window.GameSystem?.autoSelectCard?.(player);
    }

    if (window.GameState.loadedCard[player - 1]) {
      this.activePlayer = player;
      this.isDragging = true;
      this.touchStartX = pos.x;
      this.touchStartY = pos.y;
      this.currentDragX = pos.x;
      this.currentDragY = pos.y;
      this.pullVector = { x: 0, y: 0 };
      this.pullDistance = 0;
      window.SoundFX.playStretch(0.25);
    }
  },

  updatePull(player) {
    const cfg = player === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
    
    // Smooth, deliberate drag sensitivity (0.65x scale prevents twitchy jumps)
    const SENSITIVITY = 0.65;
    let dx = (this.currentDragX - this.touchStartX) * SENSITIVITY;
    let dy = (this.currentDragY - this.touchStartY) * SENSITIVITY;
    let dist = Math.hypot(dx, dy);

    if (dist > cfg.maxPull) {
      dx = (dx / dist) * cfg.maxPull;
      dy = (dy / dist) * cfg.maxPull;
      dist = cfg.maxPull;
    }

    this.pullVector = { x: dx, y: dy };
    this.pullDistance = dist;

    if (dist > 15 && Math.random() < 0.2) {
      window.SoundFX.playStretch(dist / cfg.maxPull);
    }
  },

  release(player) {
    const card = window.GameState.loadedCard[player - 1];
    if (!card) return;

    const cfg = player === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
    const dist = this.pullDistance;

    if (dist < 15) return;

    const currentMana = window.GameState.mana[player - 1];
    if (currentMana < card.cost) {
      window.GameSystem?.updateStatus?.(`Player ${player}: Not enough mana! (${card.cost}⚡ needed)`);
      return;
    }

    window.GameState.mana[player - 1] -= card.cost;

    const vx = -this.pullVector.x * cfg.launchSpeedMultiplier;
    const vy = -this.pullVector.y * cfg.launchSpeedMultiplier;

    const proj = {
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
    };
    window.GameState.projectiles.push(proj);

    if (window.Network && window.Network.isOnline) {
      window.Network.send({
        type: "LAUNCH",
        player: player,
        cardId: card.id,
        pullX: this.pullVector.x,
        pullY: this.pullVector.y
      });
    }

    window.SoundFX.playRelease();
    this.wobble[player - 1].amp = 20;

    window.GameState.loadedCard[player - 1] = null;
    window.GameSystem?.updateCardsUI?.();
    window.GameSystem?.updateStatus?.(`Player ${player} launched ${card.name}!`);
  },

  launchRemote(player, card, pullX, pullY) {
    const cfg = player === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
    if (window.GameState.mana[player - 1] < card.cost) return false;
    window.GameState.mana[player - 1] -= card.cost;

    const vx = -pullX * cfg.launchSpeedMultiplier;
    const vy = -pullY * cfg.launchSpeedMultiplier;

    window.GameState.projectiles.push({
      id: window.GameState.getNextId(),
      player: player,
      card: card,
      x: cfg.restX + pullX,
      y: cfg.restY + pullY,
      vx: vx,
      vy: vy,
      gravity: window.GameConfig.CANVAS.GRAVITY,
      flightTime: 0,
      trailTimer: 0
    });

    window.SoundFX.playRelease();
    this.wobble[player - 1].amp = 20;
    return true;
  },

  launchTarget(player, card, targetCol, targetRow) {
    const cfg = player === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
    if (window.GameState.mana[player - 1] < card.cost) return false;

    const targetPos = window.MountainSystem.gridToPixel(targetCol, targetRow);
    const g = window.GameConfig.CANVAS.GRAVITY;
    const dx = targetPos.x - cfg.restX;
    const dy = targetPos.y - cfg.restY;

    const flightTime = Math.max(0.65, Math.min(1.4, Math.abs(dx) / 580));
    const vx = dx / flightTime;
    const vy = (dy - 0.5 * g * flightTime * flightTime) / flightTime;

    const pullX = -vx / cfg.launchSpeedMultiplier;
    const pullY = -vy / cfg.launchSpeedMultiplier;

    return this.launchRemote(player, card, pullX, pullY);
  },

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

  render(ctx) {
    [1, 2].forEach(p => {
      const cfg = p === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
      const isCurrentDrag = this.isDragging && this.activePlayer === p;

      let pouchX = cfg.restX;
      let pouchY = cfg.restY;

      if (isCurrentDrag) {
        pouchX += this.pullVector.x;
        pouchY += this.pullVector.y;
      } else if (this.wobble[p - 1].amp > 0.1) {
        pouchX += Math.sin(this.wobble[p - 1].angle) * this.wobble[p - 1].amp;
      }

      ctx.save();

      // 1. Draw Sturdy Wooden Slingshot Frame (Simple vector shapes)
      this.drawSlingshotFrame(ctx, cfg, p);

      // 2. Dual Rubber Bands
      ctx.lineWidth = 6;
      ctx.strokeStyle = cfg.bandColor;
      ctx.lineCap = "round";

      // Left Prong Band
      ctx.beginPath();
      ctx.moveTo(cfg.prongLeft.x, cfg.prongLeft.y);
      ctx.lineTo(pouchX - 6, pouchY);
      ctx.stroke();

      // Right Prong Band
      ctx.beginPath();
      ctx.moveTo(cfg.prongRight.x, cfg.prongRight.y);
      ctx.lineTo(pouchX + 6, pouchY);
      ctx.stroke();

      // Leather Pouch
      ctx.fillStyle = cfg.pouchColor;
      ctx.beginPath();
      ctx.roundRect(pouchX - 15, pouchY - 12, 30, 24, 6);
      ctx.fill();
      ctx.strokeStyle = "#292524";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Loaded Ammo
      const loaded = window.GameState.loadedCard[p - 1];
      if (loaded) {
        const spriteKey = `sprite_${loaded.id}`;
        const img = window.SpriteManager.get(spriteKey);
        const size = 38;
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, pouchX - size / 2, pouchY - size / 2, size, size);
        } else {
          ctx.fillStyle = cfg.teamColor;
          ctx.beginPath();
          ctx.arc(pouchX, pouchY, 14, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Trajectory Arc & Target Grid Cell Highlight
      if (isCurrentDrag && this.pullDistance > 15) {
        this.renderTrajectory(ctx, p, pouchX, pouchY, loaded);
      }

      ctx.restore();
    });
  },

  drawSlingshotFrame(ctx, cfg, p) {
    ctx.save();

    const baseX = cfg.x;
    const baseY = 740;
    const splitY = 690;

    // 1. Metal Base Mounting Bracket on Stone
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.roundRect(baseX - 32, baseY - 8, 64, 18, 4);
    ctx.fill();
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rivets / Bolts on Bracket
    ctx.fillStyle = "#cbd5e1";
    [-22, -8, 8, 22].forEach(ox => {
      ctx.beginPath();
      ctx.arc(baseX + ox, baseY + 1, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Main Vertical Wooden Post
    ctx.fillStyle = "#78350f";
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(baseX - 16, splitY, 32, baseY - splitY, 6);
    ctx.fill();
    ctx.stroke();

    // Wood Grain Highlight on Post
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(baseX - 4, splitY + 4);
    ctx.lineTo(baseX - 4, baseY - 4);
    ctx.stroke();

    // 3. Curved Left & Right Wooden Arms (Prongs)
    ctx.lineWidth = 24;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#78350f";

    // Left Arm
    ctx.beginPath();
    ctx.moveTo(baseX, splitY + 8);
    ctx.quadraticCurveTo(baseX - 10, splitY - 10, cfg.prongLeft.x, cfg.prongLeft.y);
    ctx.stroke();

    // Right Arm
    ctx.beginPath();
    ctx.moveTo(baseX, splitY + 8);
    ctx.quadraticCurveTo(baseX + 10, splitY - 10, cfg.prongRight.x, cfg.prongRight.y);
    ctx.stroke();

    // Wood Highlight on Prongs
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#92400e";
    ctx.beginPath();
    ctx.moveTo(baseX - 2, splitY + 4);
    ctx.quadraticCurveTo(baseX - 8, splitY - 8, cfg.prongLeft.x + 2, cfg.prongLeft.y + 4);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(baseX + 2, splitY + 4);
    ctx.quadraticCurveTo(baseX + 8, splitY - 8, cfg.prongRight.x - 2, cfg.prongRight.y + 4);
    ctx.stroke();

    // 4. Brass Reinforcement Bands at Prongs Tips & Junction
    ctx.fillStyle = "#d97706";
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 2;

    // Junction Ring
    ctx.beginPath();
    ctx.roundRect(baseX - 18, splitY - 4, 36, 12, 3);
    ctx.fill();
    ctx.stroke();

    // Left Tip Ring
    ctx.beginPath();
    ctx.arc(cfg.prongLeft.x, cfg.prongLeft.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Right Tip Ring
    ctx.beginPath();
    ctx.arc(cfg.prongRight.x, cfg.prongRight.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shiny Gold accents
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(cfg.prongLeft.x, cfg.prongLeft.y, 6, 0, Math.PI * 2);
    ctx.arc(cfg.prongRight.x, cfg.prongRight.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  renderTrajectory(ctx, player, startX, startY, card) {
    const cfg = player === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
    const vx = -this.pullVector.x * cfg.launchSpeedMultiplier;
    const vy = -this.pullVector.y * cfg.launchSpeedMultiplier;
    const g = window.GameConfig.CANVAS.GRAVITY;

    const timeStep = 0.05;
    const maxSteps = 32;

    let impactPoint = null;

    ctx.save();
    for (let step = 1; step <= maxSteps; step++) {
      const t = step * timeStep;
      const nextX = startX + vx * t;
      const nextY = startY + vy * t + 0.5 * g * t * t;
      const currentVy = vy + g * t;

      const check = window.MountainSystem.checkImpact(nextX, nextY, currentVy, card ? card.kind : "bomb");
      if (check.hit) {
        impactPoint = check;
        break;
      }

      const alpha = 1.0 - (step / maxSteps) * 0.6;
      const radius = Math.max(3, 6 - (step / maxSteps) * 3);

      ctx.beginPath();
      ctx.arc(nextX, nextY, radius, 0, Math.PI * 2);
      ctx.fillStyle = player === 1 ? `rgba(56, 189, 248, ${alpha})` : `rgba(251, 113, 133, ${alpha})`;
      ctx.fill();
    }

    // Target Grid Cell Highlight
    if (impactPoint) {
      const grid = window.GameConfig.GRID;
      const cellX = grid.X_START + impactPoint.col * grid.COL_WIDTH;
      const cellY = grid.Y_START + impactPoint.row * grid.ROW_HEIGHT;

      ctx.fillStyle = player === 1 ? "rgba(56, 189, 248, 0.3)" : "rgba(244, 63, 94, 0.3)";
      ctx.fillRect(cellX, cellY, grid.COL_WIDTH, grid.ROW_HEIGHT);

      ctx.strokeStyle = player === 1 ? "#38bdf8" : "#f43f5e";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(cellX, cellY, grid.COL_WIDTH, grid.ROW_HEIGHT);
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(impactPoint.x, impactPoint.y, 18, 0, Math.PI * 2);
      ctx.strokeStyle = player === 1 ? "#38bdf8" : "#fb7185";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Col ${impactPoint.col} • Row ${impactPoint.row}`, impactPoint.x, impactPoint.y - 24);
    }

    ctx.restore();
  }
};
