/**
 * AudioWorklet processor — runs on the dedicated audio thread.
 * Accumulates Float32 mic samples into 2048-sample chunks before
 * converting to Int16 (PCM16) and posting to the main thread.
 * 2048 samples @ 16kHz = 128ms — large enough for Gemini Live VAD.
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // mono, 128 samples per call

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];

      if (this.bufferIndex >= this.bufferSize) {
        this._flush();
        this.bufferIndex = 0;
      }
    }

    return true;
  }

  _flush() {
    const pcm16 = new Int16Array(this.bufferSize);
    for (let i = 0; i < this.bufferSize; i++) {
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
  }
}

registerProcessor('capture-processor', CaptureProcessor);
