// Source adapters: where community recommendations come from.
// Only adapters with status "supported" are wired into the import. New sources
// implement this interface; nothing is listed here until it actually works.
import { readNpy } from "./npy";
import {
  parseJsonl, UpstreamMention, UpstreamRelated, UpstreamTaxonomy, UpstreamVideo,
} from "./schema";
import { readZip } from "./unzip";

export interface SourceLicense {
  id: string; // SPDX-style id
  url: string;
  attribution: string;
}

/** What every adapter must hand to the normaliser. */
export interface SourceBundle {
  videos: UpstreamVideo[];
  mentions: UpstreamMention[];
  related: UpstreamRelated[];
  taxonomy: UpstreamTaxonomy;
  embeddings: { ids: string[]; rows: number; cols: number; data: Float32Array } | null;
  exported: string;
}

export interface SourceAdapter {
  id: string;
  name: string;
  homepage: string;
  dataUrl: string;
  license: SourceLicense;
  /** Parses the raw download (already integrity-checked by the caller). */
  parse(raw: Buffer): SourceBundle;
}

export const hackertube: SourceAdapter = {
  id: "hackertube",
  name: "HackerTube",
  homepage: "https://hackertube.org",
  dataUrl: "https://hackertube.org/download/hackertube-data.zip",
  license: {
    id: "ODC-By-1.0",
    url: "https://opendatacommons.org/licenses/by/1-0/",
    attribution:
      "Data from HackerTube (https://hackertube.org) by Andrej Karpathy, derived from the open-index/hacker-news archive (https://huggingface.co/datasets/open-index/hacker-news). Hacker News comments remain the work of their authors; video titles and channel names belong to their creators.",
  },
  parse(raw) {
    const entries = readZip(raw);
    const file = (suffix: string) => {
      const e = entries.find((x) => x.name === suffix || x.name.endsWith(`/${suffix}`));
      if (!e) throw new Error(`hackertube: ${suffix} missing from archive`);
      return e.data;
    };
    const videos = parseJsonl(file("videos.jsonl").toString("utf8"), UpstreamVideo, "videos.jsonl");
    const mentions = parseJsonl(file("mentions.jsonl").toString("utf8"), UpstreamMention, "mentions.jsonl");
    const related = parseJsonl(file("related.jsonl").toString("utf8"), UpstreamRelated, "related.jsonl");
    const taxRaw = JSON.parse(file("taxonomy.json").toString("utf8"));
    const taxonomy = UpstreamTaxonomy.parse(taxRaw);
    let embeddings: SourceBundle["embeddings"] = null;
    const npy = entries.find((x) => x.name.endsWith("embeddings.npy"));
    const ids = entries.find((x) => x.name.endsWith("embedding_ids.json"));
    if (npy && ids) {
      const m = readNpy(npy.data);
      const idList = JSON.parse(ids.data.toString("utf8"));
      if (!Array.isArray(idList) || idList.length !== m.rows || !idList.every((x) => typeof x === "string")) {
        throw new Error("hackertube: embedding_ids.json does not match embeddings.npy");
      }
      embeddings = { ids: idList, ...m };
    }
    const md = file("DATA.md").toString("utf8");
    const exported = /Exported (\d{4}-\d{2}-\d{2})/.exec(md)?.[1] ?? "unknown";
    return { videos, mentions, related, taxonomy, embeddings, exported };
  },
};

/** Registry of supported sources. Add yours here once it imports end to end. */
export const SOURCES: readonly SourceAdapter[] = [hackertube];
