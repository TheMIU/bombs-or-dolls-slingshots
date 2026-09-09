/**
 * js/game.js - Main Game Controller, 8 Summit Flags, Settings & Multiplayer Coordinator
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

    window.SpriteManager.init(() => {
      this.renderStatic();
    });

    window.SlingshotSystem.init();
    window.AISystem.init();
    window.Network?.init?.();

    this.bindUI();
    this.renderDockCards();
    this.updateManaUI();
    this.updateSummitFlagsUI();

    document.getElementById("btn-start")?.classList.remove("hidden");
    document.getElementById("btn-stop")?.classList.add("hidden");
    document.getElementById("btn-pause")?.classList.add("hidden");

    this.updateStatus("Ready! Adjust ⚙️ Settings or click ▶ Start Match to begin.");

    this.lastTimestamp = performance.now();
    this.loopHandle = requestAnimationFrame(ts => this.loop(ts));
  },

  bindUI() {
    // Start / Stop match buttons
    document.getElementById("btn-start")?.addEventListener("click", () => {
      this.startMatch();
    });

    document.getElementById("btn-stop")?.addEventListener("click", () => {
      this.stopMatch();
    });

    // Reset button
    document.getElementById("btn-reset")?.addEventListener("click", () => {
      this.resetMatch();
    });

    // Pause button
    const pauseBtn = document.getElementById("btn-pause");
    pauseBtn?.addEventListener("click", () => {
      window.GameState.isPaused = !window.GameState.isPaused;
      pauseBtn.textContent = window.GameState.isPaused ? "▶ Resume" : "⏸ Pause";
      this.updateStatus(window.GameState.isPaused ? "Game Paused." : "Game Resumed.");
    });

    // AI Bot Toggle
    const btnAi = document.getElementById("btn-ai-toggle");
    btnAi?.addEventListener("click", () => {
      window.GameState.aiEnabled = !window.GameState.aiEnabled;
      btnAi.classList.toggle("active", window.GameState.aiEnabled);
      btnAi.textContent = window.GameState.aiEnabled ? "🤖 Bot: ON" : "👥 2-Player Local";
      this.updateStatus(window.GameState.aiEnabled ? "AI Bot enabled for Player 2." : "2-Player Local mode: Both slingshots active!");
    });

    // Audio Toggle
    const btnAudio = document.getElementById("btn-audio-toggle");
    btnAudio?.addEventListener("click", () => {
      window.SoundFX.enabled = !window.SoundFX.enabled;
      btnAudio.textContent = window.SoundFX.enabled ? "🔊 Sound: ON" : "🔇 Sound: OFF";
    });

    // Online Multiplayer Lobby Modal
    document.getElementById("btn-online")?.addEventListener("click", () => {
      window.Network?.openLobbyModal?.();
    });

    document.querySelectorAll(".btn-close-online")?.forEach(btn => {
      btn.addEventListener("click", () => {
        window.Network?.closeLobbyModal?.();
      });
    });

    document.getElementById("tab-host")?.addEventListener("click", () => {
      window.Network?.switchLobbyTab?.("host");
    });
    document.getElementById("tab-join")?.addEventListener("click", () => {
      window.Network?.switchLobbyTab?.("join");
    });

    document.getElementById("btn-create-room")?.addEventListener("click", () => {
      window.Network?.hostRoom?.();
    });

    const joinBtn = document.getElementById("btn-join-room");
    const joinInput = document.getElementById("input-join-code");
    joinBtn?.addEventListener("click", () => {
      window.Network?.joinRoom?.(joinInput?.value);
    });
    joinInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        joinBtn?.click();
      }
    });

    document.getElementById("btn-copy-link")?.addEventListener("click", () => {
      const linkInput = document.getElementById("host-room-link");
      if (linkInput && linkInput.value) {
        navigator.clipboard.writeText(linkInput.value).then(() => {
          const btn = document.getElementById("btn-copy-link");
          if (btn) {
            const orig = btn.textContent;
            btn.textContent = "✅ Copied!";
            setTimeout(() => { btn.textContent = orig; }, 1800);
          }
        });
      }
    });

    document.getElementById("btn-disconnect-net")?.addEventListener("click", () => {
      window.Network?.disconnect?.();
      this.updateStatus("Disconnected. Returned to Local 2-Player mode.");
    });

    // Settings Modal
    document.getElementById("btn-settings")?.addEventListener("click", () => {
      this.openSettingsModal();
    });

    document.querySelectorAll(".btn-close-settings")?.forEach(btn => {
      btn.addEventListener("click", () => {
        document.getElementById("settings-modal")?.classList.remove("open");
      });
    });

    document.getElementById("btn-save-settings")?.addEventListener("click", () => {
      this.saveSettingsFromModal();
    });

    document.getElementById("btn-reset-defaults")?.addEventListener("click", () => {
      this.resetSettingsDefaults();
    });

    // Victory modal play again button
    document.getElementById("btn-play-again")?.addEventListener("click", () => {
      document.getElementById("victory-modal")?.classList.remove("open");
      this.resetMatch();
    });

    window.addEventListener("resize", () => {
      this.resizeCanvas();
    });
    this.resizeCanvas();
  },

  resizeCanvas() {
    if (this.canvas) {
      this.canvas.width = window.GameConfig.CANVAS.WIDTH;
      this.canvas.height = window.GameConfig.CANVAS.HEIGHT;
    }
  },

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
        const player = (window.Network && window.Network.isOnline) ? window.Network.myPlayer : 1;
        this.selectCard(player, card);
      });

      if (card.category === "bombs") {
        bombsBox.appendChild(cardEl);
      } else {
        hikersBox.appendChild(cardEl);
      }
    });

    const defaultCard = window.GameConfig.CARDS.find(c => c.id === "scout");
    if (defaultCard) {
      if (!window.GameState.loadedCard[0]) window.GameState.loadedCard[0] = defaultCard;
      if (!window.GameState.loadedCard[1]) window.GameState.loadedCard[1] = defaultCard;
    }
    this.updateCardsUI();
  },

  selectCard(player, card) {
    if (window.GameState.isGameOver || window.GameState.isPaused) return;

    if (window.GameState.mana[player - 1] < card.cost) {
      this.updateStatus(`Player ${player}: Not enough mana for ${card.name} (${card.cost}⚡ needed).`);
      return;
    }

    window.GameState.loadedCard[player - 1] = card;
    this.updateCardsUI();
    this.updateStatus(`Loaded ${card.name} into Slingshot! Pull back and release to launch.`);
    window.SoundFX.playStretch(0.2);
  },

  autoSelectCard(player) {
    const mana = window.GameState.mana[player - 1];
    const affordable = window.GameConfig.CARDS.filter(c => c.cost <= mana);
    if (affordable.length > 0) {
      window.GameState.loadedCard[player - 1] = affordable[0];
      this.updateCardsUI();
    }
  },

  updateCardsUI() {
    const player = (window.Network && window.Network.isOnline) ? window.Network.myPlayer : 1;
    const pMana = window.GameState.mana[player - 1];
    const loaded = window.GameState.loadedCard[player - 1];

    document.querySelectorAll(".dock-card").forEach(el => {
      const cardId = el.dataset.cardId;
      const card = window.GameConfig.CARDS.find(c => c.id === cardId);
      if (!card) return;

      const isLoaded = loaded && loaded.id === cardId;
      const isAffordable = pMana >= card.cost;

      el.classList.toggle("loaded", isLoaded);
      el.classList.toggle("disabled", !isAffordable);
    });
  },

  updateManaUI() {
    const p1Mana = window.GameState.mana[0];
    const p2Mana = window.GameState.mana[1];

    const p1Fill = document.getElementById("p1-mana-fill");
    const p1Text = document.getElementById("p1-mana-text");
    if (p1Fill) p1Fill.style.width = `${(p1Mana / window.GameConfig.MANA.MAX) * 100}%`;
    if (p1Text) p1Text.textContent = `${Math.floor(p1Mana)} / 10`;

    const p2Fill = document.getElementById("p2-mana-fill");
    const p2Text = document.getElementById("p2-mana-text");
    if (p2Fill) p2Fill.style.width = `${(p2Mana / window.GameConfig.MANA.MAX) * 100}%`;
    if (p2Text) p2Text.textContent = `${Math.floor(p2Mana)} / 10`;

    this.updateCardsUI();
  },

  /**
   * Update the 8 Summit Flags Progress Bar in top HUD
   */
  updateSummitFlagsUI() {
    const flags = window.GameState.flags || [0, 0, 0, 0, 0, 0, 0, 0];
    const track = document.getElementById("flags-track");
    const p1CountEl = document.getElementById("p1-flags-count");
    const p2CountEl = document.getElementById("p2-flags-count");

    const p1Count = flags.filter(f => f === 1).length;
    const p2Count = flags.filter(f => f === 2).length;

    if (p1CountEl) p1CountEl.textContent = p1Count;
    if (p2CountEl) p2CountEl.textContent = p2Count;

    if (track) {
      track.innerHTML = "";
      flags.forEach((f, idx) => {
        const flagSlot = document.createElement("div");
        flagSlot.className = `flag-slot ${f === 1 ? "claimed-p1" : (f === 2 ? "claimed-p2" : "neutral")}`;
        flagSlot.innerHTML = `<span class="flag-icon">${f === 1 ? "🚩" : (f === 2 ? "🚩" : "🏳️")}</span>`;
        flagSlot.title = `Summit Flag ${idx + 1}/8: ${f === 1 ? "Blue Team" : (f === 2 ? "Red Team" : "Neutral")}`;
        track.appendChild(flagSlot);
      });
    }
  },

  /**
   * Claim one of the 8 summit flags when a climber reaches Row 0
   */
  claimSummitFlag(player, hiker, isRemote = false, explicitFlagIdx = null) {
    if (window.GameState.isGameOver) return;

    const flags = window.GameState.flags;
    let targetIdx = explicitFlagIdx;

    if (targetIdx === null || targetIdx === undefined || targetIdx < 0 || targetIdx >= 8) {
      const hikerCol = hiker ? hiker.x : -1;
      const slot = window.MountainSystem.getFlagSlotIndex(hikerCol);

      if (slot !== -1 && flags[slot] === 0) {
        targetIdx = slot;
      } else {
        targetIdx = flags.findIndex(f => f === 0);
      }
    }

    if (targetIdx === -1 || flags[targetIdx] !== 0) {
      targetIdx = flags.findIndex(f => f === 0);
    }

    if (targetIdx === -1) return; // All 8 flags already claimed

    flags[targetIdx] = player;

    if (!isRemote && window.Network && window.Network.isOnline) {
      window.Network.send({
        type: "FLAG_CLAIM",
        player: player,
        hikerId: hiker?.id,
        flagIdx: targetIdx
      });
    }

    this.updateSummitFlagsUI();

    const p1Count = flags.filter(f => f === 1).length;
    const p2Count = flags.filter(f => f === 2).length;
    const totalClaimed = p1Count + p2Count;

    this.updateStatus(`🚩 ${player === 1 ? "Blue Team (P1)" : "Red Team (P2)"} claimed Flag ${totalClaimed}/8! (Blue: ${p1Count} - Red: ${p2Count})`);

    if (totalClaimed >= 8) {
      let winner = 0;
      if (p1Count > p2Count) winner = 1;
      else if (p2Count > p1Count) winner = 2;

      this.triggerSummitCompletion(winner, p1Count, p2Count);
    }
  },

  /**
   * Conclude match after all 8 flags are complete
   */
  triggerSummitCompletion(winner, p1Count, p2Count, isRemote = false) {
    window.GameState.isGameOver = true;
    window.GameState.isStarted = false;
    window.GameState.winner = winner;

    if (!isRemote && window.Network && window.Network.isOnline) {
      window.Network.send({
        type: "VICTORY",
        winner: winner,
        p1Count: p1Count,
        p2Count: p2Count
      });
    }

    document.getElementById("btn-start")?.classList.add("hidden");
    document.getElementById("btn-stop")?.classList.add("hidden");
    document.getElementById("btn-pause")?.classList.add("hidden");

    window.SoundFX.playVictory();

    const modal = document.getElementById("victory-modal");
    const trophy = document.getElementById("victory-trophy");
    const title = document.getElementById("victory-title");
    const desc = document.getElementById("victory-desc");

    if (winner === 1) {
      if (trophy) trophy.textContent = "🏆";
      if (title) {
        title.textContent = "Player 1 (Blue) Victorious!";
        title.style.color = "#0284c7";
      }
      if (desc) desc.textContent = `Blue conquered ${p1Count} of the 8 summit flags!`;
    } else if (winner === 2) {
      if (trophy) trophy.textContent = "🏆";
      if (title) {
        title.textContent = "Player 2 (Red) Victorious!";
        title.style.color = "#e11d48";
      }
      if (desc) desc.textContent = `Red conquered ${p2Count} of the 8 summit flags!`;
    } else {
      if (trophy) trophy.textContent = "🤝";
      if (title) {
        title.textContent = "Stalemate / Draw!";
        title.style.color = "#f59e0b";
      }
      if (desc) desc.textContent = `Both teams captured an equal 4 flags on the summit!`;
    }

    if (modal) modal.classList.add("open");
  },

  startMatch(isRemote = false) {
    if (window.GameState.isGameOver) return;
    window.GameState.isStarted = true;
    window.GameState.isPaused = false;

    if (!isRemote && window.Network && window.Network.isOnline) {
      window.Network.send({ type: "START_MATCH" });
    }

    const startBtn = document.getElementById("btn-start");
    const stopBtn = document.getElementById("btn-stop");
    const settingsBtn = document.getElementById("btn-settings");
    const pauseBtn = document.getElementById("btn-pause");

    if (startBtn) startBtn.classList.add("hidden");
    if (stopBtn) stopBtn.classList.remove("hidden");
    if (settingsBtn) settingsBtn.classList.add("hidden");

    if (pauseBtn) {
      if (window.Network && window.Network.isOnline) {
        pauseBtn.classList.add("hidden");
      } else {
        pauseBtn.classList.remove("hidden");
        pauseBtn.textContent = "⏸ Pause";
      }
    }

    this.updateStatus("Match started! Aim slingshots and race for the 8 summit flags!");
  },

  stopMatch(isRemote = false) {
    window.GameState.isStarted = false;

    if (!isRemote && window.Network && window.Network.isOnline) {
      window.Network.send({ type: "STOP_MATCH" });
    }

    const startBtn = document.getElementById("btn-start");
    const stopBtn = document.getElementById("btn-stop");
    const settingsBtn = document.getElementById("btn-settings");
    const pauseBtn = document.getElementById("btn-pause");

    if (startBtn) {
      startBtn.classList.remove("hidden");
      startBtn.textContent = window.GameState.matchTimeSec > 0 ? "▶ Resume Match" : "▶ Start Match";
    }
    if (stopBtn) stopBtn.classList.add("hidden");
    if (settingsBtn) settingsBtn.classList.remove("hidden");
    if (pauseBtn) pauseBtn.classList.add("hidden");

    this.updateStatus("Match stopped. Adjust settings or click ▶ Resume Match to continue.");
  },

  resetMatch(isRemote = false) {
    window.GameState.reset();
    const scout = window.GameConfig.CARDS.find(c => c.id === "scout");
    window.GameState.loadedCard[0] = scout;
    window.GameState.loadedCard[1] = scout;

    if (!isRemote && window.Network && window.Network.isOnline) {
      window.Network.send({ type: "RESET" });
    }

    document.getElementById("btn-start")?.classList.remove("hidden");
    document.getElementById("btn-stop")?.classList.add("hidden");
    document.getElementById("btn-settings")?.classList.remove("hidden");
    document.getElementById("btn-pause")?.classList.add("hidden");

    const startBtn = document.getElementById("btn-start");
    if (startBtn) startBtn.textContent = "▶ Start Match";

    this.updateManaUI();
    this.updateSummitFlagsUI();
    this.updateStatus("Match reset! Adjust ⚙️ Settings or click ▶ Start Match to begin.");
  },

  openSettingsModal() {
    const modal = document.getElementById("settings-modal");
    if (!modal) return;

    const speedSelect = document.getElementById("cfg-speed");
    if (speedSelect) speedSelect.value = window.GameConfig.speedMultiplier.toString();

    const startManaInput = document.getElementById("cfg-start-mana");
    if (startManaInput) startManaInput.value = window.GameConfig.MANA.START;

    const regenSelect = document.getElementById("cfg-regen-rate");
    if (regenSelect) regenSelect.value = window.GameConfig.MANA.REGEN_PER_SECOND.toString();

    window.GameConfig.CARDS.forEach(card => {
      const input = document.getElementById(`cfg-cost-${card.id}`);
      if (input) input.value = card.cost;
    });

    modal.classList.add("open");
  },

  saveSettingsFromModal() {
    const speedMultiplier = parseFloat(document.getElementById("cfg-speed")?.value || 1.0);
    const startMana = parseInt(document.getElementById("cfg-start-mana")?.value || 10, 10);
    const regenRate = parseFloat(document.getElementById("cfg-regen-rate")?.value || 0.35);

    const cardCosts = {};
    window.GameConfig.CARDS.forEach(card => {
      const input = document.getElementById(`cfg-cost-${card.id}`);
      if (input) cardCosts[card.id] = parseInt(input.value, 10);
    });

    const settingsObj = { speedMultiplier, startMana, regenRate, cardCosts };
    window.GameConfig.applySettings(settingsObj, true);

    if (window.GameState.matchTimeSec === 0 && window.GameState.units.length === 0) {
      window.GameState.mana = [startMana, startMana];
    }

    this.renderDockCards();
    this.updateManaUI();

    if (window.Network && window.Network.isOnline && window.Network.isHost) {
      window.Network.send({ type: "CONFIG", config: settingsObj });
    }

    document.getElementById("settings-modal")?.classList.remove("open");
    this.updateStatus("⚙️ Settings saved and applied!");
  },

  resetSettingsDefaults() {
    const defs = window.GameConfig.getDefaultSettings();
    window.GameConfig.applySettings(defs, true);
    this.openSettingsModal();
    this.renderDockCards();
    this.updateManaUI();
    this.updateStatus("⚙️ Settings restored to defaults.");
  },

  updateStatus(msg) {
    const statusEl = document.getElementById("game-status");
    if (statusEl) statusEl.textContent = msg;
  },

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    if (window.GameState.isStarted && !window.GameState.isPaused && !window.GameState.isGameOver) {
      const regen = window.GameConfig.MANA.REGEN_PER_SECOND * dt;
      const maxM = window.GameConfig.MANA.MAX;
      window.GameState.mana[0] = Math.min(maxM, window.GameState.mana[0] + regen);
      window.GameState.mana[1] = Math.min(maxM, window.GameState.mana[1] + regen);

      window.SlingshotSystem.update(dt);
      window.UnitSystem.update(dt);
      window.BombSystem.update(dt);
      window.AISystem.update(dt);

      this.updateEffects(dt);

      window.GameState.matchTimeSec += dt;
      this.updateTimerUI();
    }

    this.render(timestamp / 1000);
    this.updateManaUI();

    this.loopHandle = requestAnimationFrame(ts => this.loop(ts));
  },

  updateTimerUI() {
    const timerEl = document.getElementById("game-timer");
    if (timerEl) {
      const totalSec = Math.floor(window.GameState.matchTimeSec);
      const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
      const s = (totalSec % 60).toString().padStart(2, "0");
      timerEl.textContent = `⏱️ ${m}:${s}`;
    }
  },

  updateEffects(dt) {
    const state = window.GameState;

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
    if (this.ctx && window.MountainSystem) {
      window.MountainSystem.renderEnvironment(this.ctx, 0);
    }
  },

  render(now) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const W = window.GameConfig.CANVAS.WIDTH;
    const H = window.GameConfig.CANVAS.HEIGHT;

    // 1. Procedural Alpine Mountain & Environment Backdrop
    window.MountainSystem.renderEnvironment(ctx, now);

    // 2. Render 8 Summit Flags on Row 0
    window.SpriteManager.drawSummitFlagsOnMountain(ctx, now);

    // 3. Render Climbers
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

    // 6. Render Slingshots & Trajectory
    window.SlingshotSystem.render(ctx);

    // 7. Particles
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

    // 8. Floating Combat Texts
    state.floatingTexts.forEach(t => {
      ctx.save();
      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      ctx.font = `900 ${t.size}px Outfit, Fredoka, sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 6;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    });
  }
};

if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("DOMContentLoaded", () => {
    window.GameSystem.init();
  });
}
