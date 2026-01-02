/**
 * CLI for setting up Factory AI Droid configuration
 * 
 * Usage:
 *   npm run setup-factory    # Add models to Factory config.json
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { MODELS } from "../types.js";

const FACTORY_SETTINGS_PATH = path.join(os.homedir(), ".factory", "settings.json");

interface FactorySettings {
    customModels?: Array<{
        model: string;
        id: string;
        index: number;
        baseUrl: string;
        apiKey: string;
        displayName: string;
        maxOutputTokens: number;
        noImageSupport: boolean;
        provider: string;
    }>;
    logoAnimation?: string;
    sessionDefaultSettings?: {
        model: string;
        reasoningEffort: string;
        autonomyMode: string;
    };
}

function loadFactorySettings(): FactorySettings {
    if (!fs.existsSync(FACTORY_SETTINGS_PATH)) {
        return {};
    }

    try {
        const content = fs.readFileSync(FACTORY_SETTINGS_PATH, "utf-8");
        return JSON.parse(content);
    } catch {
        console.error("⚠️ Failed to parse existing settings, will create new");
        return {};
    }
}

function saveFactorySettings(settings: FactorySettings): void {
    const dir = path.dirname(FACTORY_SETTINGS_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FACTORY_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function generateModelConfigs(port: number = 8787): NonNullable<FactorySettings["customModels"]> {
    let index = 0;
    return Object.values(MODELS).map(model => ({
        model: model.id,
        id: `custom:${model.displayName.replace(/[^a-zA-Z0-9]/g, "-")}-${index}`,
        index: index++,
        baseUrl: `http://127.0.0.1:${port}/v1`,
        apiKey: "sk-not-needed",
        displayName: model.displayName,
        maxOutputTokens: model.outputLimit,
        noImageSupport: false,
        provider: "generic-chat-completion-api",
    }));
}

async function main(): Promise<void> {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        🔧 Factory AI Droid - Configuration Setup              ║
╚═══════════════════════════════════════════════════════════════╝
`);

    const port = parseInt(process.env["PORT"] || "8787", 10);
    const models = generateModelConfigs(port);

    console.log(`Found ${models.length} models to add:\n`);

    console.log("📦 Antigravity Models:");
    models.filter(m => MODELS[m.model]?.provider === "antigravity").forEach(m =>
        console.log(`   • ${m.displayName}`)
    );

    console.log("\n📦 Codex Models:");
    models.filter(m => MODELS[m.model]?.provider === "codex").forEach(m =>
        console.log(`   • ${m.displayName}`)
    );

    // Create settings
    const settings: FactorySettings = {
        customModels: models,
        logoAnimation: "off",
        sessionDefaultSettings: {
            model: models[0]?.id || "",
            reasoningEffort: "none",
            autonomyMode: "auto-high",
        },
    };

    console.log(`\n📝 Writing to ${FACTORY_SETTINGS_PATH}...`);
    saveFactorySettings(settings);

    console.log(`
✅ Factory AI configured!

${models.length} models added to ~/.factory/settings.json

Next steps:
1. Start the bridge server: npm start
2. Use the models in Factory AI Droid

Note: Restart Droid if it's running to pick up the new models.
`);
}

main().catch(console.error);
