/**
 * Droid Provider Bridge - Main Server
 * 
 * OpenAI-compatible API server that bridges to:
 * - Antigravity (Google): Claude Sonnet/Opus, Gemini 3 Pro/Flash
 * - Codex (OpenAI): GPT-4.5, GPT-5 Codex (via ChatGPT Pro)
 * 
 * Usage:
 *   npm start             # Start on default port 8787
 *   PORT=3000 npm start   # Start on custom port
 */

import * as http from "node:http";
import * as crypto from "node:crypto";
import {
    MODELS,
    type ProviderAccount,
    type ModelConfig,
    type APIRequest,
    type APIResponse,
    type AntigravityResponse,
} from "./types.js";
import { loadAccounts, getAccountsByProvider, upsertAccount } from "./storage.js";
import {
    refreshAntigravityToken,
    callAntigravity,
    parseAntigravityResponse,
} from "./antigravity.js";
import {
    callCodex,
    parseCodexResponse,
    parseCodexStream,
    refreshCodexToken,
} from "./codex.js";

// =============================================================================
// Server Configuration
// =============================================================================

const PORT = parseInt(process.env["PORT"] || "8787", 10);
const HOST = process.env["HOST"] || "127.0.0.1";

// Account management
let antigravityAccounts: ProviderAccount[] = [];
let codexAccounts: ProviderAccount[] = [];
let currentAntigravityIndex = 0;
let currentCodexIndex = 0;

// =============================================================================
// Account Management
// =============================================================================

async function initializeAccounts(): Promise<void> {
    console.log("🔄 Loading accounts...\n");

    // Load Antigravity accounts
    const agAccounts = getAccountsByProvider("antigravity");
    for (const account of agAccounts) {
        try {
            if (account.expiresAt < Date.now() + 60000) {
                console.log(`   🔑 Refreshing token for ${account.email}...`);
                await refreshAntigravityToken(account);
            }
            antigravityAccounts.push(account);
            console.log(`   ✅ Antigravity: ${account.email}`);
        } catch (error) {
            console.error(`   ❌ Failed to initialize ${account.email}:`, error);
        }
    }

    // Load Codex accounts
    const cxAccounts = getAccountsByProvider("codex");
    for (const account of cxAccounts) {
        try {
            await refreshCodexToken(account);
            codexAccounts.push(account);
            console.log(`   ✅ Codex: ${account.email}`);
        } catch (error) {
            console.error(`   ❌ Failed to initialize ${account.email}:`, error);
        }
    }

    console.log(`\n✅ Loaded ${antigravityAccounts.length} Antigravity + ${codexAccounts.length} Codex accounts\n`);
}

function getNextAccount(provider: "antigravity" | "codex"): ProviderAccount | null {
    if (provider === "antigravity") {
        if (antigravityAccounts.length === 0) return null;
        const account = antigravityAccounts[currentAntigravityIndex % antigravityAccounts.length]!;
        return account;
    } else {
        if (codexAccounts.length === 0) return null;
        const account = codexAccounts[currentCodexIndex % codexAccounts.length]!;
        return account;
    }
}

function rotateAccount(provider: "antigravity" | "codex"): ProviderAccount | null {
    if (provider === "antigravity") {
        currentAntigravityIndex++;
        console.log(`   🔄 Rotated to Antigravity account ${currentAntigravityIndex % antigravityAccounts.length + 1}`);
        return getNextAccount("antigravity");
    } else {
        currentCodexIndex++;
        console.log(`   🔄 Rotated to Codex account ${currentCodexIndex % codexAccounts.length + 1}`);
        return getNextAccount("codex");
    }
}

// =============================================================================
// Request Handling
// =============================================================================

async function handleChatCompletion(
    req: APIRequest,
    res: http.ServerResponse
): Promise<void> {
    const modelConfig = MODELS[req.model];
    if (!modelConfig) {
        sendError(res, 400, `Unknown model: ${req.model}. Available: ${Object.keys(MODELS).join(", ")}`);
        return;
    }

    const account = getNextAccount(modelConfig.provider);
    if (!account) {
        sendError(res, 503, `No ${modelConfig.provider} accounts available. Add one with: npm run add-account`);
        return;
    }

    const requestId = `chatcmpl-${crypto.randomUUID()}`;
    console.log(`📨 ${req.stream ? "Stream" : "Request"}: ${req.model} -> ${modelConfig.actualModel}`);

    try {
        let response: Response;

        if (modelConfig.provider === "antigravity") {
            // Refresh token if needed
            if (account.expiresAt < Date.now() + 60000) {
                await refreshAntigravityToken(account);
            }

            response = await callAntigravity(
                account,
                modelConfig,
                req.messages,
                req.tools,
                { maxTokens: req.max_tokens, temperature: req.temperature, stream: req.stream }
            );
        } else {
            response = await callCodex(
                account,
                modelConfig,
                req.messages,
                req.tools,
                { maxTokens: req.max_tokens, temperature: req.temperature, stream: req.stream }
            );
        }

        // Handle errors
        if (!response.ok) {
            const errorText = await response.text();

            // Rotate on rate limit
            if (response.status === 429) {
                console.log(`   ⚠️ Rate limited, rotating account...`);
                const newAccount = rotateAccount(modelConfig.provider);
                if (newAccount && newAccount.id !== account.id) {
                    // Retry with new account
                    return handleChatCompletion(req, res);
                }
            }

            console.error(`   ❌ API error ${response.status}:`, errorText.slice(0, 200));
            sendError(res, response.status, errorText);
            return;
        }

        // Handle streaming response
        if (req.stream) {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "Access-Control-Allow-Origin": "*",
            });

            if (modelConfig.provider === "antigravity") {
                await streamAntigravityResponse(response, res, req.model, requestId);
            } else {
                await streamCodexResponse(response, res, req.model, requestId);
            }
        } else {
            // Non-streaming
            const text = await response.text();
            let apiResponse: APIResponse;

            if (modelConfig.provider === "antigravity") {
                const data = JSON.parse(text) as AntigravityResponse;
                apiResponse = parseAntigravityResponse(data, req.model, requestId);
            } else {
                apiResponse = parseCodexResponse(text, req.model, requestId);
            }

            sendJSON(res, 200, apiResponse);
        }

        // Update last used
        account.lastUsed = Date.now();
        upsertAccount(account);

        console.log(`   ✅ Completed: ${requestId}`);

    } catch (error) {
        console.error(`   ❌ Error:`, error);
        sendError(res, 500, `Internal error: ${error}`);
    }
}

async function streamAntigravityResponse(
    response: Response,
    res: http.ServerResponse,
    model: string,
    requestId: string
): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
        sendError(res, 500, "No response body");
        return;
    }

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
            if (!data || data === "[DONE]") continue;

            try {
                const parsed = JSON.parse(data) as AntigravityResponse;
                const parts = parsed.response?.candidates?.[0]?.content?.parts ?? [];

                for (const part of parts) {
                    if (part.text && !part.thought) {
                        const chunk = {
                            id: requestId,
                            object: "chat.completion.chunk",
                            created: Math.floor(Date.now() / 1000),
                            model,
                            choices: [{
                                index: 0,
                                delta: { content: part.text },
                                finish_reason: null,
                            }],
                        };
                        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                    }

                    if (part.functionCall) {
                        const chunk = {
                            id: requestId,
                            object: "chat.completion.chunk",
                            created: Math.floor(Date.now() / 1000),
                            model,
                            choices: [{
                                index: 0,
                                delta: {
                                    tool_calls: [{
                                        index: 0,
                                        id: part.functionCall.id || `call_${crypto.randomUUID().slice(0, 8)}`,
                                        type: "function",
                                        function: {
                                            name: part.functionCall.name,
                                            arguments: JSON.stringify(part.functionCall.args),
                                        },
                                    }],
                                },
                                finish_reason: null,
                            }],
                        };
                        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                    }
                }
            } catch {
                // Skip malformed JSON
            }
        }
    }

    // Send done
    res.write(`data: [DONE]\n\n`);
    res.end();
}

async function streamCodexResponse(
    response: Response,
    res: http.ServerResponse,
    model: string,
    requestId: string
): Promise<void> {
    for await (const chunk of parseCodexStream(response, model, requestId)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.write(`data: [DONE]\n\n`);
    res.end();
}

// =============================================================================
// HTTP Server
// =============================================================================

function sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, status: number, message: string): void {
    sendJSON(res, status, {
        error: { message, type: "api_error", code: status },
    });
}

async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
): Promise<void> {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    const path = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
        res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        });
        res.end();
        return;
    }

    // Health check
    if (path === "/health" && req.method === "GET") {
        sendJSON(res, 200, {
            status: "ok",
            antigravity_accounts: antigravityAccounts.length,
            codex_accounts: codexAccounts.length,
        });
        return;
    }

    // List models
    if ((path === "/v1/models" || path === "/models") && req.method === "GET") {
        const models = Object.values(MODELS).map(m => ({
            id: m.id,
            object: "model",
            created: 1700000000,
            owned_by: m.provider,
            displayName: m.displayName,
        }));
        sendJSON(res, 200, { object: "list", data: models });
        return;
    }

    // Chat completions
    if ((path === "/v1/chat/completions" || path === "/chat/completions") && req.method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                const apiReq = JSON.parse(body) as APIRequest;
                await handleChatCompletion(apiReq, res);
            } catch (error) {
                sendError(res, 400, `Invalid request: ${error}`);
            }
        });
        return;
    }

    sendError(res, 404, "Not found");
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           🌉 Droid Provider Bridge                             ║
║   Connect Antigravity & Codex subscriptions to Factory AI     ║
╚═══════════════════════════════════════════════════════════════╝
`);

    await initializeAccounts();

    const server = http.createServer(handleRequest);

    server.listen(PORT, HOST, () => {
        console.log(`🚀 Server running at http://${HOST}:${PORT}\n`);
        console.log("Endpoints:");
        console.log(`  POST http://${HOST}:${PORT}/v1/chat/completions`);
        console.log(`  GET  http://${HOST}:${PORT}/v1/models`);
        console.log(`  GET  http://${HOST}:${PORT}/health\n`);
        console.log("Available models:");
        Object.values(MODELS).forEach(m => {
            console.log(`  • ${m.id} (${m.displayName}) - ${m.provider}`);
        });
        console.log("\nPress Ctrl+C to stop.\n");
    });
}

main().catch(console.error);
