// Reads a little-endian float16 or float32 2-D .npy matrix into a Float32Array.

function halfToFloat(h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  let v: number;
  if (e === 0) v = f * 2 ** -24;
  else if (e === 0x1f) v = f ? NaN : Infinity;
  else v = (1 + f / 1024) * 2 ** (e - 15);
  return s ? -v : v;
}

export function readNpy(buf: Buffer): { rows: number; cols: number; data: Float32Array } {
  if (buf.readUInt8(0) !== 0x93 || buf.subarray(1, 6).toString("latin1") !== "NUMPY") throw new Error("npy: bad magic");
  const major = buf.readUInt8(6);
  const headerLen = major === 1 ? buf.readUInt16LE(8) : buf.readUInt32LE(8);
  const headerStart = major === 1 ? 10 : 12;
  const header = buf.subarray(headerStart, headerStart + headerLen).toString("latin1");
  const descr = /'descr':\s*'([^']+)'/.exec(header)?.[1];
  const fortran = /'fortran_order':\s*(True|False)/.exec(header)?.[1];
  const shape = /'shape':\s*\((\d+),\s*(\d+)\)/.exec(header);
  if (!descr || !shape || fortran !== "False") throw new Error(`npy: unsupported header ${header}`);
  const rows = Number(shape[1]);
  const cols = Number(shape[2]);
  const off = headerStart + headerLen;
  const data = new Float32Array(rows * cols);
  if (descr === "<f2") {
    for (let i = 0; i < data.length; i++) data[i] = halfToFloat(buf.readUInt16LE(off + i * 2));
  } else if (descr === "<f4") {
    for (let i = 0; i < data.length; i++) data[i] = buf.readFloatLE(off + i * 4);
  } else {
    throw new Error(`npy: unsupported dtype ${descr}`);
  }
  return { rows, cols, data };
}
