import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[760px] space-y-4 px-4 py-12 text-[15.5px] leading-relaxed text-ink-2 sm:px-8">
        <h1 className="font-serif text-[52px] leading-none text-ink">Privacy</h1>
        <p><b className="text-ink">No accounts.</b> Your interests, likes, saves and history are stored in your browser’s localStorage. They are never sent to TubeRemix’s server. Clearing site data removes them.</p>
        <p><b className="text-ink">Share links</b> contain your Tube’s settings (name, topics, formats). They don’t contain likes or history.</p>
        <p><b className="text-ink">Videos</b> play through YouTube’s privacy-enhanced embed (youtube-nocookie.com), only after you press play. Thumbnails load from i.ytimg.com. YouTube’s own privacy policy applies to the player.</p>
        <p><b className="text-ink">Product analytics.</b> To learn whether people get from the landing page to a feed, TubeRemix counts a handful of events (landing view, builder started, interests selected, feed generated, video opened, share, shared Tube opened, remix, export) with a random per-tab id that is forgotten when you close the tab. No video ids, titles, topics, names, IP addresses or user agents are stored. If your browser sends Global Privacy Control or Do Not Track, nothing is sent.</p>
        <p><b className="text-ink">Optional AI.</b> If you connect an AI provider, requests go directly from your browser to that provider with your key; TubeRemix’s server doesn’t see them. Keys are kept in this tab’s session storage unless you choose to remember them on this device. Sign in with ChatGPT is only available when you run TubeRemix on your own computer; its tokens are stored in a private file there.</p>
      </main>
      <SiteFooter />
    </>
  );
}
