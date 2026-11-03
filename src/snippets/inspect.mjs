// node inspect.mjs hackertube-data
// Peek at the HackerTube export: how many videos, and the most-recommended ones.
import { readFileSync } from "node:fs";

const dir = process.argv[2] ?? "hackertube-data";
const lines = (f) => readFileSync(`${dir}/${f}`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

const videos = lines("videos.jsonl");
const mentions = lines("mentions.jsonl");
const recommended = videos.filter((v) => v.hn.recommenders > 0);
console.log(`${videos.length} videos, ${recommended.length} recommended by at least one HN commenter`);
console.log(`${mentions.length} labeled comments`);

for (const v of recommended.slice(0, 5)) {
  console.log(`${String(v.score).padStart(4)}  ${v.title} (${v.channel})`);
}
