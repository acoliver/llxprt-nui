import os from "node:os";
import path from "node:path";
import { ProfileManager } from "@vybestack/llxprt-code-core";
import type { ProviderKey, SessionConfig } from "./llxprtAdapter";

export interface ConfigCommandResult {
  readonly handled: boolean;
  readonly nextConfig: SessionConfig;
  readonly messages: string[];
}

interface ApplyOptions {
  readonly profileDir?: string;
  readonly profileManager?: ProfileManager;
}

const SYNTHETIC_PROFILE_DEFAULT = path.join(os.homedir(), ".llxprt/profiles/synthetic.json");

export async function applyConfigCommand(
  rawInput: string,
  current: SessionConfig,
  options?: ApplyOptions
): Promise<ConfigCommandResult> {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith("/")) {
    return Promise.resolve({ handled: false, nextConfig: current, messages: [] });
  }

  const body = trimmed.slice(1).trim();
  if (!body) {
    return Promise.resolve({ handled: false, nextConfig: current, messages: [] });
  }

  const tokens = body.split(/\s+/).filter((token) => token.length > 0);
  const [rawCommand, ...rest] = tokens;
  const command = rawCommand.toLowerCase();
  const argument = rest.join(" ").trim();

  if (command === "provider") {
    if (!argument) {
      return Promise.resolve({ handled: false, nextConfig: current, messages: [] });
    }
    return Promise.resolve(applyProvider(argument, current));
  }
  if (command === "baseurl" || command === "base-url" || command === "basurl") {
    return Promise.resolve(applyBaseUrl(argument, current));
  }
  if (command === "keyfile") {
    return Promise.resolve(applyKeyFile(argument, current));
  }
  if (command === "key") {
    return Promise.resolve(applyKey(argument, current));
  }
  if (command === "model") {
    if (!argument) {
      return Promise.resolve({ handled: false, nextConfig: current, messages: [] });
    }
    return Promise.resolve(applyModel(argument, current));
  }
  if (command === "profile") {
    return applyProfile(rest, current, options);
  }

  return Promise.resolve({ handled: false, nextConfig: current, messages: [] });
}

function applyProvider(argument: string, current: SessionConfig): ConfigCommandResult {
  if (!argument) {
    return {
      handled: true,
      nextConfig: current,
      messages: ["Provider is required. Usage: /provider <openai|gemini|anthropic>"]
    };
  }
  const provider = normalizeProvider(argument);
  if (!provider) {
    return {
      handled: true,
      nextConfig: current,
      messages: [`Unknown provider: ${argument}`]
    };
  }
  return {
    handled: true,
    nextConfig: { ...current, provider },
    messages: [`Provider set to ${provider}`]
  };
}

function applyBaseUrl(argument: string, current: SessionConfig): ConfigCommandResult {
  if (!argument) {
    return { handled: true, nextConfig: current, messages: ["Base URL is required. Usage: /baseurl <url>"] };
  }
  return {
    handled: true,
    nextConfig: { ...current, baseUrl: argument },
    messages: [`Base URL set to ${argument}`]
  };
}

function applyKeyFile(argument: string, current: SessionConfig): ConfigCommandResult {
  if (!argument) {
    return { handled: true, nextConfig: current, messages: ["Keyfile path is required. Usage: /keyfile <path>"] };
  }
  return {
    handled: true,
    nextConfig: { ...current, keyFilePath: argument, apiKey: undefined },
    messages: ["Keyfile configured"]
  };
}

function applyKey(argument: string, current: SessionConfig): ConfigCommandResult {
  if (!argument) {
    return { handled: true, nextConfig: current, messages: ["API key is required. Usage: /key <token>"] };
  }
  return {
    handled: true,
    nextConfig: { ...current, apiKey: argument, keyFilePath: undefined },
    messages: ["API key configured"]
  };
}

function applyModel(argument: string, current: SessionConfig): ConfigCommandResult {
  if (!argument) {
    return { handled: true, nextConfig: current, messages: ["Model is required. Usage: /model <id>"] };
  }
  return {
    handled: true,
    nextConfig: { ...current, model: argument },
    messages: [`Model set to ${argument}`]
  };
}

async function applyProfile(args: string[], current: SessionConfig, options?: ApplyOptions): Promise<ConfigCommandResult> {
  if (args.length === 0) {
    return { handled: true, nextConfig: current, messages: ["Profile name is required. Usage: /profile load <name>"] };
  }
  const [action, name] = args.length === 1 ? ["load", args[0]] : [args[0], args[1]];
  if (action?.toLowerCase() !== "load") {
    return { handled: true, nextConfig: current, messages: ["Usage: /profile load <name>"] };
  }
  if (!name) {
    return { handled: true, nextConfig: current, messages: ["Profile name is required. Usage: /profile load <name>"] };
  }

  const profileDir = options?.profileDir ?? path.dirname(SYNTHETIC_PROFILE_DEFAULT);
  const manager = options?.profileManager ?? new ProfileManager(profileDir);
  try {
    const profile = await manager.loadProfile(name);
    const ephemeral = profile.ephemeralSettings;
    const provider = normalizeProvider(profile.provider);
    const baseUrl = (ephemeral["base-url"] ?? ephemeral.baseUrl ?? profile.baseUrl) as string | undefined;
    const keyFilePath = (ephemeral["auth-keyfile"] ?? ephemeral.authKeyfile ?? profile.authKeyfile) as
      | string
      | undefined;
    const model = (ephemeral.model ?? profile.model) as string | undefined;

    if (!provider || !baseUrl || !keyFilePath || !model) {
      return {
        handled: true,
        nextConfig: current,
        messages: ["Synthetic profile is incomplete; need provider, base-url, auth-keyfile, and model."]
      };
    }

    return {
      handled: true,
      nextConfig: { ...current, provider, baseUrl, keyFilePath, model, apiKey: undefined },
      messages: ["Loaded synthetic profile"]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { handled: true, nextConfig: current, messages: [`Failed to load synthetic profile: ${message}`] };
  }
}

function normalizeProvider(input: string | undefined): ProviderKey | null {
  if (!input) {
    return null;
  }
  const lowered = input.trim().toLowerCase();
  if (lowered === "openai" || lowered === "gemini" || lowered === "anthropic") {
    return lowered;
  }
  return null;
}

export function validateSessionConfig(config: SessionConfig, options?: { requireModel?: boolean }): string[] {
  const messages: string[] = [];
  if (!config.baseUrl?.trim()) {
    messages.push("Base URL not set. Use /baseurl <url>.");
  }
  if (options?.requireModel !== false) {
    if (!config.model?.trim()) {
      messages.push("Model not set. Use /model <id>.");
    }
  }
  const hasKey = Boolean(config.apiKey?.trim() ?? config.keyFilePath?.trim());
  if (!hasKey) {
    messages.push("API key or keyfile not set. Use /key <token> or /keyfile <path>.");
  }
  return messages;
}

export async function listAvailableProfiles(options?: ApplyOptions): Promise<string[]> {
  const profileDir = options?.profileDir ?? path.dirname(SYNTHETIC_PROFILE_DEFAULT);
  const manager = options?.profileManager ?? new ProfileManager(profileDir);
  try {
    return await manager.listProfiles();
  } catch {
    return [];
  }
}
