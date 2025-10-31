// Base64 decoding function
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Raw PCM to AudioBuffer decoding function
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


export class AudioPlayer {
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private onEndedCallback: (() => void) | null = null;
  
  constructor(private base64Audio: string) {
    // Gemini TTS sample rate is 24000
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }

  async load() {
    if (this.audioBuffer) return;
    const decoded = decode(this.base64Audio);
    // Gemini TTS is 24000Hz, 1 channel (mono)
    this.audioBuffer = await decodeAudioData(decoded, this.audioContext, 24000, 1);
  }

  play() {
    if (!this.audioBuffer) {
      console.error("Audio not loaded yet.");
      return;
    }
    if (this.sourceNode) {
        this.stop();
    }
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.audioContext.destination);
    
    this.sourceNode.onended = () => {
      this.sourceNode = null;
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    };
    
    this.sourceNode.start();
  }

  stop() {
    if (this.sourceNode) {
      this.sourceNode.onended = null; // Prevent onEnded from firing on manual stop
      this.sourceNode.stop();
      this.sourceNode = null;
    }
  }
  
  onEnded(callback: () => void) {
    this.onEndedCallback = callback;
  }
}
