import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedTubeView } from "@/components/share/SharedTubeView";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { tubeId } from "@/core/share";
import { resolveShared } from "@/lib/shared";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ segment: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segment } = await params;
  const t = await resolveShared(segment, 1);
  if (!t.ok) return { title: "Tube not found", robots: { index: false } };
  const name = t.config.prefs.name || "An untitled Tube";
  const topics = t.topicNames.slice(0, 3).join(", ");
  const description = topics ? `A video feed of what Hacker News recommends in ${topics}${t.topicNames.length > 3 ? " and more" : ""}. Made with TubeRemix.` : "A video feed of what Hacker News recommends. Made with TubeRemix.";
  return {
    title: name,
    description,
    alternates: { canonical: t.canonical },
    robots: { index: false, follow: true },
    openGraph: { title: name, description, type: "website", url: t.canonical },
    twitter: { card: "summary_large_image", title: name, description },
  };
}

export default async function SharedPage({ params }: Props) {
  const { segment } = await params;
  const t = await resolveShared(segment, 36);
  if (!t.ok) notFound();
  return (
    <>
      <SiteHeader cta={false} />
      <main className="mx-auto max-w-[1280px] px-4 sm:px-8">
        <SharedTubeView
          prefs={t.config.prefs}
          parent={t.config.parent}
          id={tubeId(t.token)}
          items={t.items}
          pool={t.pool}
          topicNames={t.topicNames}
          path={t.canonical}
        />
      </main>
      <SiteFooter />
    </>
  );
}
