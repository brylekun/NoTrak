import { JwtDecoder } from "@/components/tools/jwt-decoder";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("jwt-decoder")!;
export const metadata = toolMetadata(tool);
export default function JwtDecoderPage() { return <ToolShell tool={tool}><JwtDecoder /></ToolShell>; }
