/*
 * ═══════════════════════════════════════════════════════════
 *  Voice Client — Always-Listening "Hey Shrimaan"
 *  Captures mic audio, streams to server via WebSocket,
 *  displays live transcript, manages permissions
 * ═══════════════════════════════════════════════════════════
 */
const Voice = {
  ws: null,
  audioContext: null,
  mediaStream: null,
  workletNode: null,
  sourceNode: null,
  isListening: false,
  isConnected: false,
  hasMicPermission: false,
  reconnectDelay: 2000,
  reconnectTimer: null,

  // ─── Initialise ──────────────────────────────────────────
  async init() {
    console.log('[Voice] Initialising...');
    this._createUI();
    await this._checkMicPermission();

    if (this.hasMicPermission) {
      this._hideMicModal();
      await this.startListening();
    } else {
      this._showMicModal();
    }
  },

  // ─── Check Mic Permission ───────────────────────────────
  async _checkMicPermission() {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'microphone' });
        this.hasMicPermission = status.state === 'granted';
        status.onchange = () => {
          this.hasMicPermission = status.state === 'granted';
          if (this.hasMicPermission) {
            this._hideMicModal();
            this.startListening();
          }
        };
      }
    } catch (e) {
      // Permissions API not supported, try getUserMedia directly
      console.log('[Voice] Permissions API not available, will request directly');
    }
  },

  // ─── Request Mic Permission ─────────────────────────────
  async requestMicPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop()); // Release immediately
      this.hasMicPermission = true;
      this._hideMicModal();
      await this.startListening();
    } catch (err) {
      console.error('[Voice] Mic permission denied:', err);
      this._updateMicModal('denied');
    }
  },

  // ─── Start Always-Listening ─────────────────────────────
  async startListening() {
    if (this.isListening) return;

    try {
      // Get mic stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create AudioContext
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.mediaStream.getAudioTracks()[0].getSettings().sampleRate || 44100,
      });

      // Try AudioWorklet first, fall back to ScriptProcessor
      try {
        await this.audioContext.audioWorklet.addModule('/js/audio-processor.js');
        this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
        this.workletNode.port.onmessage = (event) => this._onAudioData(event.data);
      } catch (e) {
        console.warn('[Voice] AudioWorklet not supported, using ScriptProcessor fallback');
        this._setupScriptProcessor();
      }

      // Connect mic → processor
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.workletNode || this.scriptProcessor);

      // Connect to voice WebSocket
      this._connectWS();

      this.isListening = true;
      this._updateUI('listening');
      console.log('[Voice] ✅ Always-listening active');

    } catch (err) {
      console.error('[Voice] Failed to start listening:', err);
      this._updateUI('error');
    }
  },

  // ─── ScriptProcessor Fallback ───────────────────────────
  _setupScriptProcessor() {
    const bufferSize = 4096;
    this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
    this.vadThreshold = 0.008;
    this.silenceCount = 0;
    this.isSpeaking = false;

    this.scriptProcessor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);

      // VAD
      let energy = 0;
      for (let i = 0; i < input.length; i++) energy += input[i] * input[i];
      energy = Math.sqrt(energy / input.length);

      if (energy > this.vadThreshold) {
        this.isSpeaking = true;
        this.silenceCount = 0;
      } else if (this.isSpeaking) {
        this.silenceCount++;
        if (this.silenceCount > 15) this.isSpeaking = false;
      }

      if (this.isSpeaking) {
        const downsampled = this._downsample(input, this.audioContext.sampleRate, 16000);
        const int16 = this._floatToInt16(downsampled);
        this._onAudioData({ audio: int16.buffer, speaking: true });
      } else {
        this._onAudioData({ audio: null, speaking: false });
      }
    };

    // Connect to output (required for ScriptProcessor to work)
    this.scriptProcessor.connect(this.audioContext.destination);
  },

  _downsample(buffer, fromRate, toRate) {
    if (fromRate === toRate) return buffer;
    const ratio = fromRate / toRate;
    const newLen = Math.floor(buffer.length / ratio);
    const result = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) result[i] = buffer[Math.floor(i * ratio)];
    return result;
  },

  _floatToInt16(buffer) {
    const result = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return result;
  },

  // ─── Audio Data Callback ────────────────────────────────
  _onAudioData(data) {
    if (data.speaking) {
      this._updateUI('speaking');
    }

    if (data.audio && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data.audio);
    }

    if (!data.speaking && !data.audio) {
      // Silence — keep listening indicator but dim it
      if (this.isListening) this._updateUI('listening');
    }
  },

  // ─── Voice WebSocket ────────────────────────────────────
  _connectWS() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/voice`;
    console.log('[Voice] Connecting WS:', url);

    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log('[Voice] WebSocket connected');
      this.isConnected = true;
      this.reconnectDelay = 2000;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleServerMessage(msg);
      } catch (e) { /* binary response, ignore */ }
    };

    this.ws.onclose = () => {
      console.log('[Voice] WebSocket closed');
      this.isConnected = false;
      this._reconnectWS();
    };

    this.ws.onerror = (err) => {
      console.error('[Voice] WebSocket error');
      this.ws.close();
    };
  },

  _reconnectWS() {
    this.reconnectTimer = setTimeout(() => {
      if (this.isListening) {
        console.log('[Voice] Reconnecting...');
        this._connectWS();
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 15000);
      }
    }, this.reconnectDelay);
  },

  // ─── Handle Server Messages ─────────────────────────────
  _handleServerMessage(msg) {
    switch (msg.type) {
      case 'voice_ready':
        console.log('[Voice] Server ready');
        break;

      case 'partial':
        this._updateTranscript(msg.text, false);
        break;

      case 'transcript':
        this._updateTranscript(msg.text, true);
        break;

      case 'wake_word':
        this._updateUI('wake');
        this._showCommandFeedback(`🎙️ Listening... "${msg.command}"`);
        break;

      case 'voice_result':
        if (msg.success) {
          this._showCommandFeedback(`✅ ${msg.message}`);
          this._updateUI('success');
        } else {
          this._showCommandFeedback(`❌ ${msg.error || 'Could not understand'}`);
          this._updateUI('error');
        }
        // Reset after feedback
        setTimeout(() => this._updateUI('listening'), 2500);
        break;

      case 'voice_error':
        console.error('[Voice] Server error:', msg.error);
        this._showCommandFeedback(`⚠️ ${msg.error}`);
        break;
    }
  },

  // ─── UI Creation ────────────────────────────────────────
  _createUI() {
    // Floating mic button
    const micBtn = document.createElement('button');
    micBtn.id = 'voice-mic-btn';
    micBtn.className = 'voice-mic-btn';
    micBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
      <div class="voice-mic-btn__rings">
        <div class="voice-mic-btn__ring"></div>
        <div class="voice-mic-btn__ring"></div>
        <div class="voice-mic-btn__ring"></div>
      </div>
    `;
    micBtn.title = 'Voice Assistant — Hey Shrimaan';
    micBtn.addEventListener('click', () => {
      if (!this.hasMicPermission) {
        this._showMicModal();
      } else if (!this.isListening) {
        this.startListening();
      }
    });
    document.body.appendChild(micBtn);

    // Transcript bar
    const transcript = document.createElement('div');
    transcript.id = 'voice-transcript';
    transcript.className = 'voice-transcript';
    transcript.innerHTML = `
      <div class="voice-transcript__inner">
        <span class="voice-transcript__icon">🎙️</span>
        <span class="voice-transcript__text" id="voice-transcript-text"></span>
      </div>
    `;
    document.body.appendChild(transcript);

    // Command feedback
    const feedback = document.createElement('div');
    feedback.id = 'voice-feedback';
    feedback.className = 'voice-feedback';
    document.body.appendChild(feedback);

    // Mic permission modal
    const modal = document.createElement('div');
    modal.id = 'mic-permission-modal';
    modal.className = 'mic-modal';
    modal.innerHTML = `
      <div class="mic-modal__overlay"></div>
      <div class="mic-modal__content">
        <div class="mic-modal__icon">🎙️</div>
        <h2 class="mic-modal__title">Enable Microphone</h2>
        <p class="mic-modal__text">
          Home Control needs microphone access for <strong>"Hey Shrimaan"</strong> voice commands.
          <br>Your audio is processed <strong>locally</strong> — nothing is sent to the cloud.
        </p>
        <p class="mic-modal__text mic-modal__text--denied" id="mic-denied-text" style="display:none;">
          ⚠️ Microphone access was denied. Please enable it in your browser settings and reload.
        </p>
        <button class="btn btn--primary mic-modal__btn" id="btn-grant-mic">Grant Microphone Access</button>
        <button class="btn btn--ghost mic-modal__dismiss" id="btn-dismiss-mic">Later</button>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-grant-mic').addEventListener('click', () => this.requestMicPermission());
    document.getElementById('btn-dismiss-mic').addEventListener('click', () => this._hideMicModal());
  },

  // ─── UI Updates ─────────────────────────────────────────
  _showMicModal() {
    const modal = document.getElementById('mic-permission-modal');
    if (modal) modal.classList.add('mic-modal--visible');
  },

  _hideMicModal() {
    const modal = document.getElementById('mic-permission-modal');
    if (modal) modal.classList.remove('mic-modal--visible');
  },

  _updateMicModal(state) {
    if (state === 'denied') {
      const denied = document.getElementById('mic-denied-text');
      if (denied) denied.style.display = 'block';
    }
  },

  _updateUI(state) {
    const btn = document.getElementById('voice-mic-btn');
    if (!btn) return;
    // Remove all state classes
    btn.className = 'voice-mic-btn';
    switch (state) {
      case 'listening':
        btn.classList.add('voice-mic-btn--listening');
        break;
      case 'speaking':
        btn.classList.add('voice-mic-btn--speaking');
        break;
      case 'wake':
        btn.classList.add('voice-mic-btn--wake');
        break;
      case 'success':
        btn.classList.add('voice-mic-btn--success');
        break;
      case 'error':
        btn.classList.add('voice-mic-btn--error');
        break;
    }
  },

  _updateTranscript(text, isFinal) {
    const el = document.getElementById('voice-transcript-text');
    const container = document.getElementById('voice-transcript');
    if (!el || !container) return;

    el.textContent = text;
    container.classList.add('voice-transcript--visible');

    // Hide after 3 seconds of no updates for final results
    if (isFinal) {
      clearTimeout(this._transcriptTimer);
      this._transcriptTimer = setTimeout(() => {
        container.classList.remove('voice-transcript--visible');
      }, 3000);
    }
  },

  _showCommandFeedback(message) {
    const el = document.getElementById('voice-feedback');
    if (!el) return;
    el.textContent = message;
    el.classList.add('voice-feedback--visible');

    clearTimeout(this._feedbackTimer);
    this._feedbackTimer = setTimeout(() => {
      el.classList.remove('voice-feedback--visible');
    }, 3000);
  },

  // ─── Stop ───────────────────────────────────────────────
  stopListening() {
    this.isListening = false;
    if (this.ws) this.ws.close();
    if (this.workletNode) this.workletNode.disconnect();
    if (this.scriptProcessor) this.scriptProcessor.disconnect();
    if (this.sourceNode) this.sourceNode.disconnect();
    if (this.mediaStream) this.mediaStream.getTracks().forEach(t => t.stop());
    if (this.audioContext) this.audioContext.close();
    this._updateUI('idle');
  },
};
