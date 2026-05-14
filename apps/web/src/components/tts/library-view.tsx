"use client";

import { Library, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrary } from "@/lib/queries";
import { GenerationCard } from "./generation-card";

export function LibraryView() {
  const { data, isLoading, isFetching, error, refetch } = useLibrary();
  const generations = data ?? [];

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <Card>
        <CardContent className="p-0">
          <ErrorState error={error} onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }
  if (generations.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={Library}
            title="Nothing here yet"
            description="Generate something from the Synthesize page and it will land here."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-7 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {generations.map((g) => (
          <GenerationCard key={g.key} generation={g} />
        ))}
      </div>
    </div>
  );
}
