import type { Metadata } from "next";
import { JwtDecoder } from "@/components/tools/jwt-decoder";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";
const tool = getTool("jwt-decoder")!;
export const metadata: Metadata = { title: tool.name, description: tool.description };
export default function JwtDecoderPage() { return <ToolShell tool={tool}><JwtDecoder /></ToolShell>; }
