import Link from "next/link";
import { Mic2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LibraryView } from "@/components/tts/library-view";

export default function LibraryPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Library</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Every generation you have stored in B2 — play, download, or delete.
          </p>
        </div>
        <Button asChild size="sm" className="h-8">
          <Link href="/synthesize">
            <Mic2 className="h-3.5 w-3.5" />
            New generation
          </Link>
        </Button>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <LibraryView />
      </div>
    </div>
  );
}
