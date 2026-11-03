// The page your Tube is rendered into. Edit freely: it's plain HTML in a template string.
// Everything from the data goes through esc() before it reaches the page.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const STANCE = { strong_rec: "Strong rec", rec: "Recommends", reference: "Cites it", critical: "Pushback", joke: "Joke" };

function comment(m) {
  const text = esc(m.x).replace(/\[VIDEO\]/g, '<span class="tag">this video</span>').replace(/\[LINK\]/g, '<span class="tag dim">link</span>');
  return `<li><span class="stance">${STANCE[m.st] ?? esc(m.st)}</span> ${text}
    <a class="by" href="https://news.ycombinator.com/item?id=${Number(m.id)}" rel="noopener noreferrer">${esc(m.a)} · ${esc(m.mo)}</a></li>`;
}

function card(r, i, details) {
  const v = r.video;
  const d = details[v.id];
  const why = d?.why ? `<p class="why">${esc(d.why)}</p>` : "";
  const comments = (d?.mentions ?? []).filter((m) => m.st === "rec" || m.st === "strong_rec").slice(0, 3).map(comment).join("");
  return `<article class="card">
  <button class="thumb" data-id="${esc(v.id)}" aria-label="Play ${esc(v.t)}">
    <img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="${i < 6 ? "eager" : "lazy"}" referrerpolicy="no-referrer">
    <span class="rank">${String(i + 1).padStart(2, "0")}</span>
  </button>
  <h2>${esc(v.t)}</h2>
  <p class="meta">${esc(v.c)} · ${v.r} HN recommender${v.r === 1 ? "" : "s"} · ${v.y0}–${v.y1}</p>
  <p class="reason">${esc(r.reasons[0]?.text ?? "")}</p>
  ${why || comments ? `<details><summary>Why HN recommends it</summary>${why}<ol>${comments}</ol></details>` : ""}
</article>`;
}

export function renderPage({ config, prefs, index, items, details }) {
  const names = new Map(index.topics.map((t) => [t.id, t.name]));
  const topics = Object.keys(prefs.topics).map((t) => `<li>${esc(names.get(t) ?? t)}</li>`).join("");
  const title = prefs.name || "My Tube";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https://i.ytimg.com; frame-src https://www.youtube-nocookie.com; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
  :root { --paper:#f4f1ea; --ink:#15130f; --muted:#6d695f; --hair:#d9d4c7; --marker:#f1e05a; }
  @media (prefers-color-scheme: dark) { :root { --paper:#12110e; --ink:#efebe1; --muted:#9a958a; --hair:#2e2c26; --marker:#e3d255; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:16px/1.5 ui-sans-serif, system-ui, sans-serif; }
  header, main, footer { max-width:1280px; margin:0 auto; padding:24px 20px; }
  h1 { font:400 clamp(44px,8vw,88px)/0.95 Georgia, serif; letter-spacing:-0.02em; margin:8px 0 16px; }
  .kicker, .meta { font:11px/1.4 ui-monospace, monospace; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); }
  ul.topics { display:flex; flex-wrap:wrap; gap:8px; list-style:none; padding:0; margin:0; }
  ul.topics li { background:var(--ink); color:var(--paper); border-radius:999px; padding:4px 12px; font-size:14px; }
  .grid { display:grid; gap:32px 20px; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); }
  .card h2 { font-size:15px; line-height:1.3; margin:10px 0 2px; }
  .thumb { position:relative; display:block; width:100%; aspect-ratio:16/9; padding:0; border:0; border-radius:3px; overflow:hidden; background:#000; cursor:pointer; }
  .thumb img, .thumb iframe { width:100%; height:100%; object-fit:cover; border:0; display:block; }
  .rank { position:absolute; left:0; top:0; background:var(--paper); color:var(--ink); font:11px ui-monospace, monospace; padding:2px 6px; }
  .reason { font-size:13px; color:var(--muted); margin:4px 0; }
  details { font-size:14px; margin-top:6px; } summary { cursor:pointer; font-weight:600; }
  details ol { padding-left:18px; } details li { margin:8px 0; }
  .why { margin:6px 0; } .stance { font-weight:600; }
  .tag { background:var(--marker); color:#15130f; font:11px ui-monospace, monospace; padding:0 4px; border-radius:2px; } .tag.dim { background:none; border:1px solid var(--hair); color:var(--muted); }
  .by { display:block; color:var(--muted); font-size:12.5px; }
  footer { color:var(--muted); font-size:13px; border-top:1px solid var(--hair); margin-top:48px; }
  a { color:inherit; }
</style>
</head>
<body>
<header>
  <p class="kicker">My own HackerTube</p>
  <h1>${esc(title)}</h1>
  <ul class="topics">${topics}</ul>
</header>
<main>
  <div class="grid">
${items.map((r, i) => card(r, i, details)).join("\n")}
  </div>
</main>
<footer>
  <p>${esc(index.source.attribution)} Licensed <a href="${esc(index.source.license_url)}">ODC-By 1.0</a>. Data exported ${esc(index.source.exported)}.</p>
  <p>Hacker News data is provided by Y Combinator; comments remain the work of their authors.</p>
  <p>Built from a TubeRemix config${/^https?:\/\//i.test(config.share_url ?? "") ? ` (<a href="${esc(config.share_url)}">original Tube</a>)` : ""}. Not affiliated with HackerTube, YouTube or Hacker News.</p>
</footer>
<script>
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".thumb[data-id]");
    if (!b) return;
    var id = b.getAttribute("data-id");
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
    f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    f.title = b.getAttribute("aria-label");
    var frame = document.createElement("div");
    frame.className = "thumb";
    frame.appendChild(f);
    b.replaceWith(frame);
  });
</script>
</body>
</html>
`;
}
