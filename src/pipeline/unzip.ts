// Minimal ZIP reader (stored + deflate) on top of node:zlib. No dependencies.
import { inflateRawSync } from "node:zlib";
import { crc32 } from "../core/zip";

export interface ZipEntry {
  name: string;
  data: Buffer;
}

export function readZip(buf: Buffer, opts: { maxEntryBytes?: number; maxTotalBytes?: number } = {}): ZipEntry[] {
  const max = opts.maxEntryBytes ?? 256 * 1024 * 1024;
  const maxTotal = opts.maxTotalBytes ?? 512 * 1024 * 1024;
  let total = 0;
  // Find the End Of Central Directory record (it sits within the last 64 KiB + 22 bytes).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("zip: end of central directory not found");
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff) throw new Error("zip: zip64 archives are not supported");
  const out: ZipEntry[] = [];
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("zip: bad central directory entry");
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    if (name.includes("..") || name.startsWith("/") || name.includes("\\")) throw new Error(`zip: unsafe entry name ${name}`);
    if (size > max) throw new Error(`zip: entry ${name} is larger than ${max} bytes`);
    if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("zip: bad local header");
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compSize);
    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = inflateRawSync(raw, { maxOutputLength: max });
    else throw new Error(`zip: unsupported compression method ${method} for ${name}`);
    if (data.length !== size) throw new Error(`zip: size mismatch for ${name}`);
    if (crc32(data) !== crc) throw new Error(`zip: CRC mismatch for ${name}`);
    total += size;
    if (total > maxTotal) throw new Error(`zip: archive expands past ${maxTotal} bytes`);
    out.push({ name, data });
  }
  return out;
}
