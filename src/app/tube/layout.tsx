import type { Metadata } from "next";
import { TubeShell } from "@/components/tube/TubeShell";

export const metadata: Metadata = { title: "Your Tube", robots: { index: false } };

export default function TubeLayout({ children }: { children: React.ReactNode }) {
  return <TubeShell>{children}</TubeShell>;
}
