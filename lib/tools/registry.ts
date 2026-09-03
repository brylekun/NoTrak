export type ToolMode = "local" | "external-lookup";
export type ToolStatus = "ready" | "planned";
export type ToolIcon = "fingerprint" | "key" | "link-off" | "braces" | "lock" | "scan";

export type ToolDefinition = {
  slug: string;
  name: string;
  description: string;
  category: "Network" | "Privacy" | "Security" | "Files" | "Developer";
  mode: ToolMode;
  status: ToolStatus;
  icon: ToolIcon;
  privacyNotice: string;
};

export const toolRegistry: ToolDefinition[] = [
  {
    slug: "whats-my-ip",
    name: "What’s My IP",
    description: "See the public address and approximate location visible to this connection.",
    category: "Network",
    mode: "external-lookup",
    status: "ready",
    icon: "fingerprint",
    privacyNotice: "Your request IP is read once to return this result. No application history is saved.",
  },
  {
    slug: "password-generator",
    name: "Password Generator",
    description: "Create strong, unique passwords using secure randomness on your device.",
    category: "Security",
    mode: "local",
    status: "ready",
    icon: "key",
    privacyNotice: "Generated entirely in your browser. Your password never leaves this device.",
  },
  {
    slug: "tracking-url-cleaner",
    name: "Tracking URL Cleaner",
    description: "Strip common advertising and campaign parameters before sharing a link.",
    category: "Privacy",
    mode: "local",
    status: "ready",
    icon: "link-off",
    privacyNotice: "Cleaned entirely in your browser. The submitted link is never opened or sent to NoTrak.",
  },
  {
    slug: "hash-generator",
    name: "Hash Generator",
    description: "Calculate secure file and text fingerprints without uploading content.",
    category: "Developer",
    mode: "local",
    status: "ready",
    icon: "braces",
    privacyNotice: "Files and text are processed only in your browser.",
  },
  {
    slug: "passphrase-generator",
    name: "Passphrase Generator",
    description: "Create memorable multi-word passphrases with secure on-device randomness.",
    category: "Security",
    mode: "local",
    status: "ready",
    icon: "key",
    privacyNotice: "Generated entirely in your browser from a bundled word list.",
  },
  {
    slug: "uuid-generator",
    name: "UUID Generator",
    description: "Generate standards-based unique identifiers locally.",
    category: "Developer",
    mode: "local",
    status: "ready",
    icon: "braces",
    privacyNotice: "Identifiers are generated only in your browser.",
  },
  {
    slug: "qr-generator",
    name: "QR Generator",
    description: "Turn text or a link into a downloadable QR code.",
    category: "Developer",
    mode: "local",
    status: "ready",
    icon: "scan",
    privacyNotice: "QR content is processed only in your browser.",
  },
  {
    slug: "remove-exif",
    name: "EXIF Remover",
    description: "Create a clean image copy without embedded camera metadata.",
    category: "Files",
    mode: "local",
    status: "ready",
    icon: "scan",
    privacyNotice: "Images are read and rewritten only on your device.",
  },
  {
    slug: "image-compressor",
    name: "Image Compressor",
    description: "Reduce image size locally while keeping the original untouched.",
    category: "Files",
    mode: "local",
    status: "ready",
    icon: "scan",
    privacyNotice: "Images are compressed only in your browser.",
  },
  {
    slug: "file-encryption",
    name: "File Encryption",
    description: "Encrypt sensitive files locally before storing or sending them.",
    category: "Files",
    mode: "local",
    status: "ready",
    icon: "lock",
    privacyNotice: "Files, passwords, and keys never leave your browser.",
  },
  {
    slug: "browser-privacy",
    name: "Browser Privacy Check",
    description: "Understand information a normal website can observe about this browser.",
    category: "Privacy",
    mode: "local",
    status: "ready",
    icon: "fingerprint",
    privacyNotice: "The check runs locally and does not claim to prove anonymity.",
  },
  {
    slug: "speed-test",
    name: "Speed Test",
    description: "Measure connection speed, latency, and jitter from the browser.",
    category: "Network",
    mode: "external-lookup",
    status: "ready",
    icon: "fingerprint",
    privacyNotice: "Measurement traffic goes directly to Cloudflare, which receives your IP address. No typed content or files are sent; result logging is disabled.",
  },
  {
    slug: "pdf-metadata-cleaner",
    name: "PDF Metadata Cleaner",
    description: "Remove document metadata and download a new PDF copy.",
    category: "Files",
    mode: "local",
    status: "ready",
    icon: "lock",
    privacyNotice: "PDF files are processed only in your browser.",
  },
  {
    slug: "phishing-checker",
    name: "Phishing Checker",
    description: "Inspect suspicious links using explainable checks and reputation sources.",
    category: "Security",
    mode: "external-lookup",
    status: "ready",
    icon: "scan",
    privacyNotice: "Local checks stay in-browser. After confirmation, the full URL is sent through NoTrak to configured Google Safe Browsing and URLhaus providers.",
  },
  {
    slug: "malware-reputation",
    name: "Malware Reputation",
    description: "Check whether a locally calculated SHA-256 hash is known to threat intelligence.",
    category: "Security",
    mode: "external-lookup",
    status: "ready",
    icon: "scan",
    privacyNotice: "The file stays local. After confirmation, only its SHA-256 hash is sent through NoTrak to MalwareBazaar.",
  },
  {
    slug: "qr-scanner",
    name: "QR Scanner",
    description: "Read QR codes from a selected image or camera with explicit permission.",
    category: "Privacy",
    mode: "local",
    status: "ready",
    icon: "scan",
    privacyNotice: "Images and camera frames are processed only in your browser.",
  },
  {
    slug: "image-converter",
    name: "Image Converter",
    description: "Convert supported image formats locally and download the result.",
    category: "Files",
    mode: "local",
    status: "ready",
    icon: "scan",
    privacyNotice: "Images are converted only in your browser.",
  },
  {
    slug: "jwt-decoder",
    name: "JWT Decoder",
    description: "Inspect token headers and payloads without pretending to verify a signature.",
    category: "Developer",
    mode: "local",
    status: "ready",
    icon: "braces",
    privacyNotice: "Token contents are decoded only in your browser.",
  },
];

export const featuredTools = toolRegistry.filter((tool) => tool.status === "ready");

export function getTool(slug: string) {
  return toolRegistry.find((tool) => tool.slug === slug);
}
