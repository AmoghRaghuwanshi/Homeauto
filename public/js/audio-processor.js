/*
 * AudioWorklet Processor — captures mic audio, downsamples to 16kHz mono PCM,
 * runs simple Voice Activity Detection (VAD), and sends active audio to main thread.
 */
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.vadThreshold = 0.008;
    this.silenceCount = 0;
    this.maxSilenceCount = 15; // ~1s of silence before stopping
    this.isSpeaking = false;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];

      if (this.bufferIndex >= this.bufferSize) {
        // Calculate RMS energy for VAD
        let energy = 0;
        for (let j = 0; j < this.bufferSize; j++) {
          energy += this.buffer[j] * this.buffer[j];
        }
        energy = Math.sqrt(energy / this.bufferSize);

        // VAD logic
        if (energy > this.vadThreshold) {
          this.isSpeaking = true;
          this.silenceCount = 0;
        } else if (this.isSpeaking) {
          this.silenceCount++;
          if (this.silenceCount > this.maxSilenceCount) {
            this.isSpeaking = false;
          }
        }

        if (this.isSpeaking) {
          // Downsample from native rate to 16kHz
          const downsampled = this._downsample(this.buffer, sampleRate, 16000);
          // Convert float32 to int16
          const int16 = this._floatToInt16(downsampled);
          this.port.postMessage({ audio: int16.buffer, speaking: true }, [int16.buffer]);
        } else {
          this.port.postMessage({ audio: null, speaking: false });
        }

        this.bufferIndex = 0;
      }
    }

    return true;
  }

  _downsample(buffer, fromRate, toRate) {
    if (fromRate === toRate) {
      return new Float32Array(buffer);
    }
    const ratio = fromRate / toRate;
    const newLen = Math.floor(buffer.length / ratio);
    const result = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      result[i] = buffer[Math.floor(i * ratio)];
    }
    return result;
  }

  _floatToInt16(buffer) {
    const result = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return result;
  }
}

registerProcessor('audio-processor', AudioProcessor);
