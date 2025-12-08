import { readFileSync } from "node:fs";
import * as llxprtCore from "@vybestack/llxprt-code-core";
import {
  Config,
  ContentBlockGuards,
  ContentFactory,
  type ContentBlock,
  type IContent,
  type IProvider,
  SettingsService
} from "@vybestack/llxprt-code-core";
import { AnthropicProvider } from "@vybestack/llxprt-code-core";
import { GeminiProvider } from "@vybestack/llxprt-code-core";
import { OpenAIProvider } from "@vybestack/llxprt-code-core";

export type ProviderKey = "openai" | "gemini" | "anthropic";

export interface ProviderInfo {
  readonly id: ProviderKey;
  readonly label: string;
}

export interface ModelInfo {
  readonly id: string;
  readonly name: string;
}

export interface SessionConfig {
  readonly provider: ProviderKey;
  readonly model?: string;
  readonly apiKey?: string;
  readonly keyFilePath?: string;
  readonly baseUrl?: string;
}

export type AdapterEvent =
  | { readonly type: "text"; readonly lines: string[] }
  | { readonly type: "thinking"; readonly lines: string[] }
  | { readonly type: "tool"; readonly header: string; readonly lines: string[] };

const maybeCreateProviderRuntimeContext = (llxprtCore as {
  createProviderRuntimeContext?: (options: {
    settingsService: SettingsService;
    config: Config;
    runtimeId?: string;
    metadata?: Record<string, unknown>;
  }) => unknown;
}).createProviderRuntimeContext;

const maybeSetActiveProviderRuntimeContext = (llxprtCore as {
  setActiveProviderRuntimeContext?: (context: unknown) => void;
}).setActiveProviderRuntimeContext;

const maybeGetSettingsService = (llxprtCore as {
  getSettingsService?: () => SettingsService;
}).getSettingsService;

const maybeResetSettingsService = (llxprtCore as { resetSettingsService?: () => void }).resetSettingsService;

const PROVIDER_ENTRIES: ProviderInfo[] = [
  { id: "openai", label: "OpenAI" },
  { id: "openai-responses", label: "OpenAI Responses" },
  { id: "openai-vercel", label: "OpenAI (Vercel)" },
  { id: "gemini", label: "Gemini" },
  { id: "anthropic", label: "Anthropic" },
  { id: "synthetic", label: "Synthetic" },
  { id: "qwen", label: "Qwen" },
  { id: "qwen-openai", label: "Qwen (OpenAI API)" }
];

export function listProviders(): ProviderInfo[] {
  // Deduplicate by id in case we add aliases dynamically later
  const seen = new Set<string>();
  return PROVIDER_ENTRIES.filter((entry) => {
    if (seen.has(entry.id)) {
      return false;
    }
    seen.add(entry.id);
    return true;
  });
}

export async function listModels(session: SessionConfig): Promise<ModelInfo[]> {
  const { runtime } = buildSessionContext(session);
  withActiveRuntime(runtime);
  const provider = buildProvider(session);
  const models = await provider.getModels();
  return models.map((model) => ({ id: model.id, name: model.name }));
}

export async function* sendMessage(
  session: SessionConfig,
  prompt: string,
  signal?: AbortSignal
): AsyncGenerator<AdapterEvent> {
  const { settings, config, runtime } = buildSessionContext(session);
  const authProvider = buildAuthTokenProvider(session, settings);
  withActiveRuntime(runtime);
  const provider = buildProvider(session);
  if (isRuntimeAwareProvider(provider)) {
    provider.setRuntimeSettingsService(settings);
  }
  const contents: IContent[] = [ContentFactory.createUserMessage(prompt)];
  const iterator = startChatIterator(provider, {
    session,
    contents,
    settings,
    config,
    runtime,
    authProvider,
    signal
  });

  for await (const content of iterator) {
    if (signal?.aborted === true) {
      break;
    }
    yield* mapContentToEvents(content);
  }
}

function mapContentToEvents(content: IContent): AdapterEvent[] {
  const events: AdapterEvent[] = [];
  for (const block of content.blocks) {
    if (ContentBlockGuards.isTextBlock(block)) {
      events.push({ type: "text", lines: normalizeText(block.text) });
    } else if (ContentBlockGuards.isThinkingBlock(block)) {
      events.push({ type: "thinking", lines: normalizeText(block.thought) });
    } else if (ContentBlockGuards.isToolCallBlock(block)) {
      events.push({
        type: "tool",
        header: `[tool] ${block.name}`,
        lines: formatToolCall(block)
      });
    }
  }
  return events;
}

function normalizeText(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

function formatToolCall(block: Extract<ContentBlock, { type: "tool_call" }>): string[] {
  const lines: string[] = [];
  lines.push(`id: ${block.id}`);
  lines.push(`params: ${formatParams(block.parameters)}`);
  return lines;
}

function formatParams(params: unknown): string {
  try {
    return JSON.stringify(params);
  } catch {
    return String(params);
  }
}

function resolveAuthToken(session: SessionConfig): string | undefined {
  if (session.apiKey?.trim()) {
    return session.apiKey.trim();
  }
  if (session.keyFilePath?.trim()) {
    try {
      const contents = readFileSync(session.keyFilePath, "utf8").trim();
      return contents.length > 0 ? contents : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function buildAuthTokenProvider(session: SessionConfig, settings: SettingsService): { provide: () => Promise<string | undefined> } {
  return {
    provide: (): Promise<string | undefined> => {
      const direct = resolveAuthToken(session);
      if (direct) {
        return Promise.resolve(direct);
      }
      const providerSettings = settings.getProviderSettings(session.provider) as Record<string, unknown> | undefined;
      const fromProvider = (providerSettings?.["auth-key"] as string | undefined) ?? (providerSettings?.apiKey as string | undefined);
      if (fromProvider?.trim()) {
        return Promise.resolve(fromProvider.trim());
      }
      const globalKey = settings.get("auth-key") as string | undefined;
      if (globalKey?.trim()) {
        return Promise.resolve(globalKey.trim());
      }
      return Promise.resolve(undefined);
    }
  };
}

function buildProvider(session: SessionConfig): IProvider {
  const authToken = resolveAuthToken(session);
  const baseUrl = session.baseUrl;
  if (session.provider === "gemini") {
    return new GeminiProvider(authToken, baseUrl);
  }
  if (session.provider === "anthropic") {
    return new AnthropicProvider(authToken, baseUrl);
  }
  return new OpenAIProvider(authToken, baseUrl);
}

function isRuntimeAwareProvider(
  provider: IProvider
): provider is IProvider & { setRuntimeSettingsService: (settings: SettingsService) => void } {
  return typeof (provider as { setRuntimeSettingsService?: unknown }).setRuntimeSettingsService === "function";
}

function buildSessionContext(session: SessionConfig): {
  settings: SettingsService;
  config: Config;
  runtime?: unknown;
} {
  const settings = acquireSettingsService();
  settings.set("base-url", session.baseUrl ?? "");
  settings.set("model", session.model ?? "");
  settings.set("activeProvider", session.provider);
  settings.setProviderSetting(session.provider, "baseUrl", session.baseUrl ?? "");
  settings.setProviderSetting(session.provider, "model", session.model ?? "");
  const authToken = resolveAuthToken(session);
  if (authToken) {
    settings.set("auth-key", authToken);
    settings.setProviderSetting(session.provider, "auth-key", authToken);
    settings.setProviderSetting(session.provider, "apiKey", authToken);
  }
  if (session.keyFilePath) {
    settings.set("auth-keyfile", session.keyFilePath);
    settings.setProviderSetting(session.provider, "auth-keyfile", session.keyFilePath);
    settings.setProviderSetting(session.provider, "apiKeyfile", session.keyFilePath);
  }

  const config = createConfigStub(settings, session);
  const runtime = maybeCreateProviderRuntimeContext
    ? maybeCreateProviderRuntimeContext({
        settingsService: settings,
        config,
        runtimeId: "nui-runtime",
        metadata: { source: "nui-runtime-context" }
      })
    : undefined;

  return { settings, config, runtime };
}

function createConfigStub(settings: SettingsService, session: SessionConfig): Config {
  const noop = (): void => {
    /* intentionally empty */
  };

  const configShape = {
    getConversationLoggingEnabled: () => false,
    setConversationLoggingEnabled: noop,
    getTelemetryLogPromptsEnabled: () => false,
    setTelemetryLogPromptsEnabled: noop,
    getUsageStatisticsEnabled: () => false,
    setUsageStatisticsEnabled: noop,
    getDebugMode: () => false,
    setDebugMode: noop,
    getSessionId: () => "nui-session",
    setSessionId: noop,
    getFlashFallbackMode: () => "off",
    setFlashFallbackMode: noop,
    getProvider: () => session.provider,
    setProvider: noop,
    getSettingsService: () => settings,
    getProviderSettings: (name: string) => (name === session.provider ? settings.getProviderSettings(name) : {}),
    setProviderSettings: noop,
    getProviderConfig: () => ({}),
    setProviderConfig: noop,
    resetProvider: noop,
    resetProviderSettings: noop,
    resetProviderConfig: noop,
    getActiveWorkspace: () => undefined as string | undefined,
    setActiveWorkspace: noop,
    clearActiveWorkspace: noop,
    getExtensionConfig: () => ({}),
    setExtensionConfig: noop,
    getFeatures: () => ({}),
    setFeatures: noop,
    getRedactionConfig: () => ({ replacements: [] }),
    setProviderManager: noop,
    getProviderManager: () => undefined,
    getProviderSetting: () => undefined,
    getEphemeralSettings: () => ({ model: session.model ?? "" }),
    getEphemeralSetting: () => undefined,
    setEphemeralSetting: noop,
    getUserMemory: () => "",
    setUserMemory: noop,
    getModel: () => session.model ?? "",
    setModel: noop,
    getQuotaErrorOccurred: () => false,
    setQuotaErrorOccurred: noop,
    getContentGeneratorConfig: () => ({
      authType: "api_key",
      model: session.model ?? "",
      provider: session.provider
    })
  } satisfies Partial<Config> & Record<string, unknown>;

  const config = Object.assign({}, configShape) as Config;
  Object.setPrototypeOf(config, Config.prototype);
  return config;
}

function withActiveRuntime(runtime: unknown): void {
  if (runtime !== undefined && typeof maybeSetActiveProviderRuntimeContext === "function") {
    maybeSetActiveProviderRuntimeContext(runtime);
  }
}

function acquireSettingsService(): SettingsService {
  if (typeof maybeResetSettingsService === "function") {
    maybeResetSettingsService();
  }
  const service = typeof maybeGetSettingsService === "function" ? maybeGetSettingsService() : new SettingsService();
  if (typeof (service as { clear?: () => void }).clear === "function") {
    (service as { clear: () => void }).clear();
  }
  return service;
}

function startChatIterator(
  provider: IProvider,
  options: {
    session: SessionConfig;
    contents: IContent[];
    settings: SettingsService;
    config: Config;
    runtime?: unknown;
    authProvider: { provide: () => Promise<string | undefined> };
    signal?: AbortSignal;
  }
): AsyncIterableIterator<IContent> {
  const generate = provider.generateChatCompletion.bind(provider) as unknown as (...args: unknown[]) => AsyncIterableIterator<IContent>;
  if (generate.length > 1) {
    return generate(options.contents, undefined, options.signal);
  }
  return generate({
    contents: options.contents,
    settings: options.settings,
    config: options.config,
    runtime: options.runtime,
    resolved: {
      model: options.session.model,
      baseURL: options.session.baseUrl,
      authToken: options.authProvider,
      streaming: true
    },
    signal: options.signal
  });
}
