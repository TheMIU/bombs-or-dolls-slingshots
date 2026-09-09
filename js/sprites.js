/**
 * js/sprites.js - Canvas Sprite Renderer, 8 Summit Flags & Units
 * Calibrated for the 1920x1080 resolution and 9x8 grid.
 */

window.SpriteManager = {
  images: {},
  loaded: false,

  manifest: {
    card_basic: "assets/card_basic_bomb.png",
    card_timer: "assets/card_timer_bomb.png",
    card_area: "assets/card_area_bomb.png",
    card_shock: "assets/card_shock_bomb.png",
    card_scout: "assets/card_scout.png",
    card_knight: "assets/card_knight.png",
    card_sumo: "assets/card_sumo.png",
    card_doctor: "assets/card_doctor.png",

    sprite_basic: "assets/sprite_basic_bomb.png",
    sprite_timer: "assets/sprite_timer_bomb.png",
    sprite_area: "assets/sprite_area_bomb.png",
    sprite_shock: "assets/sprite_shock_bomb.png",
    sprite_scout: "assets/sprite_scout.png",
    sprite_knight: "assets/sprite_knight.png",
    sprite_sumo: "assets/sprite_sumo.png",
    sprite_doctor: "assets/sprite_doctor.png"
  },

  init(onComplete) {
    let toLoad = Object.keys(this.manifest).length;
    let loadedCount = 0;

    for (const [key, src] of Object.entries(this.manifest)) {
      const img = new Image();
      img.onload = () => {
        if (++loadedCount >= toLoad) {
          this.loaded = true;
          if (onComplete) onComplete();
        }
      };
      img.onerror = () => {
        if (++loadedCount >= toLoad) {
          this.loaded = true;
          if (onComplete) onComplete();
        }
      };
      img.src = src;
      this.images[key] = img;
    }
  },

  get(key) {
    return this.images[key] || null;
  },

  /**
   * Draw the 8 Summit Flags on Row 0 and Central Trophy
   */
  drawSummitFlagsOnMountain(ctx, now) {
    const flags = window.GameState.flags || [0, 0, 0, 0, 0, 0, 0, 0];
    const flagCols = window.GameConfig.ARENA.flagCols;
    const trophyCol = window.GameConfig.ARENA.trophyCol;

    ctx.save();

    // Central Trophy on Column 4, Row 0
    const trophyPos = window.MountainSystem.gridToPixel(trophyCol, 0);
    ctx.font = "38px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🏆", trophyPos.x, trophyPos.y - 10 + Math.sin(now * 3) * 4);

    // 8 Flags on Columns [0, 1, 2, 3, 5, 6, 7, 8]
    flagCols.forEach((col, slotIdx) => {
      const pos = window.MountainSystem.gridToPixel(col, 0);
      const flagVal = flags[slotIdx]; // 0 = neutral, 1 = Blue, 2 = Red

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Flag pole
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(0, -28);
      ctx.stroke();

      // Flag cloth
      let flagColor = "#cbd5e1"; // neutral light
      if (flagVal === 1) flagColor = "#0284c7"; // Blue
      else if (flagVal === 2) flagColor = "#e11d48"; // Red

      const wave = Math.sin(now * 5 + slotIdx) * 4;
      ctx.fillStyle = flagColor;
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(22 + wave, -20);
      ctx.lineTo(0, -12);
      ctx.closePath();
      ctx.fill();

      // Base mount circle
      ctx.beginPath();
      ctx.arc(0, 14, 6, 0, Math.PI * 2);
      ctx.fillStyle = flagVal === 1 ? "#38bdf8" : (flagVal === 2 ? "#fb7185" : "#64748b");
      ctx.fill();

      ctx.restore();
    });

    ctx.restore();
  },

  drawHiker(ctx, hiker, now) {
    const spriteKey = `sprite_${hiker.card.id}`;
    const img = this.get(spriteKey);

    ctx.save();
    ctx.translate(hiker.renderX, hiker.renderY);

    if (hiker.stunTimer > 0) {
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 14;
      ctx.filter = "brightness(1.4) hue-rotate(180deg)";
    }

    const bob = (hiker.stunTimer <= 0 && !hiker.isBlocked) ? Math.sin(now * 8) * 4 : 0;
    const teamColor = hiker.player === 1 ? "rgba(2, 132, 199, 0.45)" : "rgba(225, 29, 72, 0.45)";
    const teamBorder = hiker.player === 1 ? "#0284c7" : "#e11d48";

    // Team base aura circle
    ctx.beginPath();
    ctx.ellipse(0, 14, 26, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = teamColor;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = teamBorder;
    ctx.stroke();

    const w = 56;
    const h = 64;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -w / 2, -h + 10 + bob, w, h);
    } else {
      ctx.fillStyle = teamBorder;
      ctx.beginPath();
      ctx.arc(0, -h / 2 + bob, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.filter = "none";
    ctx.shadowBlur = 0;

    // Team Crown Dot
    ctx.beginPath();
    ctx.arc(0, -h - 6 + bob, 7, 0, Math.PI * 2);
    ctx.fillStyle = teamBorder;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // HP Bar
    const hpBarW = 50;
    const hpBarH = 7;
    const hpPct = Math.max(0, Math.min(1, hiker.hp / hiker.maxHp));

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.beginPath();
    ctx.roundRect(-hpBarW / 2, -h - 20 + bob, hpBarW, hpBarH, 4);
    ctx.fill();

    let hpColor = "#22c55e";
    if (hpPct < 0.35) hpColor = "#ef4444";
    else if (hpPct < 0.65) hpColor = "#eab308";

    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(-hpBarW / 2 + 1, -h - 20 + bob + 1, (hpBarW - 2) * hpPct, hpBarH - 2, 3);
    ctx.fill();

    if (hiker.stunTimer > 0) {
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 12px Fredoka, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚡ STUNNED", 0, -h - 24 + bob);
    }

    ctx.restore();
  },

  drawBomb(ctx, bomb, now) {
    const spriteKey = `sprite_${bomb.card.id}`;
    const img = this.get(spriteKey);

    ctx.save();
    ctx.translate(bomb.renderX, bomb.renderY);

    const w = 48;
    const h = 52;

    ctx.beginPath();
    ctx.ellipse(0, 8, 18, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = bomb.player === 1 ? "rgba(2, 132, 199, 0.35)" : "rgba(225, 29, 72, 0.35)";
    ctx.fill();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -w / 2, -h + 10, w, h);
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(0, -h / 2, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    if (bomb.card.id === "timer") {
      const remaining = Math.max(0, bomb.fuseTimer).toFixed(1);
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 15px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`⏱${remaining}s`, 0, -h - 10);

      for (let s = 0; s < 4; s++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 8 + Math.random() * 8;
        ctx.fillStyle = Math.random() > 0.5 ? "#fbbf24" : "#ef4444";
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * dist, -h - 2 + Math.sin(angle) * dist, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  },

  drawFlyingProjectile(ctx, proj) {
    const spriteKey = `sprite_${proj.card.id}`;
    const img = this.get(spriteKey);

    ctx.save();
    ctx.translate(proj.x, proj.y);

    const angle = Math.atan2(proj.vy, proj.vx);
    ctx.rotate(angle);

    const size = 50;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = proj.player === 1 ? "#0284c7" : "#e11d48";
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
};
