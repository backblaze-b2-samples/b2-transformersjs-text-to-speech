"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Mic2,
  Library,
  Settings,
  Sparkles,
  AudioLines,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { getLibrary } from "@/lib/api-client";
import { formatDuration } from "@/lib/utils";
import type { Generation } from "@b2-transformersjs-text-to-speech/shared";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const routes = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Synthesize", href: "/synthesize", icon: Mic2 },
  { label: "Library", href: "/library", icon: Library },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Design System", href: "/design", icon: Sparkles },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [items, setItems] = useState<Generation[]>([]);

  useEffect(() => {
    if (!open || items.length > 0) return;
    getLibrary().then(setItems).catch(() => setItems([]));
  }, [open, items.length]);

  const runThen = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search the library or jump to a page..." />
      <CommandList>
        <CommandEmpty>No matches found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {routes.map((r) => (
            <CommandItem
              key={r.href}
              onSelect={runThen(() => router.push(r.href))}
              value={`nav ${r.label}`}
            >
              <r.icon />
              {r.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem onSelect={runThen(() => setTheme("light"))} value="theme light">
            <Sun />
            Light mode
          </CommandItem>
          <CommandItem onSelect={runThen(() => setTheme("dark"))} value="theme dark">
            <Moon />
            Dark mode
          </CommandItem>
          <CommandItem onSelect={runThen(() => setTheme("system"))} value="theme system">
            <Sparkles />
            System theme
          </CommandItem>
        </CommandGroup>
        {items.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Library">
              {items.slice(0, 20).map((g) => (
                <CommandItem
                  key={g.key}
                  value={`gen ${g.text_preview ?? g.key} ${g.voice_id ?? ""}`}
                  onSelect={runThen(() => router.push("/library"))}
                >
                  <AudioLines />
                  <span className="truncate">
                    {g.text_preview ?? g.key.split("/").pop()}
                  </span>
                  <CommandShortcut>{formatDuration(g.duration_ms)}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
