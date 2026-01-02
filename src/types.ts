/**
 * Droid Provider Bridge - Type Definitions
 * 
 * Supports:
 * - Antigravity (Google) - Claude Sonnet/Opus, Gemini 3 Pro/Flash
 * - Codex (OpenAI) - GPT-4.5, GPT-5 Codex (via ChatGPT Pro subscription)
 */

// =============================================================================
// Provider Types
// =============================================================================

export type Provider = "antigravity" | "codex";

export interface ProviderAccount {
    id: string;
    provider: Provider;
    email: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    projectId?: string;  // For Antigravity
    sessionToken?: string;  // For Codex
    lastUsed?: number;
    isActive: boolean;
}

export interface AccountStorage {
    version: number;
    accounts: ProviderAccount[];
}

// =============================================================================
// Model Configuration
// =============================================================================

export interface ModelConfig {
    id: string;
    displayName: string;
    provider: Provider;
    actualModel: string;
    endpoint: string;
    contextLimit: number;
    outputLimit: number;
    isThinking?: boolean;
    thinkingBudget?: number;
    thinkingLevel?: string;
}

// Available models
export const MODELS: Record<string, ModelConfig> = {
    // Antigravity - Claude Models
    "claude-sonnet-4.5": {
        id: "claude-sonnet-4.5",
        displayName: "Claude Sonnet 4.5",
        provider: "antigravity",
        actualModel: "claude-sonnet-4-5",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 200000,
        outputLimit: 64000,
    },
    "claude-sonnet-4.5-thinking": {
        id: "claude-sonnet-4.5-thinking",
        displayName: "Claude Sonnet 4.5 (Thinking)",
        provider: "antigravity",
        actualModel: "claude-sonnet-4-5-thinking",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 200000,
        outputLimit: 64000,
        isThinking: true,
        thinkingBudget: 16000,
    },
    "claude-opus-4.5-thinking": {
        id: "claude-opus-4.5-thinking",
        displayName: "Claude Opus 4.5 (Thinking)",
        provider: "antigravity",
        actualModel: "claude-opus-4-5-thinking",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 200000,
        outputLimit: 64000,
        isThinking: true,
        thinkingBudget: 32000,
    },
    // Antigravity - Gemini 3 Models
    "gemini-3-flash": {
        id: "gemini-3-flash",
        displayName: "Gemini 3 Flash",
        provider: "antigravity",
        actualModel: "gemini-3-flash",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 1048576,
        outputLimit: 65536,
    },
    "gemini-3-pro": {
        id: "gemini-3-pro",
        displayName: "Gemini 3 Pro",
        provider: "antigravity",
        actualModel: "gemini-3-pro-high",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 1048576,
        outputLimit: 65535,
        isThinking: true,
        thinkingLevel: "high",
    },
    // Codex - GPT Models (via ChatGPT Pro) - PLACEHOLDER
    // These require proper ChatGPT session token integration
    "gpt-4.5": {
        id: "gpt-4.5",
        displayName: "GPT-4.5",
        provider: "codex",
        actualModel: "gpt-4.5-preview",
        endpoint: "https://chatgpt.com/backend-api",
        contextLimit: 128000,
        outputLimit: 32000,
    },
};

// =============================================================================
// OpenAI-Compatible API Types
// =============================================================================

export interface ContentPart {
    type: "text" | "image_url" | "image";
    text?: string;
    image_url?: { url: string; detail?: string };
    source?: { type: string; media_type: string; data: string };
}

export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

export interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | ContentPart[] | null;
    name?: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}

export interface Tool {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters?: Record<string, unknown>;
    };
}

export interface APIRequest {
    model: string;
    messages: ChatMessage[];
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    stop?: string[];
    tools?: Tool[];
}

export interface APIResponse {
    id: string;
    object: "chat.completion";
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: "assistant";
            content: string | null;
            tool_calls?: ToolCall[];
        };
        finish_reason: "stop" | "length" | "tool_calls" | null;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

// =============================================================================
// Antigravity API Types
// =============================================================================

export interface AntigravityPart {
    text?: string;
    thought?: boolean;
    inlineData?: { mimeType: string; data: string };
    functionCall?: { name: string; args: Record<string, unknown>; id?: string };
    functionResponse?: { name: string; id?: string; response: unknown };
}

export interface AntigravityContent {
    role: "user" | "model";
    parts: AntigravityPart[];
}

export interface AntigravityRequest {
    project: string;
    model: string;
    request: {
        contents: AntigravityContent[];
        generationConfig?: {
            maxOutputTokens?: number;
            temperature?: number;
            topP?: number;
            topK?: number;
            stopSequences?: string[];
            thinkingConfig?: Record<string, unknown>;
        };
        systemInstruction?: { parts: { text: string }[] };
        tools?: Array<{ functionDeclarations: Array<Record<string, unknown>> }>;
        toolConfig?: { functionCallingConfig: { mode: string } };
    };
    userAgent: string;
    requestId: string;
}

export interface AntigravityResponse {
    response: {
        candidates?: Array<{
            content?: { parts?: AntigravityPart[] };
            finishReason?: string;
        }>;
        usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
            thoughtsTokenCount?: number;
        };
    };
}

// =============================================================================
// Codex/ChatGPT API Types
// =============================================================================

export interface CodexMessage {
    id: string;
    author: { role: string };
    content: { content_type: string; parts: string[] };
    metadata?: Record<string, unknown>;
}

export interface CodexRequest {
    action: "next";
    messages: Array<{
        id: string;
        author: { role: string };
        content: { content_type: string; parts: string[] };
    }>;
    parent_message_id: string;
    model: string;
    timezone_offset_min: number;
    suggestions: string[];
    history_and_training_disabled: boolean;
    conversation_mode: { kind: string };
    force_paragen: boolean;
    force_rate_limit: boolean;
}

export interface CodexResponse {
    message?: CodexMessage;
    conversation_id?: string;
    error?: string;
}
