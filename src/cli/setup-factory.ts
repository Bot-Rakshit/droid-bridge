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

const FACTORY_CONFIG_PATH = path.join(os.homedir(), ".factory", "config.json");

interface FactoryConfig {
    custom_models?: Array<{
        model_display_name: string;
        model: string;
        base_url: string;
        api_key: string;
        provider: string;
    }>;
    [key: string]: unknown;
}

function loadFactoryConfig(): FactoryConfig {
    if (!fs.existsSync(FACTORY_CONFIG_PATH)) {
        return {};
    }

    try {
        const content = fs.readFileSync(FACTORY_CONFIG_PATH, "utf-8");
        return JSON.parse(content);
    } catch {
        console.error("⚠️ Failed to parse existing config, will create new");
        return {};
    }
}

function saveFactoryConfig(config: FactoryConfig): void {
    const dir = path.dirname(FACTORY_CONFIG_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FACTORY_CONFIG_PATH, JSON.stringify(config, null, 2));
}

function generateModelConfigs(port: number = 8787): FactoryConfig["custom_models"] {
    return Object.values(MODELS)
        .filter(m => m.provider === "antigravity") // Only Antigravity models for now
        .map(model => ({
            model_display_name: model.displayName,
            model: model.id,
            base_url: `http://127.0.0.1:${port}/v1`,
            api_key: "sk-not-needed",
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
    const models = generateModelConfigs(port) || [];

    console.log(`Found ${models.length} models to add:\n`);
    models.forEach(m => console.log(`  • ${m.model_display_name} (${m.model})`));

    // Load existing config
    const config = loadFactoryConfig();

    // Get existing custom models that are NOT from our bridge
    const existingModels = (config.custom_models || []).filter(
        m => !m.base_url.includes("127.0.0.1:8787") && !m.base_url.includes("127.0.0.1:" + port)
    );

    // Merge
    config.custom_models = [...existingModels, ...models];

    console.log(`\n📝 Writing to ${FACTORY_CONFIG_PATH}...`);
    saveFactoryConfig(config);

    console.log(`
✅ Factory AI configured!

${models.length} models added to ~/.factory/config.json

Next steps:
1. Start the bridge server: npm start
2. Use the models in Factory AI Droid

Note: Restart Droid if it's running to pick up the new models.
`);
}

main().catch(console.error);
