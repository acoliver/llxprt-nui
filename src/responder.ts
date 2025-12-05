import { randomInt } from "node:crypto";

const OPENERS = [
  "Camus shrugs at the sky,",
  "Nietzsche laughs in the dark,",
  "The void hums quietly while",
  "A hedonist clinks a glass because",
  "Sisyphus pauses mid-push as",
  "Dionysus sings over static and"
] as const;

const DRIVERS = [
  "meaning is negotiated then forgotten,",
  "willpower tastes like rusted metal,",
  "pleasure is an act of rebellion,",
  "every rule is a rumor,",
  "the abyss wants a conversation,",
  "time is a joke with a long punchline,"
] as const;

const SPINS = [
  "so I dance anyway.",
  "yet we still buy coffee at dawn.",
  "and the night market keeps buzzing.",
  "because absurd joy is cheaper than despair.",
  "while the sea keeps no memory.",
  "so breath becomes a quiet manifesto."
] as const;

export function secureRandomBetween(min: number, max: number): number {
  return randomInt(min, max + 1);
}

export function buildResponderLine(): string {
  return `${pick(OPENERS)} ${pick(DRIVERS)} ${pick(SPINS)}`;
}

export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function pick<T>(items: readonly T[]): T {
  return items[secureRandomBetween(0, items.length - 1)];
}
