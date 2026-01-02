/**
 * CLI for adding provider accounts
 * 
 * Usage:
 *   npm run add-account                    # Interactive mode
 *   npm run add-account -- --provider antigravity   # Add Google account
 *   npm run add-account -- --provider codex --token "session_token"  # Add ChatGPT Pro
 */

import * as http from "node:http";
import * as crypto from "node:crypto";
import * as readline from "node:readline";
import type { ProviderAccount } from "../types.js";
import { listAccounts, removeAccount, getConfigDir, upsertAccount } from "../storage.js";
import { getAntigravityAuthUrl, exchangeAntigravityCode } from "../antigravity.js";
import { createCodexAccount, getCodexAuthInstructions } from "../codex.js";

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : undefined;
};

const provider = getArg("provider") as "antigravity" | "codex" | undefined;
const token = getArg("token");
const action = args[0];

// Helper for user input
function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// Add Antigravity (Google) account via OAuth
async function addAntigravityAccount(): Promise<void> {
    console.log("\n🔐 Adding Antigravity (Google) Account\n");
    console.log("This will open a browser window for Google OAuth...\n");

    const port = 9876 + Math.floor(Math.random() * 100);

    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            const url = new URL(req.url || "/", `http://localhost:${port}`);

            if (url.pathname === "/callback") {
                const code = url.searchParams.get("code");
                const error = url.searchParams.get("error");

                if (error) {
                    res.writeHead(400, { "Content-Type": "text/html" });
                    res.end(`<h1>❌ Error</h1><p>${error}</p><p>You can close this window.</p>`);
                    server.close();
                    reject(new Error(error));
                    return;
                }

                if (code) {
                    try {
                        console.log("   📥 Received authorization code, exchanging for tokens...");

                        const tokens = await exchangeAntigravityCode(code, port);

                        const account: ProviderAccount = {
                            id: `antigravity-${crypto.randomUUID().slice(0, 8)}`,
                            provider: "antigravity",
                            email: tokens.email,
                            accessToken: tokens.accessToken,
                            refreshToken: tokens.refreshToken,
                            expiresAt: Date.now() + tokens.expiresIn * 1000,
                            isActive: true,
                        };

                        upsertAccount(account);

                        res.writeHead(200, { "Content-Type": "text/html" });
                        res.end(`
                            <html>
                            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                                <h1>✅ Success!</h1>
                                <p>Account <strong>${tokens.email}</strong> has been added.</p>
                                <p>You can close this window and return to the terminal.</p>
                            </body>
                            </html>
                        `);

                        console.log(`\n   ✅ Account added: ${tokens.email}`);
                        server.close();
                        resolve();

                    } catch (err) {
                        res.writeHead(500, { "Content-Type": "text/html" });
                        res.end(`<h1>❌ Error</h1><p>${err}</p>`);
                        server.close();
                        reject(err);
                    }
                    return;
                }
            }

            res.writeHead(404);
            res.end("Not found");
        });

        server.listen(port, "localhost", () => {
            const authUrl = getAntigravityAuthUrl(port);
            console.log("   🌐 Opening browser for authentication...\n");
            console.log(`   If browser doesn't open, visit:\n   ${authUrl}\n`);

            // Try to open browser
            import("child_process").then(cp => {
                const cmd = process.platform === "darwin" ? "open"
                    : process.platform === "win32" ? "start"
                        : "xdg-open";
                cp.exec(`${cmd} "${authUrl}"`);
            });
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            server.close();
            reject(new Error("Timeout waiting for OAuth callback"));
        }, 5 * 60 * 1000);
    });
}

// Add Codex (ChatGPT Pro) account via session token
async function addCodexAccount(sessionToken?: string): Promise<void> {
    console.log("\n🔐 Adding Codex (ChatGPT Pro) Account\n");

    if (!sessionToken) {
        console.log(getCodexAuthInstructions());
        sessionToken = await prompt("Paste your session token: ");
    }

    if (!sessionToken) {
        console.error("❌ No session token provided");
        process.exit(1);
    }

    try {
        console.log("   🔍 Verifying session token...");
        const account = await createCodexAccount(sessionToken);
        console.log(`\n   ✅ Account added: ${account.email}`);
    } catch (error) {
        console.error(`\n   ❌ Failed to add account: ${error}`);
        process.exit(1);
    }
}

// List accounts
function showAccounts(): void {
    const accounts = listAccounts();

    if (accounts.length === 0) {
        console.log("\n📭 No accounts configured.\n");
        console.log("Add accounts with:");
        console.log("  npm run add-account -- --provider antigravity  # Google/Antigravity");
        console.log("  npm run add-account -- --provider codex        # ChatGPT Pro\n");
        return;
    }

    console.log("\n📋 Configured Accounts:\n");
    for (const acc of accounts) {
        const status = acc.isActive ? "✅" : "❌";
        const lastUsed = acc.lastUsed ? new Date(acc.lastUsed).toLocaleString() : "Never";
        console.log(`  ${status} [${acc.provider}] ${acc.email}`);
        console.log(`     ID: ${acc.id} | Last used: ${lastUsed}\n`);
    }
    console.log(`Config directory: ${getConfigDir()}\n`);
}

// Remove account
async function doRemoveAccount(): Promise<void> {
    const accounts = listAccounts();

    if (accounts.length === 0) {
        console.log("\n📭 No accounts to remove.\n");
        return;
    }

    console.log("\n📋 Select account to remove:\n");
    accounts.forEach((acc, i) => {
        console.log(`  ${i + 1}. [${acc.provider}] ${acc.email} (${acc.id})`);
    });

    const choice = await prompt("\nEnter number (or 'q' to cancel): ");

    if (choice === "q") {
        console.log("Cancelled.");
        return;
    }

    const idx = parseInt(choice, 10) - 1;
    if (idx < 0 || idx >= accounts.length) {
        console.error("Invalid selection.");
        return;
    }

    const account = accounts[idx]!;
    const confirm = await prompt(`Remove ${account.email}? (y/n): `);

    if (confirm.toLowerCase() === "y") {
        removeAccount(account.id);
        console.log(`\n✅ Removed: ${account.email}\n`);
    } else {
        console.log("Cancelled.");
    }
}

// Interactive menu
async function interactiveMenu(): Promise<void> {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           🌉 Droid Provider Bridge - Account Manager          ║
╚═══════════════════════════════════════════════════════════════╝
`);

    while (true) {
        console.log("\nWhat would you like to do?");
        console.log("  1. Add Antigravity (Google) account");
        console.log("  2. Add Codex (ChatGPT Pro) account");
        console.log("  3. List accounts");
        console.log("  4. Remove account");
        console.log("  5. Exit\n");

        const choice = await prompt("Enter choice (1-5): ");

        switch (choice) {
            case "1":
                await addAntigravityAccount();
                break;
            case "2":
                await addCodexAccount();
                break;
            case "3":
                showAccounts();
                break;
            case "4":
                await doRemoveAccount();
                break;
            case "5":
            case "q":
                console.log("\nGoodbye! 👋\n");
                process.exit(0);
            default:
                console.log("Invalid choice.");
        }
    }
}

// Main
async function main(): Promise<void> {
    // Handle specific actions
    if (action === "list") {
        showAccounts();
        return;
    }

    if (action === "remove") {
        await doRemoveAccount();
        return;
    }

    // Handle provider-specific addition
    if (provider === "antigravity") {
        await addAntigravityAccount();
        return;
    }

    if (provider === "codex") {
        await addCodexAccount(token);
        return;
    }

    // Interactive mode
    await interactiveMenu();
}

main().catch(console.error);
