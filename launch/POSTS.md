# X launch copy

`[LINK]` = the live TubeRemix URL once deployed (X counts any link as 23 characters). `[REPO]` = the
GitHub repo once public. Nothing here has been posted. Every number is from the shipped data
(`public/data/index.json`), the live share card, or Karpathy's own post, checked 2026-11-03. Each post
fits in 280 characters (count shown).

## Five candidates

**1. Karpathy reference** (280 chars)
> Karpathy had Claude read 43M HN comments to build HackerTube, then published the data so anyone could make their own.
>
> This is the "make your own" part: pick a few interests, get a feed of the videos HN commenters recommended, comments attached. No login.
>
> [LINK]

**2. Builder tutorial** (266)
> Build your own HackerTube in 2 minutes:
>
> 1. pick topics at [LINK]
> 2. Share & export → Starter project
> 3. node build.mjs
>
> It downloads the open HackerTube data, checks its sha256, ranks it with your config and writes a static site. Zero dependencies.

**3. Consumer pain point** (274)
> YouTube's feed is tuned for your next click.
>
> Hacker News spent 19 years telling each other which talks and documentaries were worth an hour. TubeRemix turns that into your own feed, with receipts: every video shows the comments that recommended it.
>
> [LINK]

**4. Open-source announcement** (278)
> TubeRemix is open source (MIT): a remixable front end for the HackerTube dataset.
>
> · ranking you can read in one file
> · share links that are the config, no database
> · share cards from real thumbnails
> · a zero-dependency starter
>
> Data: HackerTube (ODC-By)
> [REPO]

**5. Surprising demo, with the video** (274)
> Tap "Machine learning", "Functional programming", "Fundamental physics".
>
> The grid re-sorts itself into your own HackerTube, live, from the 437 videos HN commenters recommended in those topics. Open one and you get their actual comments.
>
> Make yours: [LINK]

Attach `launch/media/demo-interests-to-feed.mp4`.

## Pick: #5 as the main post

#5 shows the product instead of describing it. The short clip *is* the signature moment (three taps,
and the grid visibly reorganises into a real feed), it needs no context, and it lands with people who
just saw Karpathy's version in the same conversation. It makes one claim a viewer can check in ten
seconds. #1 carries the story (he published the data; this is the "make your own" part), which is why
the reply under his post is built from it.

## Thread under the main post

1. *(#5 with the clip)*
2. (186)
> Every video has receipts: who on HN recommended it and why, verbatim, with links to the threads. Videos nobody actually recommended (only cited, joked about or argued with) are left out.
3. (199) *(attach a share card from `launch/media/social-preview.png`)*
> Your Tube is a link. The link is the recipe (topics, formats, a seed), so it opens the same feed for anyone, with a share card made from its real thumbnails. Press "Remix this Tube" to make it yours.
4. (223)
> Want your own site? Share & export → Starter project: your config inside, `node build.mjs` rebuilds the feed from the source data with the same ranking code. There's a Claude Code prompt too.
>
> Guide: [LINK]/build-your-own
5. (246)
> Ranking is deterministic, no AI needed: topic match, how many months HN kept recommending it, how many different people did, plus variety and your likes. Formula's in the README.
>
> Data: HackerTube (ODC-By). Not affiliated.
> [REPO]

## Reply to Karpathy's post (271)

> Thanks for publishing the data, DATA.md made it easy to build on.
>
> I made a small "make your own" layer: pick topics, get the 4,626 videos at least one commenter genuinely recommended, those comments verbatim, a share link and a zero-dep starter.
>
> [LINK]

Why this one: it thanks him for something he actually did (published the data with a clear DATA.md),
adds substance (what was built on top, using a detail of his data model: only real recommendations),
and claims no endorsement or affiliation. No @-mention needed; it's a reply. Attach the short clip.

## Claim check

- ✅ "43M HN comments", "published the data": Karpathy's X post and blog. Attributed to him.
- ✅ 4,626 videos; 437 videos for the three demo topics (Machine learning & deep learning, Functional
  programming, Fundamental physics): shipped data, the live preview caption and the share card.
- ✅ "No login": true. AI is optional; keyword matching works without it.
- ✅ "19 years": HN comments in the data span 2007–2026.
- ❌ Don't say HackerTube is open source (only its data is), that TubeRemix is official, or that
  Karpathy uses or endorses it.
