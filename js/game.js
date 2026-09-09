/**
 * js/game.js - Main Game Engine Loop, Canvas Renderer & UI Coordinator
 */

window.GameSystem = {
  canvas: null,
  ctx: null,
  bgImage: null,
  lastTimestamp: 0,
  loopHandle: null,

  init() {
    this.canvas = document.getElementById("game-canvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");

    // Load background image
    this.bgImage = new Image();
    this.bgImage.src = "assets/slingshot.png";

    // Initialize subsystems
    window.SpriteManager.init(() => {
      this.renderStatic();
    });

    window.SlingshotSystem.init();
    window.AISystem.init();
    this.bindUI();
    this.renderDockCards();
    this.updateManaUI();

    // Start 60fps loop
    this.lastTimestamp = performance.now();
    this.loopHandle = requestAnimationFrame(ts => this.loop(ts));

    // Auto-start match or ready state
    this.startMatch();
  },

  /**
   * Bind buttons in the UI
   */
  bindUI() {
    // Reset button
    document.getElementById("btn-reset")?.addEventListener("click", () => {
      this.resetMatch();
    });

    // Start / Resume button
    document.getElementById("btn-start")?.addEventListener("click", () => {
      this.startMatch();
    });

    // AI Bot Toggle
    const btnAi = document.getElementById("btn-ai-toggle");
    btnAi?.addEventListener("click", () => {
      window.GameState.aiEnabled = !window.GameState.aiEnabled;
      btnAi.classList.toggle("active", window.GameState.aiEnabled);
      btnAi.textContent = window.GameState.aiEnabled ? "🤖 Bot: ON" : "👥 2-Player Local";
      this.updateStatus(window.GameState.aiEnabled ? "AI Bot active for Player 2." : "2-Player Local mode: Both slingshots active!");
    });

    // Audio Toggle
    const btnAudio = document.getElementById("btn-audio-toggle");
    btnAudio?.addEventListener("click", () => {
      window.SoundFX.enabled = !window.SoundFX.enabled;
      btnAudio.textContent = window.SoundFX.enabled ? "🔊 Sound: ON" : "🔇 Sound: OFF";
    });

    // Victory modal play again button
    document.getElementById("btn-play-again")?.addEventListener("click", () => {
      document.getElementById("victory-modal")?.classList.remove("open");
      this.resetMatch();
    });

    // Window resize handler to maintain aspect ratio
    window.addEventListener("resize", () => {
      this.resizeCanvas();
    });
    this.resizeCanvas();
  },

  resizeCanvas() {
    // Keep canvas virtual coords at 1536 x 1024
    if (this.canvas) {
      this.canvas.width = window.GameConfig.CANVAS.WIDTH;
      this.canvas.height = window.GameConfig.CANVAS.HEIGHT;
    }
  },

  /**
   * Build the 8 card slots in the bottom dock matching slingshot.png
   */
  renderDockCards() {
    const bombsBox = document.getElementById("dock-bombs");
    const hikersBox = document.getElementById("dock-hikers");
    if (!bombsBox || !hikersBox) return;

    bombsBox.innerHTML = "";
    hikersBox.innerHTML = "";

    window.GameConfig.CARDS.forEach(card => {
      const cardEl = document.createElement("div");
      cardEl.className = "dock-card";
      cardEl.dataset.cardId = card.id;

      cardEl.innerHTML = `
        <div class="card-inner">
          <div class="cost-badge">${card.cost}</div>
          <img src="${card.sprite}" class="card-img" alt="${card.name}" draggable="false" />
          <div class="card-label">${card.name}</div>
        </div>
      `;

      cardEl.addEventListener("click", () => {
        this.selectCardForP1(card);
      });

      if (card.category === "bombs") {
        bombsBox.appendChild(cardEl);
      } else {
        hikersBox.appendChild(cardEl);
      }
    });

    // Pre-load Scout as default P1 weapon
    const defaultCard = window.GameConfig.CARDS.find(c => c.id === "scout");
    if (defaultCard) {
      window.GameState.loadedCard[0] = defaultCard;
    }
    this.updateCardsUI();
  },

  /**
   * Player 1 selects a card to load into their left slingshot
   */
  selectCardForP1(card) {
    if (window.GameState.isGameOver || window.GameState.isPaused) return;

    // Check mana
    if (window.GameState.mana[0] < card.cost) {
      this.updateStatus(`Not enough mana for ${card.name} (${card.cost}⚡ needed).`);
      return;
    }

    window.GameState.loadedCard[0] = card;
    this.updateCardsUI();
    this.updateStatus(`Loaded ${card.name} into Slingshot! Pull back and release to launch.`);
    window.SoundFX.playStretch(0.2);
  },

  /**
   * Auto-select an affordable card if player pulls slingshot without selecting
   */
  autoSelectCard(player) {
    const mana = window.GameState.mana[player - 1];
    const affordable = window.GameConfig.CARDS.filter(c => c.cost <= mana);
    if (affordable.length > 0) {
      window.GameState.loadedCard[player - 1] = affordable[0];
      this.updateCardsUI();
    }
  },

  /**
   * Update card UI state (selected, loaded, disabled if out of mana)
   */
  updateCardsUI() {
    const p1Mana = window.GameState.mana[0];
    const loaded = window.GameState.loadedCard[0];

    document.querySelectorAll(".dock-card").forEach(el => {
      const cardId = el.dataset.cardId;
      const card = window.GameConfig.CARDS.find(c => c.id === cardId);
      if (!card) return;

      const isLoaded = loaded && loaded.id === cardId;
      const isAffordable = p1Mana >= card.cost;

      el.classList.toggle("loaded", isLoaded);
      el.classList.toggle("disabled", !isAffordable);
    });
  },

  /**
   * Update top HUD mana bars and text matching slingshot.png
   */
  updateManaUI() {
    const p1Mana = window.GameState.mana[0];
    const p2Mana = window.GameState.mana[1];

    // P1 (Blue)
    const p1Fill = document.getElementById("p1-mana-fill");
    const p1Text = document.getElementById("p1-mana-text");
    if (p1Fill) p1Fill.style.width = `${(p1Mana / window.GameConfig.MANA.MAX) * 100}%`;
    if (p1Text) p1Text.textContent = `${Math.floor(p1Mana)} / 10`;

    // P2 (Red)
    const p2Fill = document.getElementById("p2-mana-fill");
    const p2Text = document.getElementById("p2-mana-text");
    if (p2Fill) p2Fill.style.width = `${(p2Mana / window.GameConfig.MANA.MAX) * 100}%`;
    if (p2Text) p2Text.textContent = `${Math.floor(p2Mana)} / 10`;

    this.updateCardsUI();
  },

  /**
   * Update status bar text
   */
  updateStatus(msg) {
    const statusEl = document.getElementById("game-status");
    if (statusEl) {
      statusEl.textContent = msg;
    }
  },

  /**
   * Start or resume match
   */
  startMatch() {
    window.GameState.isStarted = true;
    window.GameState.isPaused = false;
    this.updateStatus("Match in progress! Pull back your slingshot and aim for the summit!");
  },

  /**
   * Reset match to fresh state
   */
  resetMatch() {
    window.GameState.reset();
    // Default load Scout for P1
    window.GameState.loadedCard[0] = window.GameConfig.CARDS.find(c => c.id === "scout");
    this.updateManaUI();
    this.startMatch();
    this.updateStatus("Battle reset! Ready to fire!");
  },

  /**
   * Trigger Victory when a climber conquers the summit peak
   */
  triggerVictory(player, hiker) {
    window.GameState.isGameOver = true;
    window.GameState.isStarted = false;
    window.GameState.winner = player;

    window.SoundFX.playVictory();

    const modal = document.getElementById("victory-modal");
    const title = document.getElementById("victory-title");
    const desc = document.getElementById("victory-desc");

    if (title) {
      title.textContent = player === 1 ? "Player 1 (Blue) Conquered the Summit!" : "Player 2 (Red) Conquered the Summit!";
      title.style.color = player === 1 ? "#0284c7" : "#e11d48";
    }
    if (desc) {
      desc.textContent = `A ${hiker.card.name} reached the top flag first! 🏆`;
    }
    if (modal) {
      modal.classList.add("open");
    }
  },

  /**
   * Main 60fps game loop
   */
  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    if (window.GameState.isStarted && !window.GameState.isPaused && !window.GameState.isGameOver) {
      // 1. Regenerate mana
      const regen = window.GameConfig.MANA.REGEN_PER_SECOND * dt;
      const maxM = window.GameConfig.MANA.MAX;
      window.GameState.mana[0] = Math.min(maxM, window.GameState.mana[0] + regen);
      window.GameState.mana[1] = Math.min(maxM, window.GameState.mana[1] + regen);

      // 2. Update Slingshots
      window.SlingshotSystem.update(dt);

      // 3. Update Units
      window.UnitSystem.update(dt, timestamp / 1000);

      // 4. Update Bombs and Flying Projectiles
      window.BombSystem.update(dt);

      // 5. Update AI Bot
      window.AISystem.update(dt);

      // 6. Update Particles and Floating text
      this.updateEffects(dt);

      // 7. Update match timer
      window.GameState.matchTimeSec += dt;
      this.updateTimerUI();
    }

    // Render Canvas
    this.render(timestamp / 1000);
    this.updateManaUI();

    this.loopHandle = requestAnimationFrame(ts => this.loop(ts));
  },

  updateTimerUI() {
    const timerEl = document.getElementById("match-timer");
    if (timerEl) {
      const totalSec = Math.floor(window.GameState.matchTimeSec);
      const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
      const s = (totalSec % 60).toString().padStart(2, "0");
      timerEl.textContent = `⏱️ ${m}:${s}`;
    }
  },

  updateEffects(dt) {
    const state = window.GameState;

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 0) * dt;
    }

    // Floating combat texts
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const t = state.floatingTexts[i];
      t.life -= dt;
      if (t.life <= 0) {
        state.floatingTexts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
    }
  },

  renderStatic() {
    if (this.ctx && this.bgImage && this.bgImage.complete) {
      this.ctx.drawImage(this.bgImage, 0, 0, window.GameConfig.CANVAS.WIDTH, window.GameConfig.CANVAS.HEIGHT);
    }
  },

  /**
   * Render all canvas layers
   */
  render(now) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const W = window.GameConfig.CANVAS.WIDTH;
    const H = window.GameConfig.CANVAS.HEIGHT;

    // 1. Draw Mountain Background
    if (this.bgImage && this.bgImage.complete && this.bgImage.naturalWidth > 0) {
      ctx.drawImage(this.bgImage, 0, 0, W, H);
    } else {
      // Gradient sky fallback
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, "#93c5fd");
      skyGrad.addColorStop(1, "#e0f2fe");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Render Summit Peak Flag Wave Glow
    const peak = window.GameConfig.SUMMIT_PEAK;
    ctx.save();
    ctx.beginPath();
    ctx.arc(peak.flagX, peak.flagY, 24 + Math.sin(now * 4) * 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(251, 191, 36, 0.25)";
    ctx.fill();
    ctx.restore();

    // 3. Render Active Climbers
    window.GameState.units.forEach(u => {
      window.SpriteManager.drawHiker(ctx, u, now);
    });

    // 4. Render Active Ticking Bombs
    window.GameState.bombs.forEach(b => {
      window.SpriteManager.drawBomb(ctx, b, now);
    });

    // 5. Render Flying Projectiles
    window.GameState.projectiles.forEach(p => {
      window.SpriteManager.drawFlyingProjectile(ctx, p);
    });

    // 6. Render Slingshots, Rubber Bands & Aiming Trajectory
    window.SlingshotSystem.render(ctx);

    // 7. Render Particles (Explosions, Smoke Trails)
    const state = window.GameState;
    state.particles.forEach(p => {
      ctx.save();
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 8. Render Floating Combat Damage / Heal Text
    state.floatingTexts.forEach(t => {
      ctx.save();
      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      ctx.font = `900 ${t.size}px Fredoka, sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 6;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    });
  }
};

window.addEventListener("DOMContentLoaded", () => {
  window.GameSystem.init();
});
