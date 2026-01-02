/**
 * Antigravity Provider
 * 
 * Handles Google Antigravity authentication and API calls for:
 * - Claude Sonnet 4.5, Opus 4.5
 * - Gemini 3 Pro, Flash
 */

import * as crypto from "node:crypto";
import type {
    ProviderAccount,
    ModelConfig,
    ChatMessage,
    Tool,
    AntigravityContent,
    AntigravityPart,
    AntigravityRequest,
    AntigravityResponse,
    APIResponse,
    ContentPart,
} from "./types.js";
import { upsertAccount } from "./storage.js";

// OAuth configuration for Google Antigravity
const ANTIGRAVITY_CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const ANTIGRAVITY_CLIENT_SECRET = "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";
const ANTIGRAVITY_SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/cclog",
    "https://www.googleapis.com/auth/experimentsandconfigs",
].join(" ");
const ANTIGRAVITY_DEFAULT_PROJECT_ID = "anthropic-web-app";

const ANTIGRAVITY_HEADERS = {
    "User-Agent": "antigravity/1.11.5 windows/amd64",
    "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
    "Client-Metadata": '{"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}',
} as const;

/**
 * Generate Google OAuth URL for Antigravity login.
 */
export function getAntigravityAuthUrl(port: number): string {
    const redirectUri = `http://localhost:${port}/callback`;
    const params = new URLSearchParams({
        client_id: ANTIGRAVITY_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: ANTIGRAVITY_SCOPES,
        access_type: "offline",
        prompt: "consent",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeAntigravityCode(
    code: string,
    port: number
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; email: string }> {
    const redirectUri = `http://localhost:${port}/callback`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: ANTIGRAVITY_CLIENT_ID,
            client_secret: ANTIGRAVITY_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        }),
    });

    if (!response.ok) {
        throw new Error(`Token exchange failed: ${await response.text()}`);
    }

    const data = await response.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
    };

    // Get user email
    const userInfo = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const user = await userInfo.json() as { email: string };

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        email: user.email,
    };
}

/**
 * Refresh an Antigravity access token.
 */
export async function refreshAntigravityToken(account: ProviderAccount): Promise<ProviderAccount> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: ANTIGRAVITY_CLIENT_ID,
            client_secret: ANTIGRAVITY_CLIENT_SECRET,
            refresh_token: account.refreshToken,
            grant_type: "refresh_token",
        }),
    });

    if (!response.ok) {
        throw new Error(`Token refresh failed: ${await response.text()}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };

    account.accessToken = data.access_token;
    account.expiresAt = Date.now() + data.expires_in * 1000;
    upsertAccount(account);

    return account;
}

/**
 * Fields that Antigravity API doesn't support in JSON Schema.
 */
const UNSUPPORTED_SCHEMA_FIELDS = new Set([
    "definitions", "$schema", "$id", "$ref", "$defs",
    "exclusiveMinimum", "exclusiveMaximum",
    "minLength", "maxLength", "pattern", "format",
    "minItems", "maxItems", "uniqueItems", "additionalItems", "contains",
    "additionalProperties", "propertyNames", "minProperties", "maxProperties",
    "allOf", "anyOf", "oneOf", "not",
    "if", "then", "else", "const",
    "contentMediaType", "contentEncoding", "examples", "default",
    "deprecated", "readOnly", "writeOnly",
]);

/**
 * Clean JSON Schema for Antigravity API.
 */
function cleanSchema(obj: unknown): Record<string, unknown> | unknown[] | unknown {
    if (!obj || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => cleanSchema(item)).filter(Boolean);
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (key.startsWith("$") || UNSUPPORTED_SCHEMA_FIELDS.has(key)) continue;

        if (value && typeof value === "object") {
            const cleaned = cleanSchema(value);
            if (cleaned !== null && cleaned !== undefined) {
                result[key] = cleaned;
            }
        } else {
            result[key] = value;
        }
    }

    if (result["properties"] && !result["type"]) {
        result["type"] = "object";
    }

    return result;
}

/**
 * Convert OpenAI messages to Antigravity format.
 */
function convertMessages(messages: ChatMessage[]): {
    contents: AntigravityContent[];
    systemInstruction?: { parts: { text: string }[] };
} {
    const contents: AntigravityContent[] = [];
    let systemInstruction: { parts: { text: string }[] } | undefined;

    // Collect tool responses
    const toolResponses = new Map<string, { name: string; content: unknown }>();
    for (const msg of messages) {
        if (msg.role === "tool" && msg.tool_call_id) {
            let response: unknown;
            try {
                response = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
            } catch {
                response = { result: msg.content };
            }
            toolResponses.set(msg.tool_call_id, { name: msg.name || "unknown", content: response });
        }
    }

    let pendingToolResponses: AntigravityPart[] = [];

    for (const msg of messages) {
        if (msg.role === "tool") continue;

        if (msg.role === "system") {
            const text = typeof msg.content === "string"
                ? msg.content
                : (msg.content as ContentPart[])?.filter(p => p.type === "text").map(p => p.text).join("\n") || "";

            if (systemInstruction) {
                systemInstruction.parts[0]!.text += "\n\n" + text;
            } else {
                systemInstruction = { parts: [{ text }] };
            }
            continue;
        }

        const role = msg.role === "assistant" ? "model" : "user";
        const parts: AntigravityPart[] = [];

        // Add pending tool responses before user messages
        if (role === "user" && pendingToolResponses.length > 0) {
            contents.push({ role: "user", parts: pendingToolResponses });
            pendingToolResponses = [];
        }

        // Handle content
        if (typeof msg.content === "string" && msg.content) {
            parts.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
                if (part.type === "text" && part.text) {
                    parts.push({ text: part.text });
                } else if (part.type === "image_url" && part.image_url?.url?.startsWith("data:")) {
                    const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
                    if (match?.[1] && match[2]) {
                        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
                    }
                }
            }
        }

        // Handle tool calls
        if (msg.tool_calls?.length) {
            for (const tc of msg.tool_calls) {
                try {
                    parts.push({
                        functionCall: {
                            name: tc.function.name,
                            args: JSON.parse(tc.function.arguments),
                            id: tc.id,
                        },
                    });
                } catch {
                    parts.push({
                        functionCall: { name: tc.function.name, args: {}, id: tc.id },
                    });
                }
            }

            // Collect tool responses
            for (const tc of msg.tool_calls) {
                const response = toolResponses.get(tc.id);
                if (response) {
                    pendingToolResponses.push({
                        functionResponse: { name: response.name, id: tc.id, response: response.content },
                    });
                }
            }
        }

        if (parts.length > 0) {
            contents.push({ role, parts });
        }

        // Add tool responses after assistant messages with tool calls
        if (msg.role === "assistant" && msg.tool_calls?.length && pendingToolResponses.length > 0) {
            contents.push({ role: "user", parts: pendingToolResponses });
            pendingToolResponses = [];
        }
    }

    if (pendingToolResponses.length > 0) {
        contents.push({ role: "user", parts: pendingToolResponses });
    }

    return { contents, systemInstruction };
}

/**
 * Convert tools to Antigravity format.
 */
function convertTools(tools: Tool[] | undefined): Array<{ functionDeclarations: Array<Record<string, unknown>> }> | undefined {
    if (!tools?.length) return undefined;

    const functionDeclarations = tools
        .filter(t => t.type === "function" && t.function)
        .map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: cleanSchema(t.function.parameters) as Record<string, unknown>,
        }));

    return functionDeclarations.length ? [{ functionDeclarations }] : undefined;
}

/**
 * Make an Antigravity API request.
 */
export async function callAntigravity(
    account: ProviderAccount,
    model: ModelConfig,
    messages: ChatMessage[],
    tools?: Tool[],
    options?: { maxTokens?: number; temperature?: number; stream?: boolean }
): Promise<Response> {
    const { contents, systemInstruction } = convertMessages(messages);
    const convertedTools = convertTools(tools);

    // Detect tool history (disable thinking for Claude)
    const hasToolHistory = messages.some(m =>
        (m.role === "assistant" && m.tool_calls?.length) || m.role === "tool"
    );
    const isClaude = model.actualModel.includes("claude");
    const shouldUseThinking = model.isThinking && !(isClaude && hasToolHistory);

    const request: AntigravityRequest = {
        project: account.projectId || ANTIGRAVITY_DEFAULT_PROJECT_ID,
        model: model.actualModel,
        request: {
            contents,
            generationConfig: {
                maxOutputTokens: options?.maxTokens ?? model.outputLimit,
                temperature: options?.temperature,
            },
        },
        userAgent: "droid-provider-bridge",
        requestId: `bridge-${crypto.randomUUID()}`,
    };

    if (systemInstruction) {
        request.request.systemInstruction = systemInstruction;
    }

    if (convertedTools) {
        request.request.tools = convertedTools;
        if (isClaude) {
            request.request.toolConfig = { functionCallingConfig: { mode: "VALIDATED" } };
        }
    }

    if (shouldUseThinking) {
        if (model.thinkingBudget) {
            request.request.generationConfig!.thinkingConfig = {
                thinking_budget: model.thinkingBudget,
                include_thoughts: true,
            };
            if ((request.request.generationConfig!.maxOutputTokens ?? 0) <= model.thinkingBudget) {
                request.request.generationConfig!.maxOutputTokens = 128000;
            }
        } else if (model.thinkingLevel) {
            request.request.generationConfig!.thinkingConfig = {
                thinkingLevel: model.thinkingLevel,
                includeThoughts: true,
            };
        }
    }

    const endpoint = options?.stream
        ? `${model.endpoint}/v1internal:streamGenerateContent?alt=sse`
        : `${model.endpoint}/v1internal:generateContent`;

    return fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${account.accessToken}`,
            ...ANTIGRAVITY_HEADERS,
        },
        body: JSON.stringify(request),
    });
}

/**
 * Parse Antigravity response to OpenAI format.
 */
export function parseAntigravityResponse(
    response: AntigravityResponse,
    model: string,
    requestId: string
): APIResponse {
    const candidate = response.response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    let textContent = "";
    const toolCalls: APIResponse["choices"][0]["message"]["tool_calls"] = [];

    for (const part of parts) {
        if (part.text && !part.thought) {
            textContent += part.text;
        }
        if (part.functionCall) {
            toolCalls.push({
                id: part.functionCall.id || `call_${crypto.randomUUID().slice(0, 8)}`,
                type: "function",
                function: {
                    name: part.functionCall.name,
                    arguments: JSON.stringify(part.functionCall.args),
                },
            });
        }
    }

    const finishReason = candidate?.finishReason === "STOP" ? "stop"
        : candidate?.finishReason === "MAX_TOKENS" ? "length"
            : toolCalls.length > 0 ? "tool_calls"
                : "stop";

    return {
        id: requestId,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
            index: 0,
            message: {
                role: "assistant",
                content: textContent || null,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            },
            finish_reason: finishReason,
        }],
        usage: {
            prompt_tokens: response.response.usageMetadata?.promptTokenCount ?? 0,
            completion_tokens: response.response.usageMetadata?.candidatesTokenCount ?? 0,
            total_tokens: response.response.usageMetadata?.totalTokenCount ?? 0,
        },
    };
}
