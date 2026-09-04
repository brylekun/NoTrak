export type PasswordStrengthLevel = "very-weak" | "weak" | "fair" | "strong" | "very-strong";

export type PasswordSafetyAnalysis = {
  score: number;
  level: PasswordStrengthLevel;
  label: string;
  length: number;
  characterTypes: number;
  warnings: string[];
  suggestions: string[];
};

export type PwnedPasswordLookup = {
  prefix: string;
  suffix: string;
};

export const PWNED_PASSWORDS_RANGE_URL = "https://api.pwnedpasswords.com/range";

const COMMON_PASSWORDS = new Set([
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "abc123",
  "admin",
  "baseball",
  "correcthorsebatterystaple",
  "dragon",
  "football",
  "freedom",
  "hello",
  "iloveyou",
  "letmein",
  "login",
  "master",
  "monkey",
  "passw0rd",
  "password",
  "password1",
  "princess",
  "qwerty",
  "qwerty123",
  "sunshine",
  "trustno1",
  "welcome",
  "whatever",
]);

const SEQUENCES = [
  "0123456789",
  "9876543210",
  "abcdefghijklmnopqrstuvwxyz",
  "zyxwvutsrqponmlkjihgfedcba",
  "qwertyuiop",
  "poiuytrewq",
  "asdfghjkl",
  "lkjhgfdsa",
  "zxcvbnm",
  "mnbvcxz",
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function hasPredictableSequence(password: string) {
  const normalized = password.toLowerCase();
  return SEQUENCES.some((sequence) => {
    for (let index = 0; index <= sequence.length - 4; index += 1) {
      if (normalized.includes(sequence.slice(index, index + 4))) return true;
    }
    return false;
  });
}

function getCharacterTypeCount(password: string) {
  return [
    /\p{Ll}/u.test(password),
    /\p{Lu}/u.test(password),
    /\p{N}/u.test(password),
    /[^\p{L}\p{N}\s]/u.test(password),
  ].filter(Boolean).length;
}

function getLengthScore(length: number) {
  if (length < 6) return 5;
  if (length < 8) return 12;
  if (length < 12) return 25;
  if (length < 16) return 40;
  if (length < 20) return 55;
  if (length < 24) return 65;
  return 72;
}

function getStrengthLevel(score: number): Pick<PasswordSafetyAnalysis, "level" | "label"> {
  if (score < 20) return { level: "very-weak", label: "Very weak" };
  if (score < 40) return { level: "weak", label: "Weak" };
  if (score < 60) return { level: "fair", label: "Fair" };
  if (score < 80) return { level: "strong", label: "Strong" };
  return { level: "very-strong", label: "Very strong" };
}

export function analyzePasswordSafety(password: string): PasswordSafetyAnalysis {
  const characters = [...password];
  const length = characters.length;
  const characterTypes = getCharacterTypeCount(password);
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (length === 0) {
    return {
      score: 0,
      ...getStrengthLevel(0),
      length,
      characterTypes,
      warnings,
      suggestions: ["Enter a password to analyze it locally."],
    };
  }

  let score = getLengthScore(length);
  score += Math.max(0, characterTypes - 1) * 6;
  score += Math.round((new Set(characters).size / length) * 10);

  const normalized = password.trim().toLowerCase();
  const common = COMMON_PASSWORDS.has(normalized);
  const sequence = hasPredictableSequence(password);
  const repeatedCharacters = /(.)\1{2,}/u.test(password);
  const edgeWhitespace = password !== password.trim();

  if (common) {
    score = Math.min(score, 5);
    warnings.push("This password appears in NoTrak's small built-in common-password list.");
  }
  if (sequence) {
    score -= 20;
    warnings.push("It contains a predictable keyboard, letter, or number sequence.");
  }
  if (repeatedCharacters) {
    score -= 15;
    warnings.push("It repeats the same character three or more times.");
  }
  if (edgeWhitespace) {
    score -= 5;
    warnings.push("It begins or ends with whitespace, which may be accidental.");
  }
  if (characterTypes <= 1 && length < 20) score -= 10;

  if (length < 12) suggestions.push("Use at least 12 characters; 16 or more is a safer target.");
  else if (length < 16) suggestions.push("Consider increasing the length to 16 characters or more.");
  if (characterTypes < 3 && length < 20) {
    suggestions.push("Mix character types, or use a substantially longer multi-word passphrase.");
  }
  if (sequence) suggestions.push("Replace predictable sequences with unrelated words or random characters.");
  if (repeatedCharacters) suggestions.push("Avoid runs of the same character.");
  if (common) suggestions.push("Choose a unique password that you have never used for another account.");

  const boundedScore = clamp(Math.round(score), 0, 100);

  return {
    score: boundedScore,
    ...getStrengthLevel(boundedScore),
    length,
    characterTypes,
    warnings,
    suggestions,
  };
}

export async function createPwnedPasswordLookup(password: string): Promise<PwnedPasswordLookup> {
  if (!password) throw new Error("Enter a password before checking the breach corpus.");
  if (!globalThis.crypto?.subtle) throw new Error("This browser does not provide the required hashing API.");

  // HIBP's range protocol specifically uses SHA-1 as a lookup identifier. It is
  // never used here to store a password or protect data.
  const digest = await globalThis.crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  return { prefix: hash.slice(0, 5), suffix: hash.slice(5) };
}

export function findPwnedPasswordCount(responseText: string, expectedSuffix: string) {
  const normalizedSuffix = expectedSuffix.trim().toUpperCase();
  if (!/^[A-F0-9]{35}$/u.test(normalizedSuffix)) return 0;

  for (const line of responseText.split(/\r?\n/u)) {
    const [suffix, rawCount] = line.trim().split(":", 2);
    if (suffix?.toUpperCase() !== normalizedSuffix || !/^\d+$/u.test(rawCount ?? "")) continue;
    const count = Number(rawCount);
    return Number.isSafeInteger(count) && count > 0 ? count : 0;
  }

  return 0;
}
