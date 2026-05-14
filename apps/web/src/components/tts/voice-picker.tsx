"use client";

import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VOICES } from "@/lib/tts/voices";
import type { Voice } from "@b2-transformersjs-text-to-speech/shared";

interface VoicePickerProps {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function VoicePicker({ value, onChange, disabled }: VoicePickerProps) {
  // Group voices by language so the dropdown stays scannable as the
  // catalog grows past the default 20 entries.
  const grouped = useMemo(() => {
    const map = new Map<string, Voice[]>();
    for (const v of VOICES) {
      const bucket = map.get(v.language) ?? [];
      bucket.push(v);
      map.set(v.language, bucket);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a voice" />
      </SelectTrigger>
      <SelectContent>
        {grouped.map(([language, voices]) => (
          <SelectGroup key={language}>
            <SelectLabel>{language}</SelectLabel>
            {voices.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {v.id}
                  </span>
                  <span>{v.name}</span>
                  <span className="text-[11px] text-muted-foreground capitalize">
                    {v.gender}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
