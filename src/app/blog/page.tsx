import Link from "next/link";
import { PageHeader } from "@/components/common";
import { HUB_NAME } from "@/lib/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta(
  "Blog",
  `News and season updates from ${HUB_NAME}. Posts ship in a later phase.`,
);

export default function BlogPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Hub"
        title="Blog"
        subtitle="Season announcements and community write-ups will live here. The route is reserved — content comes next."
      />
      <p className="m-0 text-sm text-muted-foreground">
        Meanwhile follow Discord updates, or go back to{" "}
        <Link href="/" className="text-link">
          {HUB_NAME}
        </Link>
        .
      </p>
    </div>
  );
}
