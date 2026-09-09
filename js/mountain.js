/**
 * js/mountain.js - 9x8 Mountain Arena Grid, Simple-Shape Vector Renderer & Physics Impact
 * Generates a clean, stylized mountain grid directly with simple vector shapes:
 * - Alpine sky with soft distant mountain silhouettes & clouds
 * - Centered mountain silhouette with snow-capped summit ridge, rocky climbing terraces, and green base camp
 * - Left & right stone cliff bastions for P1 and P2 slingshots
 * - 100% unobstructed view in landscape orientation
 */

window.MountainSystem = {
  pixelToGrid(x, y) {
    const grid = window.GameConfig.GRID;

    const clampedX = Math.max(grid.X_START, Math.min(grid.X_END - 1, x));
    const clampedY = Math.max(grid.Y_START, Math.min(grid.Y_END - 1, y));

    const col = Math.floor((clampedX - grid.X_START) / grid.COL_WIDTH);
    const row = Math.floor((clampedY - grid.Y_START) / grid.ROW_HEIGHT);

    return {
      col: Math.max(0, Math.min(grid.COLS - 1, col)),
      row: Math.max(0, Math.min(grid.ROWS - 1, row))
    };
  },

  gridToPixel(col, row) {
    const grid = window.GameConfig.GRID;
    return {
      x: grid.X_START + (col + 0.5) * grid.COL_WIDTH,
      y: grid.Y_START + (row + 0.5) * grid.ROW_HEIGHT
    };
  },

  checkImpact(x, y, vy, cardKind) {
    const grid = window.GameConfig.GRID;

    // Hikers: land when descending into base camp (rows 6-7, y >= Y_START + 6 * ROW_HEIGHT)
    if (cardKind === "hiker") {
      if (y >= grid.Y_START + 6 * grid.ROW_HEIGHT && vy > 0) {
        const { col, row } = this.pixelToGrid(x, y);
        const deployRow = Math.max(6, Math.min(7, row));
        const pos = this.gridToPixel(col, deployRow);
        return { hit: true, col, row: deployRow, x: pos.x, y: pos.y };
      }
    }

    // Bombs & Units: ground floor boundary impact at bottom of arena
    if (y >= grid.Y_END) {
      const { col } = this.pixelToGrid(x, y);
      const row = 7;
      const pos = this.gridToPixel(col, row);
      return { hit: true, col, row, x: pos.x, y: pos.y };
    }

    return { hit: false };
  },

  isValidPlacement(player, card, col, row) {
    const arena = window.GameConfig.ARENA;

    if (card.kind === "hiker") {
      if (!arena.deployRows.includes(row)) return false;
      const existing = window.GameState.getUnitAt(col, row);
      if (existing && existing.player === player) return false;
      return true;
    }

    if (card.kind === "bomb") {
      const existingBomb = window.GameState.getBombAt(col, row);
      if (existingBomb) return false;
      return true;
    }

    return false;
  },

  getFlagSlotIndex(col) {
    return window.GameConfig.ARENA.flagCols.indexOf(col);
  },

  /**
   * Procedural Simple-Shape Mountain & Environment Renderer
   */
  renderEnvironment(ctx, now) {
    const W = window.GameConfig.CANVAS.WIDTH;
    const H = window.GameConfig.CANVAS.HEIGHT;
    const grid = window.GameConfig.GRID;

    ctx.save();

    // 1. Vibrant Alpine Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0.0, "#0f2347"); // Deep alpine twilight
    skyGrad.addColorStop(0.2, "#1e3a8a"); // Vibrant blue
    skyGrad.addColorStop(0.5, "#0284c7"); // Crisp sky blue
    skyGrad.addColorStop(0.8, "#38bdf8"); // Soft cyan
    skyGrad.addColorStop(1.0, "#bae6fd"); // Misty horizon
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Stylized Distant Mountain Peaks (Layers for depth)
    this.drawDistantPeaks(ctx, W, H);

    // 3. Stylized Floating Clouds
    this.drawClouds(ctx, W, now);

    // 4. Ground Foothills (Horizon ground)
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 840, W, H - 840);
    const grassGrad = ctx.createLinearGradient(0, 835, 0, 875);
    grassGrad.addColorStop(0, "#15803d");
    grassGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, 835, W, 40);

    // 5. Left & Right Cliff Bastions (Slingshot Pedestals)
    this.drawCliffBastions(ctx);

    // 6. The Central Mountain Body & Climbing Grid
    this.drawMountainGrid(ctx, grid, now);

    ctx.restore();
  },

  drawDistantPeaks(ctx, W, H) {
    // Back layer distant mountain silhouettes
    ctx.fillStyle = "rgba(71, 85, 105, 0.45)";
    ctx.beginPath();
    ctx.moveTo(0, 700);
    ctx.lineTo(260, 420);
    ctx.lineTo(460, 560);
    ctx.lineTo(720, 360);
    ctx.lineTo(960, 520);
    ctx.lineTo(1240, 340);
    ctx.lineTo(1520, 540);
    ctx.lineTo(1760, 390);
    ctx.lineTo(W, 680);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Mid layer mountain silhouettes with snow tips
    ctx.fillStyle = "rgba(51, 65, 85, 0.75)";
    ctx.beginPath();
    ctx.moveTo(0, 760);
    ctx.lineTo(180, 520);
    ctx.lineTo(380, 640);
    ctx.lineTo(600, 480);
    ctx.lineTo(840, 620);
    ctx.lineTo(1080, 470);
    ctx.lineTo(1340, 610);
    ctx.lineTo(1620, 490);
    ctx.lineTo(W, 740);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  },

  drawClouds(ctx, W, now) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";

    const clouds = [
      { x: ((now * 15) % (W + 200)) - 100, y: 70, scale: 1.1 },
      { x: (((now * 10) + 600) % (W + 200)) - 100, y: 110, scale: 0.8 },
      { x: (((now * 18) + 1200) % (W + 200)) - 100, y: 50, scale: 1.3 }
    ];

    clouds.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 24 * c.scale, 0, Math.PI * 2);
      ctx.arc(c.x + 22 * c.scale, c.y - 12 * c.scale, 28 * c.scale, 0, Math.PI * 2);
      ctx.arc(c.x + 50 * c.scale, c.y - 6 * c.scale, 26 * c.scale, 0, Math.PI * 2);
      ctx.arc(c.x + 72 * c.scale, c.y, 20 * c.scale, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    });

    ctx.restore();
  },

  drawCliffBastions(ctx) {
    ctx.save();

    // Left Bastion (Player 1 - Blue)
    const p1X = 140;
    const p1W = 260;
    const p1Y = 700;
    const p1H = 140;

    // Stone block base
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(p1X, p1Y, p1W, p1H, [12, 12, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Stone masonry lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p1X, p1Y + 45); ctx.lineTo(p1X + p1W, p1Y + 45);
    ctx.moveTo(p1X, p1Y + 90); ctx.lineTo(p1X + p1W, p1Y + 90);
    ctx.moveTo(p1X + 130, p1Y); ctx.lineTo(p1X + 130, p1Y + 45);
    ctx.moveTo(p1X + 70, p1Y + 45); ctx.lineTo(p1X + 70, p1Y + 90);
    ctx.moveTo(p1X + 190, p1Y + 45); ctx.lineTo(p1X + 190, p1Y + 90);
    ctx.stroke();

    // Green grass top edge
    ctx.fillStyle = "#16a34a";
    ctx.fillRect(p1X, p1Y, p1W, 10);

    // Blue heraldic banner
    ctx.fillStyle = "#1d4ed8";
    ctx.beginPath();
    ctx.moveTo(p1X + 80, p1Y + 12);
    ctx.lineTo(p1X + 180, p1Y + 12);
    ctx.lineTo(p1X + 180, p1Y + 105);
    ctx.lineTo(p1X + 130, p1Y + 125);
    ctx.lineTo(p1X + 80, p1Y + 105);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.stroke();

    // White crown insignia on banner
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("👑", p1X + 130, p1Y + 68);
    ctx.font = "bold 13px Outfit, sans-serif";
    ctx.fillText("TEAM BLUE", p1X + 130, p1Y + 95);


    // Right Bastion (Player 2 - Red)
    const p2X = 1520;
    const p2W = 260;
    const p2Y = 700;
    const p2H = 140;

    // Stone block base
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(p2X, p2Y, p2W, p2H, [12, 12, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Stone masonry lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p2X, p2Y + 45); ctx.lineTo(p2X + p2W, p2Y + 45);
    ctx.moveTo(p2X, p2Y + 90); ctx.lineTo(p2X + p2W, p2Y + 90);
    ctx.moveTo(p2X + 130, p2Y); ctx.lineTo(p2X + 130, p2Y + 45);
    ctx.moveTo(p2X + 70, p2Y + 45); ctx.lineTo(p2X + 70, p2Y + 90);
    ctx.moveTo(p2X + 190, p2Y + 45); ctx.lineTo(p2X + 190, p2Y + 90);
    ctx.stroke();

    // Green grass top edge
    ctx.fillStyle = "#16a34a";
    ctx.fillRect(p2X, p2Y, p2W, 10);

    // Red heraldic banner
    ctx.fillStyle = "#b91c1c";
    ctx.beginPath();
    ctx.moveTo(p2X + 80, p2Y + 12);
    ctx.lineTo(p2X + 180, p2Y + 12);
    ctx.lineTo(p2X + 180, p2Y + 105);
    ctx.lineTo(p2X + 130, p2Y + 125);
    ctx.lineTo(p2X + 80, p2Y + 105);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 3;
    ctx.stroke();

    // White crown insignia on banner
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("👑", p2X + 130, p2Y + 68);
    ctx.font = "bold 13px Outfit, sans-serif";
    ctx.fillText("TEAM RED", p2X + 130, p2Y + 95);

    ctx.restore();
  },

  drawMountainGrid(ctx, grid, now) {
    ctx.save();

    const mLeft = grid.X_START;
    const mRight = grid.X_END;
    const mTop = grid.Y_START;
    const mBottom = grid.Y_END;
    const mW = mRight - mLeft;
    const mH = mBottom - mTop;

    // Mountain Outer Slope Silhouette (slight trapezoidal angle for mountain feeling)
    const topInset = 20;
    const botOutset = 15;

    ctx.beginPath();
    ctx.moveTo(mLeft + topInset, mTop);
    ctx.lineTo(mRight - topInset, mTop);
    ctx.lineTo(mRight + botOutset, mBottom);
    ctx.lineTo(mLeft - botOutset, mBottom);
    ctx.closePath();

    // Mountain rock body gradient
    const rockGrad = ctx.createLinearGradient(0, mTop, 0, mBottom);
    rockGrad.addColorStop(0, "#334155"); // Summit slate
    rockGrad.addColorStop(0.3, "#1e293b"); // Mid slope dark rock
    rockGrad.addColorStop(0.75, "#0f172a"); // Lower slopes
    rockGrad.addColorStop(1.0, "#0b0f19"); // Base
    ctx.fillStyle = rockGrad;
    ctx.fill();

    // Outer mountain rock border
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw Grid Rows & Ledges
    for (let r = 0; r < grid.ROWS; r++) {
      const rowY = mTop + r * grid.ROW_HEIGHT;
      const rowH = grid.ROW_HEIGHT;

      // 1. Peak Summit (Row 0)
      if (r === 0) {
        // Snow Cap on Row 0
        ctx.fillStyle = "#f1f5f9";
        ctx.beginPath();
        ctx.rect(mLeft, rowY, mW, rowH);
        ctx.fill();

        // Jagged ice/snow edge at bottom of Row 0
        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.moveTo(mLeft, rowY + rowH - 8);
        for (let x = mLeft; x <= mRight; x += 30) {
          ctx.lineTo(x + 15, rowY + rowH + (x % 60 === 0 ? 8 : -4));
          ctx.lineTo(x + 30, rowY + rowH - 8);
        }
        ctx.closePath();
        ctx.fill();

        // Summit Ridge Label
        ctx.fillStyle = "#475569";
        ctx.font = "900 11px 'Outfit', sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("🏔️ SUMMIT PEAK", mLeft + 12, rowY + 20);
      }
      // 2. Base Camp Deployment Zone (Rows 6 & 7)
      else if (r >= 6) {
        // Lush green grassy shelf
        ctx.fillStyle = r === 6 ? "rgba(22, 163, 74, 0.22)" : "rgba(21, 128, 61, 0.32)";
        ctx.fillRect(mLeft, rowY, mW, rowH);

        // Grass top edge highlight
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(mLeft, rowY, mW, 3);

        if (r === 7) {
          ctx.fillStyle = "rgba(74, 222, 128, 0.75)";
          ctx.font = "800 11px 'Outfit', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("⛺ BASE CAMP • CLIMBER DEPLOYMENT ZONE", mLeft + mW / 2, rowY + rowH - 12);
        }
      }
      // 3. Rocky Mountain Slopes (Rows 1 to 5)
      else {
        // Alternating subtle rock shelf tone
        if (r % 2 === 1) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
          ctx.fillRect(mLeft, rowY, mW, rowH);
        }
        // Stone terrace ledge line
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(mLeft, rowY);
        ctx.lineTo(mRight, rowY);
        ctx.stroke();

        // Subtle ledge top highlight
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mLeft, rowY + 1);
        ctx.lineTo(mRight, rowY + 1);
        ctx.stroke();
      }

      // Row indicator on the left side
      ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
      ctx.font = "bold 10px 'Outfit', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`R${r}`, mLeft - 8, rowY + rowH / 2 + 3);
      ctx.textAlign = "left";
      ctx.fillText(`R${r}`, mRight + 8, rowY + rowH / 2 + 3);
    }

    // Draw Vertical Lanes (Columns)
    for (let c = 0; c <= grid.COLS; c++) {
      const colX = mLeft + c * grid.COL_WIDTH;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(colX, mTop);
      ctx.lineTo(colX, mBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Lane numbers in sky band
      if (c < grid.COLS) {
        ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
        ctx.font = "900 11px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`L${c + 1}`, colX + grid.COL_WIDTH / 2, mTop - 8);
      }
    }

    ctx.restore();
  }
};
