# X launch copy

`[LINK]` = the live TubeRemix URL once deployed. `[REPO]` = the GitHub repo once public. Nothing
here has been posted. Every number is from the shipped data (`public/data/index.json`) or the
upstream sources, checked 2026-11-03.

## Five candidates

**1. Karpathy reference**
> Karpathy had Claude read 43M Hacker News comments to build HackerTube, then published the data so anyone could make their own.
>
> So I made the "make your own" part: pick a few interests, get a feed of the 4,626 videos HN commenters actually recommended, with their comments attached. No login.
>
> [LINK]

**2. Builder tutorial**
> Build your own HackerTube in 2 minutes:
>
> 1. pick topics at [LINK]
> 2. Share & export → Starter project
> 3. `node build.mjs`
>
> It downloads the open HackerTube data, checks its sha256, ranks it with your config and writes a static site. Zero dependencies, deploy anywhere.

**3. Consumer pain point**
> YouTube's feed is tuned for your next click.
>
> Hacker News has spent 19 years telling each other which talks, lectures and documentaries were worth an hour. TubeRemix turns that into your own feed, with the receipts: every video shows the comments that recommended it.
>
> [LINK]

**4. Open-source announcement**
> TubeRemix is open source (MIT): a remixable front end for the HackerTube dataset.
>
> · deterministic ranking you can read in one file
> · share links that are the config (no database)
> · share cards with real thumbnails
> · a zero-dependency starter that rebuilds your feed
>
> Data: HackerTube (ODC-By). [REPO]

**5. Surprising demo (video)**
> Tap "Functional programming", "Distributed systems", "Space exploration".
>
> The grid re-sorts itself into your own HackerTube, live, from the 378 videos HN commenters recommended in those topics. Open one and you get the actual comments.
>
> Make yours: [LINK]
>
> 🎥 `launch/media/demo-interests-to-feed.mp4`

## Pick: #5 as the main post, #1 as the reply under Karpathy's post

#5 shows the product instead of describing it. The 9-second clip *is* the signature moment (taps →
the grid visibly reorganises into a real feed), it needs no context, and it lands with people
scrolling the HackerTube conversation who have just seen Karpathy's version. It makes one claim the
viewer can check in ten seconds. #1 carries the story (he published the data; this is the "make
your own" part), so it fits as the reply under his post, where that context already exists.

## Thread (main post = #5)

1. *(#5 with `demo-interests-to-feed.mp4`)*
2. > Every video has receipts. Open one and you see who on HN recommended it and why: verbatim comments, links to the threads, "HN people also recommend". Videos nobody actually recommended (only cited, joked about or argued with) are left out.
3. > Your Tube is a link. The link is the recipe (topics, formats, a seed), so it opens the same feed for anyone, with a share card made from its real thumbnails. Press "Remix this Tube" and change it.
4. > Want your own site? Share & export gives you a starter project with your config inside: `node build.mjs` rebuilds your feed from the source data, same ranking code. There's a Claude Code prompt too. Guide: [LINK]/build-your-own
5. > Ranking is deterministic and needs no AI: topic match, how many months HN kept recommending it, how many different people did, plus variety and your likes. Formula in the README. Data from HackerTube (ODC-By); not affiliated with it. [REPO]

## Reply to Karpathy's post

> Thanks for publishing the data, DATA.md made it easy to build on.
>
> I made a small "make your own" layer: pick a few topics and it ranks the 4,626 videos that at least one commenter genuinely recommended (stance rec/strong_rec), shows those comments verbatim, and gives you a share link that is the config, plus a zero-dependency starter that rebuilds your feed from the zip.
>
> [LINK]

Why this one: it leads with thanks for something he actually did (published data with a clear
DATA.md), adds substance (what was built on top, and a detail from his own data model: stances),
and makes no claim of endorsement or affiliation. No tag needed; it's a reply.

## Claim check

- ✅ "43M comments", "6,454 videos": Karpathy's X post. Used as his claim, attributed.
- ✅ 4,626 videos, 9,437 distinct recommenders, 133 topic chips, 378 videos for the three demo
  topics: shipped data / live share card.
- ✅ "No login, no AI needed": true for the core app (AI is optional, keyword matching works).
- ❌ Don't say HackerTube is open source (only its data is), or that this is "official", or that
  Karpathy uses/endorses it.
