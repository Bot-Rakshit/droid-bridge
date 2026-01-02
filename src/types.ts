/**
 * Type definitions for the Droid Provider Bridge
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
    projectId?: string;
    sessionToken?: string;  // For Codex
    isActive: boolean;
    lastUsed?: number;
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
    // ==========================================================================
    // Antigravity - Claude Models
    // ==========================================================================
    "claude-sonnet-4.5": {
        id: "claude-sonnet-4.5",
        displayName: "Claude Sonnet 4.5",
        provider: "antigravity",
        actualModel: "claude-sonnet-4-5",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 200000,
        outputLimit: 64000,
    },
    // Claude Sonnet Thinking - Low/Medium/High
    "claude-sonnet-4.5-thinking-low": {
        id: "claude-sonnet-4.5-thinking-low",
        displayName: "Claude Sonnet 4.5 Thinking (Low)",
        provider: "antigravity",
        actualModel: "claude-sonnet-4-5-thinking",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 200000,
        outputLimit: 64000,
        isThinking: true,
        thinkingBudget: 8000,
    },
    "claude-sonnet-4.5-thinking-medium": {
        id: "claude-sonnet-4.5-thinking-medium",
        displayName: "Claude Sonnet 4.5 Thinking (Medium)",
        provider: "antigravity",
        actualModel: "claude-sonnet-4-5-thinking",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 200000,
        outputLimit: 64000,
        isThinking: true,
        thinkingBudget: 16000,
    },
    "claude-sonnet-4.5-thinking-high": {
        id: "claude-sonnet-4.5-thinking-high",
        displayName: "Claude Sonnet 4.5 Thinking (High)",
        provider: "antigravity",
        actualModel: "claude-sonnet-4-5-thinking",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 200000,
        outputLimit: 64000,
        isThinking: true,
        thinkingBudget: 32000,
    },
    // Claude Opus Thinking - Low/Medium/High
    "claude-opus-4.5-thinking-low": {
        id: "claude-opus-4.5-thinking-low",
        displayName: "Claude Opus 4.5 Thinking (Low)",
        provider: "antigravity",
        actualModel: "claude-opus-4-5-thinking",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 200000,
        outputLimit: 64000,
        isThinking: true,
        thinkingBudget: 8000,
    },
    "claude-opus-4.5-thinking-medium": {
        id: "claude-opus-4.5-thinking-medium",
        displayName: "Claude Opus 4.5 Thinking (Medium)",
        provider: "antigravity",
        actualModel: "claude-opus-4-5-thinking",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 200000,
        outputLimit: 64000,
        isThinking: true,
        thinkingBudget: 16000,
    },
    "claude-opus-4.5-thinking-high": {
        id: "claude-opus-4.5-thinking-high",
        displayName: "Claude Opus 4.5 Thinking (High)",
        provider: "antigravity",
        actualModel: "claude-opus-4-5-thinking",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 200000,
        outputLimit: 64000,
        isThinking: true,
        thinkingBudget: 32000,
    },
    // ==========================================================================
    // Antigravity - Gemini 3 Models
    // ==========================================================================
    "gemini-3-flash": {
        id: "gemini-3-flash",
        displayName: "Gemini 3 Flash",
        provider: "antigravity",
        actualModel: "gemini-3-flash",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 1048576,
        outputLimit: 65536,
    },
    "gemini-3-pro-low": {
        id: "gemini-3-pro-low",
        displayName: "Gemini 3 Pro (Low)",
        provider: "antigravity",
        actualModel: "gemini-3-pro-low",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 1048576,
        outputLimit: 65535,
        isThinking: true,
        thinkingLevel: "low",
    },
    "gemini-3-pro-high": {
        id: "gemini-3-pro-high",
        displayName: "Gemini 3 Pro (High)",
        provider: "antigravity",
        actualModel: "gemini-3-pro-high",
        endpoint: "https://daily-cloudcode-pa.sandbox.googleapis.com",
        contextLimit: 1048576,
        outputLimit: 65535,
        isThinking: true,
        thinkingLevel: "high",
    },
    // ==========================================================================
    // Codex - GPT Models (via ChatGPT Pro subscription)
    // ==========================================================================
    "gpt-5.2": {
        id: "gpt-5.2",
        displayName: "GPT-5.2",
        provider: "codex",
        actualModel: "gpt-5.2",
        endpoint: "https://chatgpt.com/backend-api",
        contextLimit: 128000,
        outputLimit: 32000,
    },
    "gpt-5.2-thinking": {
        id: "gpt-5.2-thinking",
        displayName: "GPT-5.2 Thinking",
        provider: "codex",
        actualModel: "gpt-5.2-thinking",
        endpoint: "https://chatgpt.com/backend-api",
        contextLimit: 256000,
        outputLimit: 64000,
        isThinking: true,
    },
    "gpt-5.2-codex": {
        id: "gpt-5.2-codex",
        displayName: "GPT-5.2 Codex",
        provider: "codex",
        actualModel: "gpt-5.2-codex",
        endpoint: "https://chatgpt.com/backend-api",
        contextLimit: 256000,
        outputLimit: 64000,
    },
};

// =============================================================================
// OpenAI-compatible API Types
// =============================================================================

export interface ContentPart {
    type: "text" | "image_url" | "image";
    text?: string;
    image_url?: { url: string; detail?: "auto" | "low" | "high" };
    source?: { type: string; media_type: string; data: string };
}

export interface ToolCall {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
}

export interface Tool {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters?: Record<string, unknown>;
    };
}

export interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | ContentPart[];
    name?: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}

export interface APIRequest {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    top_k?: number;
    stop?: string[];
    stream?: boolean;
    tools?: Tool[];
    tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
}

export interface APIResponse {
    id: string;
    object: "chat.completion" | "chat.completion.chunk";
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
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
    thoughtSignature?: string;
    functionCall?: {
        name: string;
        args: Record<string, unknown>;
        id?: string;
    };
    functionResponse?: {
        name: string;
        id?: string;
        response: unknown;
    };
    inlineData?: {
        mimeType: string;
        data: string;
    };
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
        systemInstruction?: {
            parts: { text: string }[];
        };
        generationConfig?: {
            maxOutputTokens?: number;
            temperature?: number;
            topP?: number;
            topK?: number;
            stopSequences?: string[];
            thinkingConfig?: {
                thinkingBudget?: number;
                includeThoughts?: boolean;
                thinking_budget?: number;
                include_thoughts?: boolean;
                thinkingLevel?: string;
            };
        };
        tools?: Array<{
            functionDeclarations: Array<{
                name: string;
                description?: string;
                parameters?: Record<string, unknown>;
            }>;
        }>;
        toolConfig?: {
            functionCallingConfig?: {
                mode?: string;
            };
        };
    };
    userAgent?: string;
    requestId?: string;
}

export interface AntigravityResponse {
    response: {
        candidates: Array<{
            content: {
                role: "model";
                parts: AntigravityPart[];
            };
            finishReason?: "STOP" | "MAX_TOKENS" | "OTHER";
        }>;
        usageMetadata?: {
            promptTokenCount: number;
            candidatesTokenCount: number;
            totalTokenCount: number;
            thoughtsTokenCount?: number;
        };
        modelVersion?: string;
        responseId?: string;
    };
    traceId?: string;
}
