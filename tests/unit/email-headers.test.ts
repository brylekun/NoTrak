import { describe, expect, it } from "vitest";

import {
  analyzeEmailHeaders,
  formatHopDelay,
  isPrivateIpAddress,
  organizationalDomain,
  parseMailbox,
  unfoldHeaderFields,
} from "../../lib/security/email-headers";

const CLEAN_HEADERS = [
  "Received: from mail.example.com (mail.example.com [203.0.113.10])",
  "\tby mx.recipient.test with ESMTPS id abc123;",
  "\tTue, 1 Sep 2026 09:14:02 +0000",
  "Received: from sender-host.example.com ([198.51.100.7])",
  "\tby mail.example.com with ESMTPSA id def456;",
  "\tTue, 1 Sep 2026 09:13:44 +0000",
  "Authentication-Results: mx.recipient.test; spf=pass smtp.mailfrom=example.com;",
  "\tdkim=pass header.d=example.com; dmarc=pass header.from=example.com",
  "DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=sel; b=AAAA",
  "From: Example Support <support@example.com>",
  "Return-Path: <bounces@example.com>",
  "To: person@recipient.test",
  "Subject: Your September receipt",
  "Date: Tue, 1 Sep 2026 09:13:40 +0000",
  "Message-ID: <abc-123@example.com>",
].join("\n");

function signalIds(raw: string) {
  return analyzeEmailHeaders(raw).signals.map((item) => item.id);
}

describe("header unfolding", () => {
  it("joins continuation lines into a single field value", () => {
    const fields = unfoldHeaderFields("Subject: part one\n\tpart two\nFrom: a@b.test");

    expect(fields).toEqual([
      { name: "Subject", value: "part one part two" },
      { name: "From", value: "a@b.test" },
    ]);
  });

  it("stops at the blank line so a pasted body is never read as headers", () => {
    const fields = unfoldHeaderFields("From: a@b.test\n\nSubject: this is body text\nnot-a-header");

    expect(fields).toEqual([{ name: "From", value: "a@b.test" }]);
  });

  it("keeps repeated fields in order and preserves an empty value", () => {
    const fields = unfoldHeaderFields("Received: one\nReceived: two\nX-Empty:");

    expect(fields.filter((field) => field.name === "Received").map((field) => field.value)).toEqual(["one", "two"]);
    expect(fields.at(-1)).toEqual({ name: "X-Empty", value: "" });
  });

  it("treats an unindented continuation as part of the previous field", () => {
    // Mail clients often lose the leading tab when a block is copied by hand.
    const fields = unfoldHeaderFields("Received: from a.test\nby b.test; Tue, 1 Sep 2026 09:14:02 +0000");

    expect(fields).toHaveLength(1);
    expect(fields[0].value).toContain("by b.test");
  });
});

describe("mailbox parsing", () => {
  it("separates a display name from the real address", () => {
    expect(parseMailbox('"Example Support" <support@example.com>')).toEqual({
      displayName: "Example Support",
      address: "support@example.com",
      domain: "example.com",
      organizationalDomain: "example.com",
    });
  });

  it("handles a bare address with no display name", () => {
    expect(parseMailbox("person@recipient.test")).toMatchObject({
      displayName: undefined,
      address: "person@recipient.test",
      domain: "recipient.test",
    });
  });

  it("reads the domain after the last @ in a spoofed display name", () => {
    expect(parseMailbox("billing@bank.test <attacker@evil.test>")).toMatchObject({
      displayName: "billing@bank.test",
      address: "attacker@evil.test",
      domain: "evil.test",
    });
  });
});

describe("organizational domain comparison", () => {
  it("reduces a subdomain to its registrable domain", () => {
    expect(organizationalDomain("mail.corp.example.com")).toBe("example.com");
  });

  it("keeps three labels for a known two-part suffix", () => {
    expect(organizationalDomain("mail.example.co.uk")).toBe("example.co.uk");
  });
});

describe("private address detection", () => {
  it("recognizes private, loopback, link-local, and CGNAT ranges", () => {
    for (const address of ["10.0.0.4", "192.168.1.20", "172.16.5.5", "127.0.0.1", "169.254.1.1", "100.64.0.1"]) {
      expect(isPrivateIpAddress(address), address).toBe(true);
    }
    expect(isPrivateIpAddress("::1")).toBe(true);
    expect(isPrivateIpAddress("fd00::1")).toBe(true);
    expect(isPrivateIpAddress("::ffff:10.0.0.4")).toBe(true);
  });

  it("treats routable addresses as public", () => {
    for (const address of ["203.0.113.10", "198.51.100.7", "8.8.8.8", "172.32.0.1", "2606:4700::1111"]) {
      expect(isPrivateIpAddress(address), address).toBe(false);
    }
  });
});

describe("delivery chain", () => {
  it("orders hops from the earliest visible server toward the recipient", () => {
    const report = analyzeEmailHeaders(CLEAN_HEADERS);

    expect(report.hops.map((hop) => hop.ip)).toEqual(["198.51.100.7", "203.0.113.10"]);
    expect(report.hops[0]).toMatchObject({ position: 1, from: "sender-host.example.com", by: "mail.example.com" });
    expect(report.originatingIp).toBe("198.51.100.7");
    expect(report.originatingIpIsPrivate).toBe(false);
  });

  it("measures the gap between consecutive dated hops", () => {
    const report = analyzeEmailHeaders(CLEAN_HEADERS);

    expect(report.hops[0].delaySeconds).toBeUndefined();
    expect(report.hops[1].delaySeconds).toBe(18);
    expect(report.transitSeconds).toBe(18);
  });

  it("prefers the bracketed literal over a hostname that also contains digits", () => {
    const report = analyzeEmailHeaders([
      "Received: from smtp7.example.com (smtp7.example.com [203.0.113.44])",
      "\tby mx.test; Tue, 1 Sep 2026 09:14:02 +0000",
      "From: a@example.com",
    ].join("\n"));

    expect(report.hops[0].ip).toBe("203.0.113.44");
  });

  it("flags a chain that starts on a private address", () => {
    const report = analyzeEmailHeaders([
      "Received: from internal.corp ([10.20.30.40])",
      "\tby mx.test; Tue, 1 Sep 2026 09:14:02 +0000",
      "From: a@example.com",
      "Message-ID: <x@example.com>",
    ].join("\n"));

    expect(report.originatingIpIsPrivate).toBe(true);
    expect(report.signals.map((item) => item.id)).toContain("private-origin");
  });

  it("notices timestamps that run backwards", () => {
    const report = analyzeEmailHeaders([
      "Received: from b.test by mx.test; Tue, 1 Sep 2026 09:00:00 +0000",
      "Received: from a.test by b.test; Tue, 1 Sep 2026 12:00:00 +0000",
      "From: a@example.com",
      "Message-ID: <x@example.com>",
    ].join("\n"));

    expect(report.signals.map((item) => item.id)).toContain("negative-delay");
  });
});

describe("authentication results", () => {
  it("parses each method, its verdict, and the reporting server", () => {
    const report = analyzeEmailHeaders(CLEAN_HEADERS);

    expect(report.auth).toEqual([
      { method: "spf", verdict: "pass", reportedBy: "mx.recipient.test", detail: "smtp.mailfrom=example.com" },
      { method: "dkim", verdict: "pass", reportedBy: "mx.recipient.test", detail: "header.d=example.com" },
      { method: "dmarc", verdict: "pass", reportedBy: "mx.recipient.test", detail: "header.from=example.com" },
    ]);
  });

  it("falls back to Received-SPF only when no Authentication-Results SPF exists", () => {
    const withFallback = analyzeEmailHeaders([
      "Received-SPF: fail (example.com: domain does not designate 198.51.100.9)",
      "From: a@example.com",
      "Message-ID: <x@example.com>",
    ].join("\n"));

    expect(withFallback.auth[0]).toMatchObject({ method: "spf", verdict: "fail" });

    const withBoth = analyzeEmailHeaders([
      "Authentication-Results: mx.test; spf=pass smtp.mailfrom=example.com",
      "Received-SPF: fail (should not override)",
      "From: a@example.com",
    ].join("\n"));

    expect(withBoth.auth.filter((result) => result.method === "spf")).toEqual([
      { method: "spf", verdict: "pass", reportedBy: "mx.test", detail: "smtp.mailfrom=example.com" },
    ]);
  });

  it("marks an unrecognized verdict as unknown rather than guessing", () => {
    const report = analyzeEmailHeaders("Authentication-Results: mx.test; spf=weird\nFrom: a@example.com");

    expect(report.auth[0]).toMatchObject({ method: "spf", verdict: "unknown" });
  });
});

describe("risk signals", () => {
  it("reports no signals for a fully authenticated message", () => {
    const report = analyzeEmailHeaders(CLEAN_HEADERS);

    expect(report.signals).toEqual([]);
    expect(report.score).toBe(0);
    expect(report.level).toBe("low");
  });

  it("rates a DMARC failure as high risk", () => {
    const report = analyzeEmailHeaders([
      "Received: from evil.test ([198.51.100.9]) by mx.test; Tue, 1 Sep 2026 09:14:02 +0000",
      "Authentication-Results: mx.test; spf=fail; dkim=fail; dmarc=fail",
      "From: Bank Support <support@bank.test>",
      "Message-ID: <x@bank.test>",
    ].join("\n"));

    expect(report.level).toBe("high");
    expect(report.signals.map((item) => item.id)).toEqual(
      expect.arrayContaining(["dmarc-fail", "spf-fail", "dkim-fail"]),
    );
  });

  it("catches an address hidden behind a lookalike display name", () => {
    const ids = signalIds([
      "Received: from evil.test ([198.51.100.9]) by mx.test; Tue, 1 Sep 2026 09:14:02 +0000",
      "Authentication-Results: mx.test; spf=pass; dkim=pass; dmarc=pass",
      "From: billing@bank.test <invoices@totally-different.test>",
      "Message-ID: <x@totally-different.test>",
    ].join("\n"));

    expect(ids).toContain("display-name-address");
  });

  it("flags a Punycode sender domain and a mixed-script display name", () => {
    const punycode = signalIds([
      "Authentication-Results: mx.test; spf=pass; dkim=pass; dmarc=pass",
      "From: Support <help@xn--bank-w1a.test>",
      "Message-ID: <x@xn--bank-w1a.test>",
    ].join("\n"));
    expect(punycode).toContain("punycode-from");

    const mixed = signalIds([
      "Authentication-Results: mx.test; spf=pass; dkim=pass; dmarc=pass",
      "From: Раypal Support <help@example.com>",
      "Message-ID: <x@example.com>",
    ].join("\n"));
    expect(mixed).toContain("display-name-scripts");
  });

  it("flags a Reply-To on another organizational domain", () => {
    const ids = signalIds([
      "Authentication-Results: mx.test; spf=pass; dkim=pass; dmarc=pass",
      "From: Support <support@example.com>",
      "Reply-To: recovery@mailbox-elsewhere.test",
      "Message-ID: <x@example.com>",
    ].join("\n"));

    expect(ids).toContain("reply-to-mismatch");
  });

  it("treats a subdomain Reply-To as the same organization", () => {
    const ids = signalIds([
      "Authentication-Results: mx.test; spf=pass; dkim=pass; dmarc=pass",
      "From: Support <support@example.com>",
      "Reply-To: desk@help.example.com",
      "Message-ID: <x@example.com>",
    ].join("\n"));

    expect(ids).not.toContain("reply-to-mismatch");
  });

  it("stays quiet about a platform bounce domain when DMARC passed", () => {
    const passing = signalIds([
      "Authentication-Results: mx.test; spf=pass; dkim=pass; dmarc=pass",
      "From: News <news@example.com>",
      "Return-Path: <bounce-123@sendingplatform.test>",
      "Message-ID: <x@example.com>",
    ].join("\n"));
    expect(passing).not.toContain("return-path-mismatch");

    const unverified = signalIds([
      "Authentication-Results: mx.test; spf=none",
      "From: News <news@example.com>",
      "Return-Path: <bounce-123@sendingplatform.test>",
      "Message-ID: <x@example.com>",
    ].join("\n"));
    expect(unverified).toContain("return-path-mismatch");
  });

  it("notes a missing Message-ID and missing authentication verdicts", () => {
    const ids = signalIds("From: a@example.com\nSubject: hello");

    expect(ids).toEqual(expect.arrayContaining(["no-auth-results", "dkim-missing", "no-message-id", "no-received"]));
  });

  it("counts a DKIM signature so a passing message is not told it lacks one", () => {
    const report = analyzeEmailHeaders(CLEAN_HEADERS);

    expect(report.dkimSignatureCount).toBe(1);
    expect(report.signals.map((item) => item.id)).not.toContain("dkim-missing");
  });

  it("recognizes urgency wording in the subject", () => {
    const ids = signalIds([
      "Authentication-Results: mx.test; spf=pass; dkim=pass; dmarc=pass",
      "From: Support <support@example.com>",
      "Subject: Urgent: verify your account within 24 hours",
      "Message-ID: <x@example.com>",
    ].join("\n"));

    expect(ids).toContain("subject-pressure");
  });

  it("caps the score at 100 no matter how many signals accumulate", () => {
    const report = analyzeEmailHeaders([
      "Authentication-Results: mx.test; spf=fail; dkim=fail; dmarc=fail",
      "From: billing@bank.test <attacker@xn--evil-w1a.test>",
      "Reply-To: elsewhere@another.test",
      "Subject: Urgent action required to avoid account suspension",
    ].join("\n"));

    expect(report.score).toBe(100);
    expect(report.level).toBe("high");
  });
});

describe("input guards", () => {
  it("requires a non-empty block", () => {
    expect(() => analyzeEmailHeaders("   ")).toThrow("Paste an email header block");
  });

  it("rejects text with no header fields at all", () => {
    expect(() => analyzeEmailHeaders("just some prose with no colon-delimited fields")).toThrow("No email headers");
  });

  it("rejects an oversized block before parsing it", () => {
    expect(() => analyzeEmailHeaders(`From: a@b.test\n${"X-Pad: value\n".repeat(20_000)}`)).toThrow("too large");
  });
});

describe("hop delay formatting", () => {
  it("scales units and keeps a negative sign", () => {
    expect(formatHopDelay(18)).toBe("18s");
    expect(formatHopDelay(600)).toBe("10m");
    expect(formatHopDelay(9_000)).toBe("2.5h");
    expect(formatHopDelay(172_800)).toBe("2.0d");
    expect(formatHopDelay(-45)).toBe("-45s");
  });
});
