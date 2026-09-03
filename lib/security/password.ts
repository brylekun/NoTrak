export type PasswordOptions = {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
};

const CHARACTER_GROUPS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
} as const;

const AMBIGUOUS_CHARACTERS = new Set("Il1O0o|`'\"");

function randomIndex(maxExclusive: number) {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1) {
    throw new Error("The character set must not be empty.");
  }

  const range = 0x1_0000_0000;
  const limit = range - (range % maxExclusive);
  const sample = new Uint32Array(1);
  let value = 0;

  do {
    globalThis.crypto.getRandomValues(sample);
    value = sample[0];
  } while (value >= limit);

  return value % maxExclusive;
}

function pick(characters: string) {
  return characters[randomIndex(characters.length)];
}

function secureShuffle(characters: string[]) {
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const target = randomIndex(index + 1);
    [characters[index], characters[target]] = [characters[target], characters[index]];
  }
  return characters;
}

export function generatePassword(options: PasswordOptions) {
  const groups = (Object.keys(CHARACTER_GROUPS) as Array<keyof typeof CHARACTER_GROUPS>)
    .filter((key) => options[key])
    .map((key) => CHARACTER_GROUPS[key])
    .map((characters) =>
      options.avoidAmbiguous
        ? [...characters].filter((character) => !AMBIGUOUS_CHARACTERS.has(character)).join("")
        : characters,
    );

  if (groups.length === 0) {
    throw new Error("Choose at least one character type.");
  }

  if (!Number.isSafeInteger(options.length) || options.length < groups.length || options.length > 128) {
    throw new Error(`Password length must be between ${groups.length} and 128.`);
  }

  const alphabet = groups.join("");
  const password = groups.map(pick);

  while (password.length < options.length) {
    password.push(pick(alphabet));
  }

  return secureShuffle(password).join("");
}

export function estimateEntropy(length: number, alphabetSize: number) {
  if (length < 1 || alphabetSize < 2) return 0;
  return Math.floor(length * Math.log2(alphabetSize));
}

export function getAlphabetSize(options: PasswordOptions) {
  return (Object.keys(CHARACTER_GROUPS) as Array<keyof typeof CHARACTER_GROUPS>)
    .filter((key) => options[key])
    .map((key) => CHARACTER_GROUPS[key])
    .join("")
    .split("")
    .filter((character) => !options.avoidAmbiguous || !AMBIGUOUS_CHARACTERS.has(character)).length;
}
