import { readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listModels, sendMessage, type AdapterEvent, type ProviderKey, type SessionConfig } from "./llxprtAdapter";

const SYNTHETIC_PROFILE_PATH = path.join(os.homedir(), ".llxprt/profiles/synthetic.json");

function loadSyntheticSession(): SessionConfig | null {
  if (!existsSync(SYNTHETIC_PROFILE_PATH)) {
    return null;
  }
  try {
    const profile = JSON.parse(readFileSync(SYNTHETIC_PROFILE_PATH, "utf8")) as {
      provider?: string;
      model?: string;
      baseUrl?: string;
      authKeyfile?: string;
      ephemeralSettings?: Record<string, unknown>;
    };
    const ephemeral = profile.ephemeralSettings ?? {};
    const provider = normalizeProvider(profile.provider);
    const baseUrl = (ephemeral["base-url"] ?? ephemeral.baseUrl ?? profile.baseUrl) as string | undefined;
    const keyFilePath = (ephemeral["auth-keyfile"] ?? ephemeral.authKeyfile ?? profile.authKeyfile) as string | undefined;
    const model = (profile.model ?? ephemeral.model) as string | undefined;

    if (!provider || !baseUrl || !keyFilePath || !model) {
      return null;
    }
    return { provider, baseUrl, keyFilePath, model };
  } catch {
    return null;
  }
}

function normalizeProvider(raw?: string): ProviderKey | null {
  if (!raw) {
    return null;
  }
  const lowered = raw.toLowerCase();
  if (lowered === "openai" || lowered === "gemini" || lowered === "anthropic") {
    return lowered;
  }
  return null;
}

const syntheticSession = loadSyntheticSession();
const describeSynthetic = syntheticSession ? describe : describe.skip;

describeSynthetic("llxprtAdapter synthetic integration", () => {
  it(
    "lists models using the synthetic profile",
    async () => {
      const models = await listModels(syntheticSession as SessionConfig);
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((entry) => entry.id === (syntheticSession as SessionConfig).model)).toBeTruthy();
    },
    30000
  );

  it(
    "streams a short reply using the synthetic profile",
    async () => {
      const events: AdapterEvent[] = [];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        for await (const event of sendMessage(
          syntheticSession as SessionConfig,
          "Say hello in a single short sentence and stop.",
          controller.signal
        )) {
          events.push(event);
          const textLineCount = events
            .filter((entry): entry is Extract<AdapterEvent, { type: "text" }> => entry.type === "text")
            .flatMap((entry) => entry.lines).length;
          if (textLineCount >= 2) {
            break;
          }
        }
      } finally {
        clearTimeout(timeout);
      }

      const textLines = events
        .filter((entry): entry is Extract<AdapterEvent, { type: "text" }> => entry.type === "text")
        .flatMap((entry) => entry.lines);
      expect(textLines.length).toBeGreaterThan(0);
    },
    45000
  );
});
