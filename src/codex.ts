/**
 * Codex Provider
 * 
 * Handles ChatGPT Pro/Codex subscription authentication and API calls for:
 * - GPT-4.5
 * - GPT-5 Codex
 * 
 * Authentication is done via session token from browser cookies.
 */

import * as crypto from "node:crypto";
import type {
    ProviderAccount,
    ModelConfig,
    ChatMessage,
    Tool,
    APIResponse,
} from "./types.js";
import { upsertAccount } from "./storage.js";

const CODEX_API_URL = "https://chatgpt.com/backend-api";
const CODEX_CONVERSATION_URL = `${CODEX_API_URL}/conversation`;

/**
 * Instructions for getting ChatGPT session token.
 */
export function getCodexAuthInstructions(): string {
    return `
To add a ChatGPT Pro account:

1. Open https://chatgpt.com in your browser
2. Log in with your ChatGPT Pro account
3. Open Developer Tools (F12)
4. Go to Application > Cookies > https://chatgpt.com
5. Find the cookie named "__Secure-next-auth.session-token"
6. Copy the entire value

Then run:
  npm run add-account -- --provider codex --token "YOUR_SESSION_TOKEN"

Note: Session tokens expire periodically. You may need to refresh them.
`;
}

/**
 * Verify a Codex session token and get user info.
 */
export async function verifyCodexToken(
    sessionToken: string
): Promise<{ email: string; isProUser: boolean }> {
    const response = await fetch(`${CODEX_API_URL}/me`, {
        headers: {
            "Content-Type": "application/json",
            Cookie: `__Secure-next-auth.session-token=${sessionToken}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Token verification failed: ${response.status}`);
    }

    const data = await response.json() as {
        email: string;
        plan_type?: string;
        entitlement?: { available_models?: string[] };
    };

    // Check if user has Pro/Codex access
    const isProUser = data.plan_type === "plus" ||
        data.plan_type === "pro" ||
        (data.entitlement?.available_models ?? []).some(m =>
            m.includes("gpt-4") || m.includes("gpt-5") || m.includes("codex")
        );

    return {
        email: data.email,
        isProUser,
    };
}

/**
 * Create a Codex account from session token.
 */
export async function createCodexAccount(
    sessionToken: string
): Promise<ProviderAccount> {
    const { email, isProUser } = await verifyCodexToken(sessionToken);

    if (!isProUser) {
        console.warn("⚠️ This account may not have Pro/Codex access");
    }

    const account: ProviderAccount = {
        id: `codex-${crypto.randomUUID().slice(0, 8)}`,
        provider: "codex",
        email,
        accessToken: "", // Not used for Codex
        refreshToken: "", // Not applicable
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days estimate
        sessionToken,
        isActive: true,
    };

    upsertAccount(account);
    return account;
}

/**
 * Refresh/verify a Codex account token.
 */
export async function refreshCodexToken(account: ProviderAccount): Promise<ProviderAccount> {
    if (!account.sessionToken) {
        throw new Error("No session token available");
    }

    // Verify the token still works
    const { email } = await verifyCodexToken(account.sessionToken);

    // Update last used
    account.lastUsed = Date.now();
    account.email = email;
    upsertAccount(account);

    return account;
}

/**
 * Convert messages to Codex format.
 */
function convertMessages(messages: ChatMessage[]): Array<{
    id: string;
    author: { role: string };
    content: { content_type: string; parts: string[] };
}> {
    const result: Array<{
        id: string;
        author: { role: string };
        content: { content_type: string; parts: string[] };
    }> = [];

    for (const msg of messages) {
        if (msg.role === "system") continue; // System is handled separately
        if (msg.role === "tool") continue; // Tool responses handled inline

        const role = msg.role === "assistant" ? "assistant" : "user";
        let text = "";

        if (typeof msg.content === "string") {
            text = msg.content;
        } else if (Array.isArray(msg.content)) {
            text = msg.content
                .filter(p => p.type === "text")
                .map(p => p.text)
                .join("\n");
        }

        if (text) {
            result.push({
                id: crypto.randomUUID(),
                author: { role },
                content: { content_type: "text", parts: [text] },
            });
        }
    }

    return result;
}

/**
 * Get system message from messages.
 */
function getSystemMessage(messages: ChatMessage[]): string | undefined {
    const systemMsgs = messages.filter(m => m.role === "system");
    if (systemMsgs.length === 0) return undefined;

    return systemMsgs
        .map(m => typeof m.content === "string" ? m.content : "")
        .join("\n\n");
}

/**
 * Make a Codex API request.
 */
export async function callCodex(
    account: ProviderAccount,
    model: ModelConfig,
    messages: ChatMessage[],
    _tools?: Tool[],
    options?: { maxTokens?: number; temperature?: number; stream?: boolean }
): Promise<Response> {
    if (!account.sessionToken) {
        throw new Error("No session token available");
    }

    const convertedMessages = convertMessages(messages);
    const systemMessage = getSystemMessage(messages);

    const parentMessageId = crypto.randomUUID();

    const request = {
        action: "next",
        messages: convertedMessages,
        parent_message_id: parentMessageId,
        model: model.actualModel,
        timezone_offset_min: new Date().getTimezoneOffset(),
        suggestions: [],
        history_and_training_disabled: true,
        conversation_mode: { kind: "primary_assistant" },
        force_paragen: false,
        force_rate_limit: false,
        system_hints: systemMessage ? [systemMessage] : undefined,
    };

    return fetch(CODEX_CONVERSATION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: `__Secure-next-auth.session-token=${account.sessionToken}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "text/event-stream",
        },
        body: JSON.stringify(request),
    });
}

/**
 * Parse Codex SSE response.
 */
export async function* parseCodexStream(
    response: Response,
    model: string,
    requestId: string
): AsyncGenerator<{
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: { role?: string; content?: string };
        finish_reason: string | null;
    }>;
}> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
                yield {
                    id: requestId,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                };
                return;
            }

            try {
                const parsed = JSON.parse(data);
                const content = parsed.message?.content?.parts?.[0];

                if (content && typeof content === "string") {
                    yield {
                        id: requestId,
                        object: "chat.completion.chunk",
                        created: Math.floor(Date.now() / 1000),
                        model,
                        choices: [{ index: 0, delta: { content }, finish_reason: null }],
                    };
                }
            } catch {
                // Skip malformed JSON
            }
        }
    }
}

/**
 * Parse Codex response to OpenAI format.
 */
export function parseCodexResponse(
    text: string,
    model: string,
    requestId: string
): APIResponse {
    // Codex returns SSE, parse the last data message
    const lines = text.split("\n").filter(l => l.startsWith("data: "));
    let content = "";

    for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
            const parsed = JSON.parse(data);
            const parts = parsed.message?.content?.parts;
            if (parts?.[0]) {
                content = parts[0];
            }
        } catch {
            // Skip
        }
    }

    return {
        id: requestId,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
            index: 0,
            message: { role: "assistant", content: content || null },
            finish_reason: "stop",
        }],
    };
}
