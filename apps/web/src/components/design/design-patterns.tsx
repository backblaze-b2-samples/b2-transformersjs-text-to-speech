"use client";

import { Inbox, AudioLines } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { DataTable } from "@/components/ui/data-table";
import { ApiError } from "@/lib/api-client";
import { Section } from "./section";

// Demo errors for the ErrorState showcase. These are constructed, not
// thrown — `ErrorState` reads `status` to derive the right copy.
const offlineError = new ApiError("Network error — check your connection", 0);
const serverError = new ApiError("Internal Server Error", 500);

type Row = { textPreview: string; voice: string; duration: string; created: string };

// Generation-shaped rows that mirror the real library page. Kept short so
// the data-table demo reads at a glance.
const sampleRows: Row[] = [
  { textPreview: "Welcome to the demo...", voice: "af_bella", duration: "4.2s", created: "2 min ago" },
  { textPreview: "This is a longer paragraph used to test multi-line wrapping in the table cell...", voice: "am_michael", duration: "12.8s", created: "1 hr ago" },
  { textPreview: "Hello, world!", voice: "bf_emma", duration: "1.4s", created: "3 hr ago" },
  { textPreview: "Chapter one — the quick brown fox jumps over the lazy dog.", voice: "bm_george", duration: "7.6s", created: "yesterday" },
  { textPreview: "Bonjour, comment allez-vous?", voice: "ff_siwis", duration: "2.9s", created: "2 days ago" },
  { textPreview: "Podcast intro reading — sample take 03.", voice: "af_nicole", duration: "5.1s", created: "3 days ago" },
];

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: "textPreview",
    header: "Text preview",
    size: 360,
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <AudioLines className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{row.original.textPreview}</span>
      </span>
    ),
  },
  {
    accessorKey: "voice",
    header: "Voice",
    size: 140,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.voice}
      </span>
    ),
  },
  {
    accessorKey: "duration",
    header: "Duration",
    size: 100,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {row.original.duration}
      </span>
    ),
  },
  {
    accessorKey: "created",
    header: "Created",
    size: 140,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.created}</span>
    ),
  },
];

export function DesignPatterns() {
  return (
    <Section
      id="patterns"
      title="Patterns"
      description="Composed building blocks — empty states, sortable tables, page headers."
    >
      <div className="grid gap-4">
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Empty state</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <EmptyState
              icon={Inbox}
              title="No generations yet"
              description="Synthesize something to see it here."
              action={
                <Button size="sm" variant="outline">
                  Go to Synthesize
                </Button>
              }
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="border-b border-border py-4 px-5">
              <CardTitle className="card-title">Error state — offline</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <ErrorState error={offlineError} onRetry={() => {}} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border py-4 px-5">
              <CardTitle className="card-title">Error state — backend 5xx</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <ErrorState error={serverError} onRetry={() => {}} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">
              Sortable data table
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <DataTable
              columns={columns}
              data={sampleRows}
              pageSize={5}
              emptyTitle="No generations"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">
              Command palette
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 text-sm text-muted-foreground">
            Press{" "}
            <kbd className="text-[10px] font-mono border border-border rounded px-1 py-0.5">
              ⌘K
            </kbd>{" "}
            or{" "}
            <kbd className="text-[10px] font-mono border border-border rounded px-1 py-0.5">
              /
            </kbd>{" "}
            anywhere to search the library and jump between routes.
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
