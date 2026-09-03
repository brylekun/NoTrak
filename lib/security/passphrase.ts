export const PASSPHRASE_WORDS = [
  "acorn", "alpine", "amber", "anchor", "apple", "apron", "archer", "arrow",
  "atlas", "aurora", "autumn", "badger", "bamboo", "banner", "beacon", "berry",
  "bicycle", "birch", "bison", "blanket", "blossom", "bluebird", "boulder", "branch",
  "breeze", "bridge", "brook", "button", "cactus", "candle", "canyon", "caramel",
  "cedar", "cherry", "circle", "citrus", "cloud", "clover", "cobalt", "comet",
  "coral", "cosmos", "cotton", "cricket", "crystal", "dahlia", "daisy", "dawn",
  "delta", "denim", "desert", "dolphin", "dragon", "drift", "dune", "eagle",
  "earth", "echo", "ember", "emerald", "falcon", "feather", "fern", "festival",
  "field", "finch", "fjord", "flame", "flint", "flower", "forest", "fossil",
  "foxglove", "frost", "galaxy", "garden", "garnet", "ginger", "glacier", "glade",
  "glimmer", "granite", "grape", "grove", "harbor", "hazel", "heather", "heron",
  "hickory", "horizon", "island", "ivory", "jasper", "juniper", "kayak", "kelp",
  "kiwi", "lagoon", "lantern", "lark", "laurel", "lemon", "lilac", "linen",
  "lotus", "lunar", "maple", "marble", "marigold", "marina", "meadow", "melon",
  "meteor", "mint", "mist", "moon", "moss", "mountain", "nectar", "night",
  "north", "oak", "oasis", "ocean", "olive", "onyx", "orchid", "otter",
  "owl", "panda", "papaya", "pebble", "pepper", "petal", "pine", "planet",
  "plum", "pond", "prairie", "quartz", "quill", "rabbit", "rain", "raven",
  "reef", "river", "robin", "rose", "saffron", "sage", "sailor", "sand",
  "satin", "scarlet", "shadow", "shore", "silver", "sky", "slate", "snow",
  "solar", "sparrow", "spice", "spring", "spruce", "star", "stone", "storm",
  "summit", "sunrise", "surf", "swift", "tangerine", "thistle", "thunder", "tiger",
  "timber", "topaz", "trail", "tulip", "tundra", "valley", "velvet", "violet",
  "walnut", "water", "willow", "wind", "winter", "wren", "yarrow", "zephyr",
  "acoustic", "adventure", "airship", "almond", "anemone", "aster", "avocado", "balcony",
  "basil", "basket", "bell", "birchwood", "blueberry", "bonfire", "bramble", "bronze",
  "bubble", "buttercup", "cabana", "cardinal", "cascade", "castle", "celery", "chestnut",
  "cinnamon", "compass", "copper", "cove", "cranberry", "crescent", "current", "daylight",
  "dewdrop", "driftwood", "elm", "evergreen", "fable", "firefly", "flamingo", "fountain",
  "gardenia", "ginkgo", "goldfinch", "harvest", "hibiscus", "honey", "indigo", "iris",
  "jasmine", "kingfisher", "lavender", "lighthouse", "magnolia", "mandarin", "mango", "mercury",
  "midnight", "monarch", "mulberry", "mushroom", "nebula", "nutmeg", "obsidian", "opal",
  "orange", "origami", "palm", "peach", "peacock", "pinecone", "poppy", "rainbow",
  "raspberry", "redwood", "ripple", "rosemary", "seashell", "sequoia", "starlight", "sunflower",
  "teal", "terrace", "treetop", "waterfall", "wildflower", "woodland", "zinnia", "cypress",
] as const;

export type PassphraseOptions = {
  wordCount: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
};

function randomIndex(maxExclusive: number) {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1) {
    throw new Error("The word list must not be empty.");
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

export function generatePassphrase(options: PassphraseOptions) {
  if (!Number.isSafeInteger(options.wordCount) || options.wordCount < 4 || options.wordCount > 12) {
    throw new Error("Choose between 4 and 12 words.");
  }
  if (options.separator.length > 3 || /[\r\n]/u.test(options.separator)) {
    throw new Error("Use a separator up to 3 characters long.");
  }

  const words = Array.from({ length: options.wordCount }, () => {
    const word = PASSPHRASE_WORDS[randomIndex(PASSPHRASE_WORDS.length)];
    return options.capitalize ? `${word[0].toUpperCase()}${word.slice(1)}` : word;
  });

  if (options.includeNumber) {
    words[randomIndex(words.length)] += randomIndex(100).toString().padStart(2, "0");
  }

  return words.join(options.separator);
}

export function estimatePassphraseEntropy(wordCount: number, includeNumber: boolean) {
  if (wordCount < 1) return 0;
  return Math.floor(wordCount * Math.log2(PASSPHRASE_WORDS.length) + (includeNumber ? Math.log2(100) : 0));
}
