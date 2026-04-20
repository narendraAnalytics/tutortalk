/**
 * AudioWorklet processor for capturing audio and converting it to PCM16.
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      
      // We process the incoming data
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferIndex++] = channelData[i];
        
        if (this.bufferIndex >= this.bufferSize) {
          this.sendBuffer();
          this.bufferIndex = 0;
        }
      }
    }
    return true;
  }

  sendBuffer() {
    // Convert Float32Array to Int16Array (PCM16)
    const pcm16 = new Int16Array(this.bufferSize);
    for (let i = 0; i < this.bufferSize; i++) {
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
  }
}

registerProcessor('capture-processor', CaptureProcessor);
