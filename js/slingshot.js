/**
 * js/slingshot.js - Full-Field Slingshot Aiming, Precision Ballistics & Cancel Engine
 * - Smooth drag anywhere on screen (P1 left slingshot at (270, 685), P2 right slingshot at (1650, 685))
 * - Full coverage of all 9 columns (0 to 8) including the opponent's far end side
 * - Full row targeting (Rows 0-7 for Bombs, Rows 6-7 for Hikers)
 * - Intuitive Drag Cancel: drag back into neutral zone (< 24px) shows "❌ RELEASE TO CANCEL"
 * - Instant Cancel via ESC key, Right-Click, or Multi-touch (tapping second finger)
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
  CANCEL_THRESHOLD: 24, // Pull distance < 24 virtual px = Cancel Zone

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
      if (window.GameState.isGameOver || window.GameState.isPaused) return;

      // Multi-touch cancel: tapping with a second finger cancels active drag
      if (e.touches && e.touches.length > 1) {
        if (this.isDragging) {
          this.cancelDrag("Aim cancelled.");
        }
        return;
      }

      if (!window.GameState.isStarted) {
        window.GameSystem?.startMatch?.();
      }

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

      if (e.touches && e.touches.length > 1) {
        this.cancelDrag("Aim cancelled.");
        return;
      }

      const pos = getCanvasPos(e);
      this.currentDragX = pos.x;
      this.currentDragY = pos.y;
      this.updatePull(this.activePlayer);
      e.preventDefault();
    };

    const handleUp = (e) => {
      if (!this.isDragging || !this.activePlayer) return;
      this.release(this.activePlayer);
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && this.isDragging) {
        this.cancelDrag("Aim cancelled via Escape.");
      }
    };

    const handleContextMenu = (e) => {
      if (this.isDragging) {
        e.preventDefault();
        this.cancelDrag("Aim cancelled via right-click.");
      }
    };

    canvas.addEventListener("mousedown", handleDown);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    canvas.addEventListener("touchstart", handleDown, { passive: false });
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);
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

    if (dist > this.CANCEL_THRESHOLD && Math.random() < 0.15) {
      window.SoundFX.playStretch(dist / cfg.maxPull);
    }
  },

  cancelDrag(reason = "Aim cancelled.") {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.activePlayer = null;
    this.pullVector = { x: 0, y: 0 };
    this.pullDistance = 0;

    window.SoundFX?.playCancel?.();
    window.GameSystem?.updateStatus?.(reason);
  },

  /**
   * Translates the pull vector (pullX, pullY) smoothly into a target mountain grid cell.
   * Full coverage: covers from Column 0 all the way to Column 8 (opponent's end side)
   */
  calculateAimTarget(player, pullX, pullY, cardKind) {
    let targetCol = 0;
    let targetRow = 7;

    // Horizontal Column targeting:
    // P1: Pulling left (pullX < 0) stretches slingshot back to shoot RIGHT towards cols 0..8
    // P2: Pulling right (pullX > 0) stretches slingshot back to shoot LEFT towards cols 8..0
    if (player === 1) {
      const px = -pullX; // Positive when pulled left
      const frac = Math.max(0, Math.min(1, (px - 14) / 106));
      targetCol = Math.min(8, Math.max(0, Math.floor(frac * 9)));
    } else {
      const px = pullX; // Positive when pulled right
      const frac = Math.max(0, Math.min(1, (px - 14) / 106));
      targetCol = Math.min(8, Math.max(0, 8 - Math.floor(frac * 9)));
    }

    // Vertical Row targeting:
    if (cardKind === "hiker") {
      // Hikers deploy strictly at base camp (Row 6 or Row 7)
      targetRow = pullY > 15 ? 6 : 7;
    } else {
      // Bombs can target any row (Row 0 Peak to Row 7 Base)
      // Pulling down (pullY > 0) aims higher up towards Peak (Row 0)
      // Pulling level/up (pullY <= 0) aims towards bottom ledges (Row 7)
      const frac = Math.max(0, Math.min(1, (pullY + 35) / 115));
      targetRow = Math.min(7, Math.max(0, 7 - Math.floor(frac * 8)));
    }

    const targetPos = window.MountainSystem.gridToPixel(targetCol, targetRow);
    return { col: targetCol, row: targetRow, x: targetPos.x, y: targetPos.y };
  },

  /**
   * Computes the exact ballistic physics required to land on (targetCol, targetRow)
   */
  calculateTrajectory(player, targetCol, targetRow) {
    const cfg = player === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
    const targetPos = window.MountainSystem.gridToPixel(targetCol, targetRow);
    const g = window.GameConfig.CANVAS.GRAVITY;
    const dx = targetPos.x - cfg.restX;
    const dy = targetPos.y - cfg.restY;

    // Flight time scales naturally with horizontal distance (0.70s to 1.38s)
    const distX = Math.abs(dx);
    const flightTime = Math.max(0.70, Math.min(1.38, 0.45 + (distX / 1400) * 0.90));
    const vx = dx / flightTime;
    const vy = (dy - 0.5 * g * flightTime * flightTime) / flightTime;

    return { vx, vy, flightTime, targetPos };
  },

  release(player) {
    if (!this.isDragging || !player) return;

    // 1. Cancel check: if released in the neutral cancel zone, cancel cleanly
    if (this.pullDistance < this.CANCEL_THRESHOLD) {
      this.cancelDrag("Drag cancelled. Card kept ready!");
      return;
    }

    const card = window.GameState.loadedCard[player - 1];
    if (!card) {
      this.cancelDrag();
      return;
    }

    const cfg = player === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
    const currentMana = window.GameState.mana[player - 1];
    if (currentMana < card.cost) {
      window.GameSystem?.updateStatus?.(`Player ${player}: Not enough mana! (${card.cost}⚡ needed)`);
      this.cancelDrag();
      return;
    }

    // 2. Compute exact aim destination and trajectory
    const aim = this.calculateAimTarget(player, this.pullVector.x, this.pullVector.y, card.kind);
    const traj = this.calculateTrajectory(player, aim.col, aim.row);
    const targetPos = traj.targetPos;

    // Deduct mana
    window.GameState.mana[player - 1] -= card.cost;

    const proj = {
      id: window.GameState.getNextId(),
      player: player,
      card: card,
      x: cfg.restX + this.pullVector.x,
      y: cfg.restY + this.pullVector.y,
      vx: traj.vx,
      vy: traj.vy,
      gravity: window.GameConfig.CANVAS.GRAVITY,
      flightTime: 0,
      maxFlightTime: traj.flightTime,
      targetCol: aim.col,
      targetRow: aim.row,
      targetX: targetPos.x,
      targetY: targetPos.y,
      trailTimer: 0
    };
    window.GameState.projectiles.push(proj);

    // Online multiplayer synchronization
    if (window.Network && window.Network.isOnline) {
      window.Network.send({
        type: "LAUNCH",
        player: player,
        cardId: card.id,
        pullX: this.pullVector.x,
        pullY: this.pullVector.y,
        targetCol: aim.col,
        targetRow: aim.row
      });
    }

    window.SoundFX.playRelease();
    this.wobble[player - 1].amp = 20;

    window.GameState.loadedCard[player - 1] = null;
    window.GameSystem?.updateCardsUI?.();
    window.GameSystem?.updateStatus?.(`Player ${player} launched ${card.name} → Col ${aim.col}, Row ${aim.row}!`);

    this.isDragging = false;
    this.activePlayer = null;
    this.pullVector = { x: 0, y: 0 };
    this.pullDistance = 0;
  },

  launchRemote(player, card, pullX, pullY, remoteCol, remoteRow) {
    const cfg = player === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
    if (window.GameState.mana[player - 1] < card.cost) return false;
    window.GameState.mana[player - 1] -= card.cost;

    let targetCol = remoteCol;
    let targetRow = remoteRow;
    if (targetCol === undefined || targetRow === undefined) {
      const aim = this.calculateAimTarget(player, pullX, pullY, card.kind);
      targetCol = aim.col;
      targetRow = aim.row;
    }

    const traj = this.calculateTrajectory(player, targetCol, targetRow);
    const targetPos = traj.targetPos;

    window.GameState.projectiles.push({
      id: window.GameState.getNextId(),
      player: player,
      card: card,
      x: cfg.restX + (pullX || 0),
      y: cfg.restY + (pullY || 0),
      vx: traj.vx,
      vy: traj.vy,
      gravity: window.GameConfig.CANVAS.GRAVITY,
      flightTime: 0,
      maxFlightTime: traj.flightTime,
      targetCol: targetCol,
      targetRow: targetRow,
      targetX: targetPos.x,
      targetY: targetPos.y,
      trailTimer: 0
    });

    window.SoundFX.playRelease();
    this.wobble[player - 1].amp = 20;
    return true;
  },

  launchTarget(player, card, targetCol, targetRow) {
    const cfg = player === 1 ? window.GameConfig.SLINGSHOTS.P1 : window.GameConfig.SLINGSHOTS.P2;
    if (window.GameState.mana[player - 1] < card.cost) return false;
    window.GameState.mana[player - 1] -= card.cost;

    const traj = this.calculateTrajectory(player, targetCol, targetRow);
    const targetPos = traj.targetPos;

    window.GameState.projectiles.push({
      id: window.GameState.getNextId(),
      player: player,
      card: card,
      x: cfg.restX,
      y: cfg.restY,
      vx: traj.vx,
      vy: traj.vy,
      gravity: window.GameConfig.CANVAS.GRAVITY,
      flightTime: 0,
      maxFlightTime: traj.flightTime,
      targetCol: targetCol,
      targetRow: targetRow,
      targetX: targetPos.x,
      targetY: targetPos.y,
      trailTimer: 0
    });

    window.SoundFX.playRelease();
    this.wobble[player - 1].amp = 20;
    return true;
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

      // Trajectory Arc & Target Grid Cell Highlight OR Cancel Zone
      if (isCurrentDrag) {
        if (this.pullDistance < this.CANCEL_THRESHOLD) {
          this.renderCancelIndicator(ctx, p, pouchX, pouchY);
        } else {
          this.renderTrajectory(ctx, p, pouchX, pouchY, loaded);
        }
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

  /**
   * Renders the cancel indicator when dragging inside the neutral cancel zone (< 24px)
   */
  renderCancelIndicator(ctx, player, pouchX, pouchY) {
    ctx.save();

    const now = Date.now() / 1000;
    const pulse = 1 + 0.12 * Math.sin(now * 8);

    // Cancel zone circular aura around the resting pouch / touch start
    ctx.fillStyle = "rgba(239, 68, 68, 0.22)";
    ctx.beginPath();
    ctx.arc(pouchX, pouchY, this.CANCEL_THRESHOLD * 1.5 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(pouchX, pouchY, this.CANCEL_THRESHOLD * 1.5 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glowing badge pill
    const badgeW = 200;
    const badgeH = 46;
    const badgeX = pouchX - badgeW / 2;
    const badgeY = pouchY - 60;

    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 15px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("❌ RELEASE TO CANCEL", pouchX, badgeY + 20);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Outfit, sans-serif";
    ctx.fillText("Drag further out to aim", pouchX, badgeY + 36);

    ctx.restore();
  },

  /**
   * Renders the full ballistic trajectory arc and highlighted target grid cell
   */
  renderTrajectory(ctx, player, startX, startY, card) {
    const aim = this.calculateAimTarget(player, this.pullVector.x, this.pullVector.y, card ? card.kind : "bomb");
    const traj = this.calculateTrajectory(player, aim.col, aim.row);
    const g = window.GameConfig.CANVAS.GRAVITY;

    ctx.save();

    // 1. Dotted parabolic trajectory arc from pouch to target cell
    const stepDt = 0.035;
    const totalSteps = Math.min(65, Math.ceil(traj.flightTime / stepDt));

    for (let step = 1; step <= totalSteps; step++) {
      const t = Math.min(traj.flightTime, step * stepDt);
      const nextX = startX + traj.vx * t;
      const nextY = startY + traj.vy * t + 0.5 * g * t * t;

      const progress = step / totalSteps;
      const alpha = 0.4 + 0.6 * (1 - progress * 0.5);
      const radius = Math.max(3.5, 7.5 - progress * 3.5);

      ctx.beginPath();
      ctx.arc(nextX, nextY, radius, 0, Math.PI * 2);
      ctx.fillStyle = player === 1 ? `rgba(56, 189, 248, ${alpha})` : `rgba(251, 113, 133, ${alpha})`;
      ctx.fill();

      // Outer glow for first few dots
      if (step <= 8) {
        ctx.fillStyle = player === 1 ? "rgba(56, 189, 248, 0.25)" : "rgba(251, 113, 133, 0.25)";
        ctx.beginPath();
        ctx.arc(nextX, nextY, radius + 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Target Grid Cell Highlight
    const grid = window.GameConfig.GRID;
    const cellX = grid.X_START + aim.col * grid.COL_WIDTH;
    const cellY = grid.Y_START + aim.row * grid.ROW_HEIGHT;

    // Shaded cell background
    ctx.fillStyle = player === 1 ? "rgba(56, 189, 248, 0.32)" : "rgba(244, 63, 94, 0.32)";
    ctx.fillRect(cellX, cellY, grid.COL_WIDTH, grid.ROW_HEIGHT);

    // Animated dashed outline
    const dashOffset = (Date.now() / 40) % 16;
    ctx.strokeStyle = player === 1 ? "#38bdf8" : "#f43f5e";
    ctx.lineWidth = 3;
    ctx.lineDashOffset = -dashOffset;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(cellX, cellY, grid.COL_WIDTH, grid.ROW_HEIGHT);
    ctx.setLineDash([]);

    // Target reticle at cell center
    const now = Date.now() / 1000;
    const pulse = 1 + 0.08 * Math.sin(now * 10);
    const reticleR = 20 * pulse;

    ctx.strokeStyle = player === 1 ? "#38bdf8" : "#fb7185";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, reticleR, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(aim.x - reticleR - 6, aim.y); ctx.lineTo(aim.x + reticleR + 6, aim.y);
    ctx.moveTo(aim.x, aim.y - reticleR - 6); ctx.lineTo(aim.x, aim.y + reticleR + 6);
    ctx.stroke();

    // Center target dot
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Target Info Badge
    const badgeText = `🎯 Col ${aim.col} • Row ${aim.row}${card ? ` • ${card.name}` : ""}`;
    ctx.font = "bold 13px Outfit, sans-serif";
    const textW = ctx.measureText(badgeText).width;
    const badgeW = textW + 28;
    const badgeH = 28;
    const badgeX = Math.max(grid.X_START, Math.min(grid.X_END - badgeW, aim.x - badgeW / 2));
    const badgeY = cellY - 34;

    ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
    ctx.strokeStyle = player === 1 ? "#38bdf8" : "#fb7185";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 19);

    // Cancel hint bar at top center of arena
    const hintText = "💡 Drag to aim • Pull back to origin or press ESC / Right-Click to Cancel";
    ctx.font = "12px Outfit, sans-serif";
    const hintW = ctx.measureText(hintText).width + 32;
    const hintX = 960 - hintW / 2;
    const hintY = 75;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(hintX, hintY, hintW, 26, 13);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.fillText(hintText, 960, hintY + 17);

    ctx.restore();
  }
};
