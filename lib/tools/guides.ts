export type ToolGuide = {
  summary: string;
  useCases: string[];
  howItWorks: string;
  limitations: string;
  relatedSlugs: string[];
};

export const toolGuides: Record<string, ToolGuide> = {
  "whats-my-ip": {
    summary: "See the public network address and coarse location that a normal website can observe for this connection.",
    useCases: ["Confirm whether a VPN or network change affected your public address.", "Share a public IP with a network administrator while troubleshooting."],
    howItWorks: "NoTrak reads the address and optional location headers attached to this single request, returns the available fields, and does not save an application history.",
    limitations: "Location is approximate and may identify an ISP gateway rather than you. A VPN, proxy, mobile carrier, or corporate network can change what appears.",
    relatedSlugs: ["browser-privacy", "speed-test", "tracking-url-cleaner"],
  },
  "password-generator": {
    summary: "Create a fresh password for an account without sending the result to a password service.",
    useCases: ["Generate a different password for every account.", "Match a website's length and character requirements."],
    howItWorks: "Your browser uses cryptographically secure randomness to select characters from the options you choose. Generation and copying stay on this device.",
    limitations: "A generated password still needs secure storage. Save it in a trusted password manager and do not reuse it across accounts.",
    relatedSlugs: ["password-safety", "passphrase-generator", "text-encryption"],
  },
  "password-safety": {
    summary: "Review a password's construction locally and optionally check a privacy-preserving breach range before using it.",
    useCases: ["Check a new password for common or predictable patterns.", "Find out whether a password appears in a known breach corpus without sending the password."],
    howItWorks: "Local rules inspect the password first. With your confirmation, the browser hashes it and sends only the first five SHA-1 characters to Have I Been Pwned, then compares returned suffixes locally.",
    limitations: "A strong score or breach miss does not prove a password is safe. It cannot detect every targeted guess, credential theft, or reuse on another service.",
    relatedSlugs: ["password-generator", "passphrase-generator", "browser-privacy"],
  },
  "tracking-url-cleaner": {
    summary: "Remove common advertising, analytics, and campaign parameters from a link before you keep or share it.",
    useCases: ["Clean a link copied from a newsletter or social post.", "Compare the destination URL before and after known tracking fields are removed."],
    howItWorks: "The browser parses the URL, removes parameters on NoTrak's maintained tracking list, and preserves the remaining destination and query values.",
    limitations: "Tracking can also live in a path, short link, redirect, or server-side identifier. Always inspect the cleaned destination before sharing it.",
    relatedSlugs: ["phishing-checker", "qr-generator", "qr-scanner"],
  },
  "sensitive-data-redactor": {
    summary: "Create a reviewable copy of text with supported personal details and credential patterns replaced by consistent placeholders.",
    useCases: ["Sanitize logs or support messages before sharing them.", "Mask emails, tokens, payment-card candidates, and other supported secrets in a text file."],
    howItWorks: "Conservative local pattern checks find supported values, group exact repeats, and let you include or exclude each finding before producing a sanitized copy.",
    limitations: "Automated redaction can miss names, addresses, unusual formatting, or context-specific secrets and can flag harmless text. Review the result manually.",
    relatedSlugs: ["json-formatter", "email-header-analyzer", "text-encryption"],
  },
  "hash-generator": {
    summary: "Calculate a repeatable fingerprint for text or a file so you can compare content without uploading it.",
    useCases: ["Compare a downloaded file with a publisher's checksum.", "Detect whether two local files or text values are identical."],
    howItWorks: "The browser reads the selected input and calculates the chosen SHA digest with the Web Crypto API. Only the digest is shown.",
    limitations: "A hash is not encryption and does not hide predictable input. A matching checksum proves equality to the reference, not that the reference is trustworthy.",
    relatedSlugs: ["malware-reputation", "file-encryption", "text-encryption"],
  },
  "passphrase-generator": {
    summary: "Create a memorable multi-word secret using a bundled list and secure randomness on your device.",
    useCases: ["Generate a long master passphrase you can store safely.", "Create a memorable secret when a service accepts spaces or separators."],
    howItWorks: "Your browser chooses each word independently with cryptographically secure randomness and joins them using your selected format.",
    limitations: "Security depends on the number of randomly selected words, not on personal substitutions. Store the result safely and never reuse it.",
    relatedSlugs: ["password-generator", "password-safety", "file-encryption"],
  },
  "uuid-generator": {
    summary: "Generate standards-based random identifiers for records, fixtures, and development work.",
    useCases: ["Create IDs for test data or local prototypes.", "Generate multiple identifiers without calling an online service."],
    howItWorks: "The browser uses its secure random UUID facility, with a compatible random fallback where required, and displays the results locally.",
    limitations: "UUIDs are identifiers, not secrets, passwords, or access tokens. Their practical uniqueness does not provide authorization.",
    relatedSlugs: ["json-formatter", "base64-converter", "hash-generator"],
  },
  "qr-generator": {
    summary: "Turn text or a URL into a QR image that you can download and use without sending the encoded value away.",
    useCases: ["Move a link or short note between devices.", "Create a code for printed instructions, contact details, or local testing."],
    howItWorks: "A local QR library encodes the entered value into image data in your browser and prepares a downloadable copy.",
    limitations: "Anyone who scans the code can read its contents, and scanners may open URLs. Do not place secrets in a public QR code.",
    relatedSlugs: ["qr-scanner", "tracking-url-cleaner", "phishing-checker"],
  },
  "exif-viewer": {
    summary: "Inspect readable camera, timestamp, location, and descriptive metadata embedded in a photo before sharing it.",
    useCases: ["Check whether a photo contains GPS coordinates.", "Review camera or editing metadata without uploading the image."],
    howItWorks: "The browser reads supported metadata containers and groups the fields into a local report. Coordinates are not sent to a map provider.",
    limitations: "Formats and applications store metadata differently, so an empty report is not absolute proof that every hidden field is absent.",
    relatedSlugs: ["remove-exif", "image-compressor", "image-converter"],
  },
  "remove-exif": {
    summary: "Create new image copies without the supported metadata containers carried by the originals.",
    useCases: ["Remove camera and GPS metadata before posting photos.", "Clean several supported images in one local batch."],
    howItWorks: "The browser decodes and re-encodes each image, checks supported JPEG, PNG, or WebP metadata containers, and gives you a separate cleaned download.",
    limitations: "Visible information in the pixels is unchanged. Re-encoding can affect compression, color profiles, animation, and unsupported metadata.",
    relatedSlugs: ["exif-viewer", "image-compressor", "image-resizer"],
  },
  "image-compressor": {
    summary: "Reduce the byte size of a supported image while keeping the original file untouched.",
    useCases: ["Prepare a photo for email or a size-limited form.", "Compare quality and file-size tradeoffs before downloading."],
    howItWorks: "The browser decodes the image, draws it locally, and exports a new copy using your selected quality and format settings.",
    limitations: "Compression can introduce visible artifacts and may discard animation, color profiles, or metadata. Results vary by image and format.",
    relatedSlugs: ["image-resizer", "image-converter", "remove-exif"],
  },
  "image-resizer": {
    summary: "Create a new image at exact or aspect-ratio-preserving dimensions without uploading the source.",
    useCases: ["Fit an image to a profile, document, or upload limit.", "Prepare multiple size variants while retaining the original."],
    howItWorks: "The browser validates the requested dimensions, redraws the image on a local canvas, and exports the selected format.",
    limitations: "Upscaling cannot restore missing detail. Very large dimensions are limited for browser stability, and re-encoding may change metadata or color handling.",
    relatedSlugs: ["image-compressor", "image-converter", "remove-exif"],
  },
  "image-to-text": {
    summary: "Extract editable printed English text from a screenshot or photo using an OCR engine that runs in your browser.",
    useCases: ["Copy text from a screenshot, receipt, or scanned page.", "Crop and rotate an image before recognizing only the useful region."],
    howItWorks: "Same-origin OCR assets load into a browser worker, which reads the selected pixels locally and returns editable text with an estimated confidence.",
    limitations: "Handwriting, unusual fonts, complex layouts, blur, and other languages can produce errors. Verify important text against the image.",
    relatedSlugs: ["sensitive-data-redactor", "image-resizer", "image-converter"],
  },
  "file-encryption": {
    summary: "Encrypt a file locally before placing it in cloud storage, attaching it to a message, or moving it between devices.",
    useCases: ["Add password-based protection before sharing a sensitive file.", "Decrypt a compatible NoTrak container on another device."],
    howItWorks: "The browser derives a key from your password and uses authenticated AES-GCM encryption with a unique salt and initialization value.",
    limitations: "A forgotten password cannot be recovered. Share the password through a separate trusted channel, and keep the encrypted container intact.",
    relatedSlugs: ["text-encryption", "hash-generator", "password-generator"],
  },
  "browser-privacy": {
    summary: "Review information that ordinary browser APIs expose to a page and learn which settings can reduce that surface.",
    useCases: ["Check browser privacy settings after an update.", "Understand which device and capability details a site can observe."],
    howItWorks: "The page reads a bounded set of browser-provided values locally and explains whether each tested surface is exposed or withheld.",
    limitations: "This is not an anonymity test or a complete fingerprinting audit. Networks, extensions, permissions, and untested APIs can reveal more.",
    relatedSlugs: ["whats-my-ip", "tracking-url-cleaner", "password-safety"],
  },
  "speed-test": {
    summary: "Estimate download speed, upload speed, latency, jitter, and loaded latency from this browser and connection.",
    useCases: ["Troubleshoot a slow or unstable connection.", "Compare Wi-Fi locations or network changes under similar conditions."],
    howItWorks: "The browser sends adaptive measurement traffic directly to Cloudflare endpoints and summarizes multiple timing and transfer samples.",
    limitations: "Results are estimates affected by Wi-Fi, browser load, device performance, routing, and server conditions. The test also consumes data.",
    relatedSlugs: ["whats-my-ip", "browser-privacy", "tracking-url-cleaner"],
  },
  "pdf-metadata-cleaner": {
    summary: "Remove standard document-information and XMP metadata from a PDF while keeping the source file on your device.",
    useCases: ["Clear author, title, subject, and creator fields before sharing.", "Create and verify a new metadata-clean PDF copy."],
    howItWorks: "A browser worker rewrites the PDF metadata, saves a new document, reopens it, and checks that the supported fields are absent.",
    limitations: "This does not redact visible text, annotations, attachments, layers, or names inside page content. Rewriting can invalidate digital signatures.",
    relatedSlugs: ["pdf-toolkit", "remove-exif", "sensitive-data-redactor"],
  },
  "pdf-toolkit": {
    summary: "Merge PDFs or reorder, rotate, remove, extract, and split pages without uploading the documents.",
    useCases: ["Combine several PDFs into one ordered document.", "Extract or rearrange only the pages you need."],
    howItWorks: "A browser worker reads the chosen files, copies the selected pages into new PDF documents, and prepares local downloads.",
    limitations: "Password-protected files may not open, and page copying may not preserve signatures, bookmarks, forms, layers, or attachments.",
    relatedSlugs: ["pdf-metadata-cleaner", "file-encryption", "sensitive-data-redactor"],
  },
  "phishing-checker": {
    summary: "Inspect a suspicious URL without opening it, combining explainable local signals with configured reputation providers.",
    useCases: ["Check a link from an unexpected email or message.", "Review why a URL looks unusual before deciding what to do."],
    howItWorks: "Local analysis examines the URL structure. After confirmation, NoTrak sends the full URL to configured Google Safe Browsing and URLhaus lookups but never visits the destination.",
    limitations: "A clean result cannot prove safety because new, targeted, or unreported threats may be unknown. URLhaus focuses on malware distribution rather than phishing generally.",
    relatedSlugs: ["email-header-analyzer", "qr-scanner", "tracking-url-cleaner"],
  },
  "email-header-analyzer": {
    summary: "Turn raw email headers into an ordered delivery path, reported authentication results, and explainable warning signals.",
    useCases: ["Investigate an unexpected or suspicious email.", "Understand SPF, DKIM, DMARC, and Received headers before escalating a message."],
    howItWorks: "The browser parses the pasted header block, orders visible mail hops, and reports authentication exactly as the receiving systems wrote it.",
    limitations: "Headers can be forged, incomplete, or misleading. The tool does not query DNS or verify signatures, and clean authentication does not rule out a compromised sender.",
    relatedSlugs: ["phishing-checker", "sensitive-data-redactor", "browser-privacy"],
  },
  "malware-reputation": {
    summary: "Check whether the SHA-256 fingerprint of a local file is known to a configured malware intelligence source.",
    useCases: ["Investigate a suspicious download without uploading the file.", "Compare a known hash with MalwareBazaar intelligence."],
    howItWorks: "Your browser calculates the file's SHA-256 hash. After confirmation, only that hash is sent through NoTrak to MalwareBazaar.",
    limitations: "A hash lookup recognizes only the exact file version already known to the provider. Not found never means the file is safe.",
    relatedSlugs: ["hash-generator", "file-encryption", "phishing-checker"],
  },
  "qr-scanner": {
    summary: "Read a QR code from an image or camera frame and inspect the decoded value before taking any action.",
    useCases: ["Preview a QR destination before opening it.", "Decode a code from a saved image without uploading the image."],
    howItWorks: "With your explicit file or camera permission, a local decoder examines browser image frames and returns text. NoTrak never opens the result automatically.",
    limitations: "Damaged, tiny, or low-contrast codes may not decode. A successful scan says nothing about whether the payload or destination is trustworthy.",
    relatedSlugs: ["phishing-checker", "qr-generator", "tracking-url-cleaner"],
  },
  "image-converter": {
    summary: "Convert a supported image into a more convenient format and download the new copy locally.",
    useCases: ["Change an image for browser, document, or upload compatibility.", "Convert to a format that supports the transparency or size you need."],
    howItWorks: "The browser decodes the source image, redraws it locally, and exports a new file in the selected supported format.",
    limitations: "Animation, metadata, color profiles, and some format-specific features may be lost. Formats without alpha transparency need a background color.",
    relatedSlugs: ["image-compressor", "image-resizer", "remove-exif"],
  },
  "base64-converter": {
    summary: "Encode text as standard or URL-safe Base64, or decode Base64 back into readable text.",
    useCases: ["Inspect a Base64 value found in a payload or configuration.", "Prepare small text values for systems that require Base64 encoding."],
    howItWorks: "The browser converts text to UTF-8 bytes or decodes bytes back to text, then applies the selected Base64 alphabet locally.",
    limitations: "Base64 is an encoding, not encryption, and anyone can reverse it. Invalid input or non-text binary data may not produce readable text.",
    relatedSlugs: ["jwt-decoder", "json-formatter", "text-encryption"],
  },
  "json-formatter": {
    summary: "Format, minify, sort, and validate JSON while keeping pasted payloads inside your browser.",
    useCases: ["Make an API response easier to read.", "Find the location of malformed JSON before using it in code or configuration."],
    howItWorks: "The browser parses the input with the standard JSON parser and creates the selected formatted, sorted, or compact representation.",
    limitations: "Valid syntax does not prove that fields are correct for a particular API or schema. Very large documents can be limited by browser memory.",
    relatedSlugs: ["jwt-decoder", "base64-converter", "sensitive-data-redactor"],
  },
  "text-encryption": {
    summary: "Encrypt a message into a pasteable NoTrak block or decrypt a compatible block entirely on your device.",
    useCases: ["Protect text before placing it in an otherwise untrusted channel.", "Decrypt a message from someone using the same NoTrak format."],
    howItWorks: "The browser derives an encryption key from the password and uses authenticated AES-GCM with a unique salt and initialization value.",
    limitations: "A lost password cannot be recovered. Encryption does not hide who communicated, and the password should travel through a separate trusted channel.",
    relatedSlugs: ["file-encryption", "password-generator", "sensitive-data-redactor"],
  },
  "jwt-decoder": {
    summary: "Read the header and payload of a JSON Web Token without sending the token to a decoding website.",
    useCases: ["Inspect claims while debugging authentication.", "Convert Base64URL token sections into readable JSON."],
    howItWorks: "The browser splits the token and decodes its header and payload sections locally. It also explains common time-based claims.",
    limitations: "Decoding does not verify the signature, issuer, audience, or trustworthiness. Tokens can contain sensitive data, so handle them like credentials.",
    relatedSlugs: ["json-formatter", "base64-converter", "sensitive-data-redactor"],
  },
};

export function getToolGuide(slug: string) {
  const guide = toolGuides[slug];
  if (!guide) throw new Error(`Missing practical guide for ${slug}`);
  return guide;
}
