/**
 * js/sprites.js - Sprite Asset Loader & Renderer for Slingshots Edition
 */

window.SpriteManager = {
  images: {},
  loaded: false,

  // List of image assets to preload
  manifest: {
    // Cards
    card_basic: "assets/card_basic_bomb.png",
    card_timer: "assets/card_timer_bomb.png",
    card_area: "assets/card_area_bomb.png",
    card_shock: "assets/card_shock_bomb.png",
    card_scout: "assets/card_scout.png",
    card_knight: "assets/card_knight.png",
    card_sumo: "assets/card_sumo.png",
    card_doctor: "assets/card_doctor.png",

    // Sprites
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
        loadedCount++;
        if (loadedCount >= toLoad) {
          this.loaded = true;
          if (onComplete) onComplete();
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount >= toLoad) {
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
   * Draw a hiker unit on canvas
   */
  drawHiker(ctx, hiker, now) {
    const spriteKey = `sprite_${hiker.card.id}`;
    const img = this.get(spriteKey);

    ctx.save();
    ctx.translate(hiker.x, hiker.y);

    // Stun / freeze visual effect
    if (hiker.stunTimer > 0) {
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 12;
      ctx.filter = "brightness(1.4) hue-rotate(180deg)";
    }

    // Walking / climbing bob animation
    const bob = (hiker.stunTimer <= 0 && !hiker.isBlocked) ? Math.sin(now * 8) * 3 : 0;

    // Team base aura circle
    const teamColor = hiker.player === 1 ? "rgba(2, 132, 199, 0.4)" : "rgba(225, 29, 72, 0.4)";
    const teamBorder = hiker.player === 1 ? "#0284c7" : "#e11d48";

    ctx.beginPath();
    ctx.ellipse(0, 10, 22, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = teamColor;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = teamBorder;
    ctx.stroke();

    // Draw sprite image or fallback
    const w = 48;
    const h = 54;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -w / 2, -h + 8 + bob, w, h);
    } else {
      // Fallback stylized marker
      ctx.fillStyle = teamBorder;
      ctx.beginPath();
      ctx.arc(0, -h / 2 + bob, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Restore filter before drawing UI
    ctx.filter = "none";
    ctx.shadowBlur = 0;

    // Player Crown Badge / Dot
    ctx.beginPath();
    ctx.arc(0, -h - 6 + bob, 6, 0, Math.PI * 2);
    ctx.fillStyle = teamBorder;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // HP Bar
    const hpBarW = 44;
    const hpBarH = 6;
    const hpPct = Math.max(0, Math.min(1, hiker.hp / hiker.maxHp));

    // HP Bar background
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(-hpBarW / 2, -h - 18 + bob, hpBarW, hpBarH, 3);
    ctx.fill();

    // HP Bar fill
    let hpColor = "#22c55e"; // Green
    if (hpPct < 0.35) hpColor = "#ef4444"; // Red
    else if (hpPct < 0.65) hpColor = "#eab308"; // Yellow

    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(-hpBarW / 2 + 1, -h - 18 + bob + 1, (hpBarW - 2) * hpPct, hpBarH - 2, 2);
    ctx.fill();

    // Stunned indicator text
    if (hiker.stunTimer > 0) {
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 11px Fredoka, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚡ STUNNED", 0, -h - 22 + bob);
    }

    ctx.restore();
  },

  /**
   * Draw an active bomb on the ledge (e.g. Timer Bomb ticking)
   */
  drawBomb(ctx, bomb, now) {
    const spriteKey = `sprite_${bomb.card.id}`;
    const img = this.get(spriteKey);

    ctx.save();
    ctx.translate(bomb.x, bomb.y);

    const w = 40;
    const h = 44;

    // Team glow
    const teamBorder = bomb.player === 1 ? "#0284c7" : "#e11d48";
    ctx.beginPath();
    ctx.ellipse(0, 6, 16, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = bomb.player === 1 ? "rgba(2, 132, 199, 0.3)" : "rgba(225, 29, 72, 0.3)";
    ctx.fill();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -w / 2, -h + 8, w, h);
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(0, -h / 2, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // Timer Bomb Fuse Spark & Countdown
    if (bomb.card.id === "timer") {
      const remaining = Math.max(0, bomb.fuseTimer).toFixed(1);
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`⏱${remaining}s`, 0, -h - 8);

      // Sparking fuse
      const sparkCount = 4;
      for (let s = 0; s < sparkCount; s++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 6 + Math.random() * 8;
        ctx.fillStyle = Math.random() > 0.5 ? "#fbbf24" : "#ef4444";
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * dist, -h - 2 + Math.sin(angle) * dist, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  },

  /**
   * Draw a flying projectile in the air
   */
  drawFlyingProjectile(ctx, proj) {
    const spriteKey = `sprite_${proj.card.id}`;
    const img = this.get(spriteKey);

    ctx.save();
    ctx.translate(proj.x, proj.y);

    // Shadow on ground/mountain directly below
    // Rotation aligned with velocity or spin
    const angle = Math.atan2(proj.vy, proj.vx);
    ctx.rotate(angle);

    const size = 42;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = proj.player === 1 ? "#0284c7" : "#e11d48";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
};
