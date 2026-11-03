// Entry for the starter project's bundled library (starter/lib/tuberemix.mjs).
// It is the same import pipeline and ranking code the TubeRemix site runs.
export { readZip } from "./pipeline/unzip";
export { hackertube } from "./pipeline/sources";
export { buildCatalog, FILTERS } from "./pipeline/build";
export { rankFeed, emptySignals, W as WEIGHTS } from "./core/rank";
export { rankContext, loadDetail, thumbUrl, hnItemUrl, youtubeUrl } from "./core/catalog";
export { sanitizePrefs, defaultPrefs } from "./core/prefs";
export { configToPrefsInput } from "./core/exporters";
