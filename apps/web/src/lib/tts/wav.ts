// WAV encoder for in-browser Kokoro output.
//
// Kokoro produces a Float32 PCM array at 24 kHz mono. This encoder
// wraps that into a 16-bit PCM WAV file the user can play back in the
// `<audio>` element and that B2 can serve directly with the right
// content-type.

const HEADER_BYTES = 44;
const PCM_FORMAT = 1; // linear PCM
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;

export interface EncodeOptions {
  sampleRate?: number; // default 24000 (Kokoro)
}

export function encodeWav(
  samples: Float32Array,
  options: EncodeOptions = {},
): Blob {
  const sampleRate = options.sampleRate ?? 24000;
  const byteRate = (sampleRate * NUM_CHANNELS * BITS_PER_SAMPLE) / 8;
  const blockAlign = (NUM_CHANNELS * BITS_PER_SAMPLE) / 8;
  const dataLength = samples.length * 2; // 16-bit
  const buffer = new ArrayBuffer(HEADER_BYTES + dataLength);
  const view = new DataView(buffer);

  // RIFF header
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, "WAVE");

  // fmt chunk
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, PCM_FORMAT, true);
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);

  // data chunk
  writeAscii(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // PCM samples
  let offset = HEADER_BYTES;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/** Compute the audio duration in ms for a sample buffer at a given rate. */
export function durationMs(samples: Float32Array, sampleRate = 24000): number {
  return Math.round((samples.length / sampleRate) * 1000);
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}
