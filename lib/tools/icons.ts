import { Archive, Braces, Clapperboard, FileText, Fingerprint, KeyRound, Link2Off, LockKeyhole, ScanSearch } from "lucide-react";

import type { ToolIcon } from "@/lib/tools/registry";

export const toolIcons: Record<ToolIcon, typeof Fingerprint> = {
  archive: Archive,
  video: Clapperboard,
  "file-text": FileText,
  fingerprint: Fingerprint,
  key: KeyRound,
  "link-off": Link2Off,
  braces: Braces,
  lock: LockKeyhole,
  scan: ScanSearch,
};
