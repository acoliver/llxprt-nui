import { secureRandomBetween } from "./random";

export interface ToolCallBlock {
  readonly lines: string[];
  readonly isBatch: boolean;
}

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

export function buildResponderLine(): string {
  return `${pick(OPENERS)} ${pick(DRIVERS)} ${pick(SPINS)}`;
}

const THOUGHTS = [
  "I should tell the user about the abyss.",
  "Perhaps hedonism is the answer.",
  "Maybe the code hides a better metaphor.",
  "I'd like to learn more about the codebase; maybe I'll send a tool call.",
  "Is meaning just another branch to merge?",
  "Should I warn them the void has opinions?"
] as const;

export function buildThinkingLine(): string {
  return pick(THOUGHTS);
}

export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function pick<T>(items: readonly T[]): T {
  return items[secureRandomBetween(0, items.length - 1)];
}

type ToolKind = "ReadFile" | "Glob" | "SearchInFile";

const SAMPLE_FILES = [
  "src/app.tsx",
  "src/modalShell.tsx",
  "src/searchSelectModal.tsx",
  "src/history.ts",
  "scripts/check-limits.ts"
];

const SAMPLE_PATTERNS = ["useState", "Modal", "stream", "return", "export function", "const "];

export function maybeBuildToolCalls(): ToolCallBlock | null {
  if (secureRandomBetween(0, 6) !== 0) {
    return null;
  }
  const parallel = secureRandomBetween(0, 1) === 1;
  const count = secureRandomBetween(1, 5);
  const calls = Array.from({ length: count }, () => buildToolCallLines(randomToolKind())).flat();
  if (parallel) {
    return { lines: [`[tool batch] ${count} calls`, ...calls.map((line) => `  ${line}`)], isBatch: true };
  }
  return { lines: calls, isBatch: false };
}

function buildToolCallLines(kind: ToolKind): string[] {
  if (kind === "ReadFile") {
    const file = pick(SAMPLE_FILES);
    const start = secureRandomBetween(3, 40);
    const end = start + secureRandomBetween(2, 6);
    return [
      formatToolHeader(`ReadFile ${file} ${start}-${end}`),
      `    ${start}: // simulated code line`,
      `    ${start + 1}: // more simulated code`,
      `    ${end}: // eof snippet`
    ];
  }
  if (kind === "Glob") {
    const pattern = pick(["./*.ts", "./src/*.tsx", "./**/*.ts"]);
    return [
      formatToolHeader(`Glob ${pattern}`),
      `    -> ${pick(SAMPLE_FILES)}`,
      `    -> ${pick(SAMPLE_FILES)}`
    ];
  }
  const file = pick(SAMPLE_FILES);
  const pattern = pick(SAMPLE_PATTERNS);
  const first = secureRandomBetween(5, 60);
  return [
    formatToolHeader(`SearchInFile ${file} "${pattern}"`),
    `    ${first}: match: ${pattern}()`,
    `    ${first + secureRandomBetween(1, 10)}: match: ${pattern} // more`
  ];
}

function formatToolHeader(description: string): string {
  return `[tool] ${description}`;
}

function randomToolKind(): ToolKind {
  const kinds: ToolKind[] = ["ReadFile", "Glob", "SearchInFile"];
  return kinds[secureRandomBetween(0, kinds.length - 1)];
}
