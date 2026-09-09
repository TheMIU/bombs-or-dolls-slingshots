/**
 * js/network.js - Online Multiplayer powered by Firebase Realtime Database for Slingshots Edition
 */

window.Network = {
  isOnline: false,
  isHost: false,
  myPlayer: null, // 1 (Blue) or 2 (Red), or null for local
  roomId: null,
  status: "offline", // "offline" | "hosting" | "connecting" | "connected"

  db: null,
  roomRef: null,
  actionsRef: null,
  syncRef: null,
  syncTimer: null,
  activeListeners: [],

  firebaseConfig: {
    apiKey: "AIzaSyDXi7b1AQrh-8JJ56YFc8Cb17ANjsPnSlI",
    authDomain: "bombs-or-dolls.firebaseapp.com",
    databaseURL: "https://bombs-or-dolls-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "bombs-or-dolls",
    storageBucket: "bombs-or-dolls.firebasestorage.app",
    messagingSenderId: "152507461295",
    appId: "1:152507461295:web:1f353e210066f4751d6e5a"
  },

  init() {
    try {
      if (typeof firebase !== "undefined") {
        if (!firebase.apps.length) {
          firebase.initializeApp(this.firebaseConfig);
        }
        this.db = firebase.database();
      }
    } catch (e) {
      console.warn("[Net] Firebase init:", e);
    }

    // Auto-join from URL parameter ?room=XYZ
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");
    if (roomParam) {
      const code = this.cleanRoomCode(roomParam);
      setTimeout(() => {
        this.openLobbyModal(code);
      }, 300);
    }
  },

  cleanRoomCode(raw) {
    if (!raw) return null;
    let str = String(raw).trim();
    if (!str) return null;

    if (str.includes("?")) {
      try {
        const queryPart = str.split("?")[1];
        const params = new URLSearchParams(queryPart);
        if (params.has("room")) {
          str = params.get("room").trim();
        }
      } catch (e) {}
    }

    str = str.replace(/^[/#?]+/, "").trim().toUpperCase();
    if (str.startsWith("BOD-")) return str;
    const match = str.match(/[A-Z0-9]{4}/);
    if (match) return "BOD-" + match[0];
    return str;
  },

  hostRoom() {
    this.disconnect();
    if (!this.db) {
      this.updateHostStatus("Firebase database not initialized.", "error");
      return;
    }

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "BOD-";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    this.roomId = code;
    this.status = "hosting";
    this.isHost = true;
    this.myPlayer = 1;

    this.updateStatusUI(`Waiting for Player 2... Room: ${this.roomId}`, "waiting");
    this.updateHostStatus("Registering room...", "waiting");

    this.roomRef = this.db.ref("rooms/" + code);
    this.actionsRef = this.roomRef.child("actions");
    this.syncRef = this.roomRef.child("sync");

    const initialData = {
      code: code,
      status: "waiting",
      hostOnline: true,
      guestOnline: false,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      flags: window.GameState.flags || [0, 0, 0, 0, 0, 0, 0, 0]
    };

    this.roomRef.set(initialData)
      .then(() => {
        this.updateStatusUI(`Waiting for Player 2... Room: ${this.roomId}`, "waiting");
        this.updateHostStatus("Ready! Share the code or link with your friend.", "waiting");
        this.updateLobbyUIHost(this.roomId);

        this.roomRef.child("hostOnline").onDisconnect().set(false);
        this.roomRef.child("status").onDisconnect().set("closed");

        // Listen for Guest joining
        const guestRef = this.roomRef.child("guestOnline");
        const onGuestChange = guestRef.on("value", (snap) => {
          const isGuestJoined = snap.val();
          if (isGuestJoined && !this.isOnline) {
            this.handleGuestConnected();
          } else if (isGuestJoined === false && this.isOnline) {
            this.updateStatusUI("⚠️ Player 2 left the match.", "error");
            window.GameSystem?.updateStatus?.("Player 2 disconnected.");
          }
        });
        this.activeListeners.push({ ref: guestRef, event: "value", callback: onGuestChange });

        // Listen for actions sent by Guest (Player 2)
        const onActionAdded = this.actionsRef.on("child_added", (snap) => {
          const action = snap.val();
          if (!action) return;
          if (action.player === 2) {
            this.handleIncomingData(action);
          }
        });
        this.activeListeners.push({ ref: this.actionsRef, event: "child_added", callback: onActionAdded });
      })
      .catch((err) => {
        this.updateStatusUI("Firebase error.", "error");
        this.updateHostStatus("Failed to create room.", "error");
      });
  },

  handleGuestConnected() {
    this.isOnline = true;
    this.status = "connected";
    this.updateStatusUI(`🟢 Connected to Player 2! (You: Blue Team)`, "connected");
    this.updateHostStatus("Connected to Player 2! Launching match...", "success");

    setTimeout(() => {
      this.closeLobbyModal();
    }, 600);

    document.getElementById("btn-pause")?.classList.add("hidden");
    window.GameState.aiEnabled = false;
    const botBtn = document.getElementById("btn-ai-toggle");
    if (botBtn) {
      botBtn.textContent = "🤖 Bot: OFF (Online)";
      botBtn.classList.remove("active");
    }

    const defaultCard = window.GameConfig.CARDS.find(c => c.id === "scout");
    window.GameState.loadedCard = [defaultCard, defaultCard];

    // Local reset only - DO NOT broadcast RESET packet (avoids infinite loop)
    window.GameSystem?.resetMatch?.(true);
    window.GameSystem?.renderDockCards?.();
    window.GameSystem?.updateStatus?.("Player 2 joined! You are Player 1 (Blue). Click ▶ Start Match or drag anywhere to launch!");

    this.send({
      type: "WELCOME",
      assignedPlayer: 2,
      mana: window.GameState.mana,
      flags: window.GameState.flags,
      config: {
        startMana: window.GameConfig.MANA.START,
        regenRate: window.GameConfig.MANA.REGEN_PER_SECOND,
        speedMultiplier: window.GameConfig.speedMultiplier,
        cardCosts: window.GameConfig.getCurrentCosts()
      }
    });

    this.startHostSync();
  },

  joinRoom(rawCode) {
    const cleanCode = this.cleanRoomCode(rawCode);
    if (!cleanCode || cleanCode.length < 4) {
      this.updateJoinStatus("Please enter a valid 4-character room code.", "error");
      return;
    }

    if (!this.db) {
      this.updateJoinStatus("Firebase database not initialized.", "error");
      return;
    }

    this.disconnect();
    this.roomId = cleanCode;
    this.status = "connecting";
    this.updateStatusUI(`Connecting to room ${cleanCode}...`, "waiting");
    this.updateJoinStatus(`Connecting to room ${cleanCode}...`, "waiting");

    const targetRoomRef = this.db.ref("rooms/" + cleanCode);
    targetRoomRef.once("value")
      .then((snap) => {
        if (!snap.exists()) {
          this.updateStatusUI(`Room ${cleanCode} not found`, "error");
          this.updateJoinStatus(`Room "${cleanCode}" was not found.`, "error");
          return;
        }

        const roomData = snap.val();
        if (roomData.guestOnline === true) {
          this.updateStatusUI("Room already full", "error");
          this.updateJoinStatus("This room already has 2 players!", "error");
          return;
        }

        this.roomRef = targetRoomRef;
        this.actionsRef = this.roomRef.child("actions");
        this.syncRef = this.roomRef.child("sync");

        this.isHost = false;
        this.isOnline = true;
        this.myPlayer = 2;
        this.status = "connected";

        return this.roomRef.update({
          guestOnline: true,
          status: "active"
        });
      })
      .then(() => {
        if (!this.isOnline) return;

        this.updateStatusUI(`🟢 Connected to Host! (You: Red Team)`, "connected");
        this.updateJoinStatus("Connected to Host! Entering match...", "success");

        setTimeout(() => {
          this.closeLobbyModal();
        }, 600);

        this.roomRef.child("guestOnline").onDisconnect().set(false);
        document.getElementById("btn-pause")?.classList.add("hidden");

        const onHostChange = this.roomRef.child("hostOnline").on("value", (snap) => {
          if (snap.val() === false && this.isOnline) {
            this.updateStatusUI("⚠️ Host disconnected.", "error");
            window.GameSystem?.updateStatus?.("Host disconnected.");
          }
        });
        this.activeListeners.push({ ref: this.roomRef.child("hostOnline"), event: "value", callback: onHostChange });

        const onActionAdded = this.actionsRef.on("child_added", (snap) => {
          const action = snap.val();
          if (!action) return;
          if (action.player === 1) {
            this.handleIncomingData(action);
          }
        });
        this.activeListeners.push({ ref: this.actionsRef, event: "child_added", callback: onActionAdded });

        const onSyncUpdate = this.syncRef.on("value", (snap) => {
          const syncData = snap.val();
          if (syncData) {
            this.handleSyncData(syncData);
          }
        });
        this.activeListeners.push({ ref: this.syncRef, event: "value", callback: onSyncUpdate });
      })
      .catch((err) => {
        this.updateStatusUI("Connection failed", "error");
        this.updateJoinStatus("Connection failed.", "error");
      });
  },

  send(data) {
    if (!this.actionsRef) return;
    try {
      const payload = {
        ...data,
        player: data.player || this.myPlayer || 1,
        ts: Date.now()
      };
      this.actionsRef.push(payload);
    } catch (e) {}
  },

  handleIncomingData(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case "LAUNCH": {
        const card = window.GameConfig.CARDS.find(c => c.id === data.cardId);
        if (card) {
          window.SlingshotSystem.launchRemote(data.player, card, data.pullX, data.pullY, data.targetCol, data.targetRow);
        }
        break;
      }

      case "WELCOME": {
        window.GameState.aiEnabled = false;
        const botBtn = document.getElementById("btn-ai-toggle");
        if (botBtn) {
          botBtn.textContent = "🤖 Bot: OFF (Online)";
          botBtn.classList.remove("active");
        }

        if (data.config) {
          window.GameConfig.applySettings(data.config, false);
        }
        if (data.flags) {
          window.GameState.flags = [...data.flags];
          window.GameSystem?.updateSummitFlagsUI?.();
        }

        const defaultCard = window.GameConfig.CARDS.find(c => c.id === "scout");
        window.GameState.loadedCard = [defaultCard, defaultCard];

        window.GameSystem?.resetMatch?.(true); // Local reset only - DO NOT broadcast
        window.GameSystem?.renderDockCards?.();
        window.GameSystem?.updateStatus?.("Connected to Host! You are Player 2 (Red). Click ▶ Start Match or drag anywhere to launch!");
        break;
      }

      case "FLAG_CLAIM": {
        window.GameSystem?.claimSummitFlag?.(data.player, null, true, data.flagIdx);
        break;
      }

      case "START_MATCH": {
        window.GameSystem?.startMatch?.(true); // Local start only - DO NOT re-broadcast
        break;
      }

      case "STOP_MATCH": {
        window.GameSystem?.stopMatch?.(true); // Local stop only - DO NOT re-broadcast
        break;
      }

      case "RESET": {
        window.GameSystem?.resetMatch?.(true); // Local reset only - DO NOT re-broadcast
        window.GameSystem?.updateStatus?.("Opponent restarted the match.");
        break;
      }

      case "CONFIG": {
        if (data.config) {
          window.GameConfig.applySettings(data.config, false);
        }
        break;
      }

      case "VICTORY": {
        window.GameSystem?.triggerSummitCompletion?.(data.winner, data.p1Count, data.p2Count, true);
        break;
      }
    }
  },

  startHostSync() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      if (!this.isOnline || !this.isHost || !this.syncRef) return;
      this.syncRef.set({
        mana: window.GameState.mana,
        flags: window.GameState.flags,
        matchTime: window.GameState.matchTimeSec,
        isStarted: window.GameState.isStarted
      });
    }, 1200);
  },

  handleSyncData(sync) {
    if (!this.isOnline || this.isHost) return;
    if (Array.isArray(sync.flags)) {
      window.GameState.flags = [...sync.flags];
      window.GameSystem?.updateSummitFlagsUI?.();
    }
    if (typeof sync.isStarted === "boolean" && window.GameState.isStarted !== sync.isStarted) {
      if (sync.isStarted) {
        window.GameSystem?.startMatch?.(true);
      } else {
        window.GameSystem?.stopMatch?.(true);
      }
    }
    if (typeof sync.matchTime === "number" && Math.abs(window.GameState.matchTimeSec - sync.matchTime) > 3) {
      window.GameState.matchTimeSec = sync.matchTime;
    }
  },

  disconnect() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    this.activeListeners.forEach(({ ref, event, callback }) => {
      try { ref.off(event, callback); } catch (e) {}
    });
    this.activeListeners = [];

    if (this.roomRef) {
      try {
        if (this.isHost) {
          this.roomRef.child("hostOnline").set(false);
          this.roomRef.child("status").set("closed");
        } else {
          this.roomRef.child("guestOnline").set(false);
        }
      } catch (e) {}
    }

    this.isOnline = false;
    this.isHost = false;
    this.myPlayer = null;
    this.roomId = null;
    this.status = "offline";
    this.roomRef = null;
    this.actionsRef = null;
    this.syncRef = null;

    this.updateStatusUI("👥 2-Player Local", "offline");
  },

  updateStatusUI(text, statusClass) {
    const pill = document.getElementById("net-status-pill");
    if (!pill) return;
    pill.textContent = text;
    pill.className = `net-status-pill ${statusClass}`;
  },

  openLobbyModal(prefillCode = null) {
    const modal = document.getElementById("online-modal");
    if (!modal) return;
    modal.classList.add("open");

    if (prefillCode) {
      this.switchLobbyTab("join");
      const input = document.getElementById("input-join-code");
      if (input) input.value = prefillCode;
    } else {
      this.switchLobbyTab("host");
    }
  },

  closeLobbyModal() {
    document.getElementById("online-modal")?.classList.remove("open");
  },

  switchLobbyTab(tab) {
    const hostTabBtn = document.getElementById("tab-host");
    const joinTabBtn = document.getElementById("tab-join");
    const hostPanel = document.getElementById("panel-host");
    const joinPanel = document.getElementById("panel-join");

    if (tab === "host") {
      hostTabBtn?.classList.add("active");
      joinTabBtn?.classList.remove("active");
      hostPanel?.classList.remove("hidden");
      joinPanel?.classList.add("hidden");
    } else {
      joinTabBtn?.classList.add("active");
      hostTabBtn?.classList.remove("active");
      joinPanel?.classList.remove("hidden");
      hostPanel?.classList.add("hidden");
    }
  },

  updateLobbyUIHost(code) {
    const codeEl = document.getElementById("host-room-code");
    const linkEl = document.getElementById("host-room-link");
    if (codeEl) codeEl.textContent = code;
    if (linkEl) {
      const base = window.location.origin + window.location.pathname;
      linkEl.value = `${base}?room=${code}`;
    }
  },

  updateHostStatus(msg, type) {
    const el = document.getElementById("host-status-msg");
    if (el) {
      el.innerHTML = msg;
      el.className = `lobby-status-msg ${type}`;
    }
  },

  updateJoinStatus(msg, type) {
    const el = document.getElementById("join-status-msg");
    if (el) {
      el.innerHTML = msg;
      el.className = `lobby-status-msg ${type}`;
    }
  }
};
