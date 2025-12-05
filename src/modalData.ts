import type { AuthOption } from "./authModal";
import type { SearchItem } from "./modalTypes";

export const MODEL_OPTIONS: SearchItem[] = [
  { id: "qwen-72b", label: "Qwen/Qwen2.5-72B-Instruct" },
  { id: "qwen-coder-32b", label: "Qwen/Qwen2.5-Coder-32B-Instruct" },
  { id: "qwen-vl-32b", label: "Qwen/Qwen2.5-VL-32B-Instruct" },
  { id: "qwen-vl-72b", label: "Qwen/Qwen2.5-VL-72B-Instruct" },
  { id: "qwen3-14b", label: "Qwen/Qwen3-14B" },
  { id: "qwen3-235b-a22b", label: "Qwen/Qwen3-235B-A22B" },
  { id: "qwen3-235b-a22b-instruct", label: "Qwen/Qwen3-235B-A22B-Instruct-2507" },
  { id: "qwen3-235b-a22b-thinking", label: "Qwen/Qwen3-235B-A22B-Thinking-2507" },
  { id: "qwen3-30b-a3b", label: "Qwen/Qwen3-30B-A3B" },
  { id: "qwen3-30b-a3b-instruct", label: "Qwen/Qwen3-30B-A3B-Instruct-2507" },
  { id: "qwen3-32b", label: "Qwen/Qwen3-32B" },
  { id: "qwen3-coder-30b", label: "Qwen/Qwen3-Coder-30B-A3B-Instruct" },
  { id: "qwen3-coder-480b", label: "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8" },
  { id: "qwen3-next-80b", label: "Qwen/Qwen3-Next-80B-A3B-Instruct" },
  { id: "qwen3-vl-235b-instruct", label: "Qwen/Qwen3-VL-235B-A22B-Instruct" },
  { id: "qwen3-vl-235b-thinking", label: "Qwen/Qwen3-VL-235B-A22B-Thinking" },
  { id: "rednote-dots", label: "rednote-hilab/dots.ocr" },
  { id: "deepseek-r1t", label: "tngtech/DeepSeek-R1T-Chimera" },
  { id: "deepseek-r1t2", label: "tngtech/DeepSeek-TNG-R1T2-Chimera" },
  { id: "tng-chimera", label: "tngtech/TNG-R1T-Chimera" },
  { id: "unsloth-gemma-12b", label: "unsloth/gemma-3-12b-it" },
  { id: "unsloth-gemma-27b", label: "unsloth/gemma-3-27b-it" },
  { id: "unsloth-gemma-4b", label: "unsloth/gemma-3-4b-it" },
  { id: "unsloth-mistral-nemo", label: "unsloth/Mistral-Nemo-Instruct-2407" },
  { id: "unsloth-mistral-small", label: "unsloth/Mistral-Small-24B-Instruct-2501" },
  { id: "zai-glm-45", label: "zai-org/GLM-4.5" },
  { id: "zai-glm-45-air", label: "zai-org/GLM-4.5-Air" },
  { id: "zai-glm-46", label: "zai-org/GLM-4.6" }
];

export const PROVIDER_OPTIONS: SearchItem[] = [
  { id: "anthropic", label: "anthropic" },
  { id: "gemini", label: "gemini" },
  { id: "openai", label: "openai" },
  { id: "cerebras", label: "Cerebras Code" },
  { id: "chutes", label: "Chutes.ai" },
  { id: "fireworks", label: "Fireworks" },
  { id: "llama-cpp", label: "llama.cpp" },
  { id: "lm-studio", label: "LM Studio" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "qwen", label: "qwen" },
  { id: "synthetic", label: "Synthetic" },
  { id: "xai", label: "xAI" }
];

export const AUTH_DEFAULTS: AuthOption[] = [
  { id: "gemini", label: "1. Gemini (Google OAuth)", enabled: true },
  { id: "qwen", label: "2. Qwen (OAuth)", enabled: true },
  { id: "anthropic", label: "3. Anthropic Claude (OAuth)", enabled: true },
  { id: "close", label: "4. Close", enabled: false }
];
