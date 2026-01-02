# 🌉 Droid Provider Bridge

**Connect your Antigravity (Google) and Codex (ChatGPT Pro) subscriptions to Factory AI Droid**

A local OpenAI-compatible API server that bridges premium AI subscriptions to Factory AI. Use your existing Claude Sonnet/Opus 4.5, Gemini 3 Pro/Flash, or GPT-5.2/GPT-5.2-Codex access with Droid.

## ✨ Features

- 🔌 **OpenAI-Compatible API** - Drop-in replacement for OpenAI API
- 🌐 **Multi-Provider Support** - Antigravity (Google) + Codex (OpenAI)
- 🧠 **3 Reasoning Levels** - Low, Medium, High thinking budgets for each model
- 👥 **Multi-Account Rotation** - Auto-rotate when rate limited
- 🔄 **Auto Token Refresh** - Handles OAuth token expiration
- 🛠️ **Full Tool/Function Support** - Works with Droid's agentic features
- 📡 **Streaming** - Real-time streaming responses

## 🚀 Quick Start

### 1. Install

```bash
git clone https://github.com/Bot-Rakshit/droid-bridge.git
cd droid-bridge
npm install
```

### 2. Add Accounts

```bash
# Interactive mode
npm run add-account

# Or specify provider directly
npm run add-account -- --provider antigravity   # Google/Antigravity
npm run add-account -- --provider codex         # ChatGPT Pro
```

### 3. Configure Factory AI

```bash
# Automatically add models to Factory's settings.json
npm run setup-factory
```

### 4. Start Server

```bash
npm start
# Server runs at http://127.0.0.1:8787
```

That's it! The models are now available in Factory AI Droid.

---

## 📋 Available Models

### Antigravity (Google) - Claude Models

| Model ID | Display Name | Thinking Budget |
|----------|--------------|-----------------|
| `claude-sonnet-4.5` | Claude Sonnet 4.5 | - |
| `claude-sonnet-4.5-thinking-low` | Claude Sonnet 4.5 Thinking (Low) | 8,000 tokens |
| `claude-sonnet-4.5-thinking-medium` | Claude Sonnet 4.5 Thinking (Medium) | 16,000 tokens |
| `claude-sonnet-4.5-thinking-high` | Claude Sonnet 4.5 Thinking (High) | 32,000 tokens |
| `claude-opus-4.5-thinking-low` | Claude Opus 4.5 Thinking (Low) | 8,000 tokens |
| `claude-opus-4.5-thinking-medium` | Claude Opus 4.5 Thinking (Medium) | 16,000 tokens |
| `claude-opus-4.5-thinking-high` | Claude Opus 4.5 Thinking (High) | 32,000 tokens |

### Antigravity (Google) - Gemini 3 Models

| Model ID | Display Name | Thinking |
|----------|--------------|----------|
| `gemini-3-flash` | Gemini 3 Flash | - |
| `gemini-3-pro-low` | Gemini 3 Pro (Low) | Low |
| `gemini-3-pro-high` | Gemini 3 Pro (High) | High |

### Codex (ChatGPT Pro) Models

| Model ID | Display Name | Description |
|----------|--------------|-------------|
| `gpt-5.2` | GPT-5.2 | Latest GPT model |
| `gpt-5.2-thinking` | GPT-5.2 Thinking | Extended thinking |
| `gpt-5.2-codex` | GPT-5.2 Codex | Agentic coding model |

---

## 🔐 Adding Accounts

### Antigravity (Google) Account

1. Run `npm run add-account -- --provider antigravity`
2. Browser opens for Google OAuth
3. Sign in with your Google account that has Antigravity access
4. Authorization is saved automatically

**Requirements:**
- Google account with Antigravity/IDE access (via Firebase Studio, Project IDX, or similar)

### Codex (ChatGPT Pro) Account

1. Log in to https://chatgpt.com with your Pro account
2. Open Developer Tools (F12) → Application → Cookies
3. Copy the `__Secure-next-auth.session-token` cookie value
4. Run: `npm run add-account -- --provider codex --token "YOUR_TOKEN"`

**Requirements:**
- ChatGPT Pro or Team subscription

### Managing Accounts

```bash
# List all accounts
npm run add-account list

# Remove an account (interactive)
npm run add-account remove
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8787` | Server port |
| `HOST` | `127.0.0.1` | Server host |

### Account Storage

Accounts are stored in `~/.droid-bridge/accounts.json`

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | Chat completions (streaming supported) |
| `/v1/models` | GET | List available models |
| `/health` | GET | Health check & account status |

### Example Request

```bash
curl http://127.0.0.1:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4.5-thinking-high",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

---

## 🧠 Reasoning Levels Explained

Thinking models support different "budgets" that control how much the model thinks before responding:

| Level | Thinking Budget | Best For |
|-------|----------------|----------|
| **Low** | 8,000 tokens | Simple questions, quick responses |
| **Medium** | 16,000 tokens | Moderate complexity, balanced speed/depth |
| **High** | 32,000 tokens | Complex reasoning, thorough analysis |

Higher thinking budgets result in:
- ⏱️ Longer response times
- 💰 More tokens used
- 🎯 More thorough and accurate answers

---

## 🔄 Multi-Account Rotation

When you add multiple accounts, the server automatically rotates between them when rate limited:

1. Add multiple accounts with `npm run add-account`
2. Server uses first account
3. On 429 (rate limit), automatically switches to next account
4. Cycles through all accounts

This effectively multiplies your quota!

---

## 🛠️ Development

```bash
# Run in development mode (auto-reload)
npm run dev

# Build TypeScript
npm run build
```

---

## 📁 Project Structure

```
droid-bridge/
├── src/
│   ├── index.ts          # Main server
│   ├── types.ts          # Type definitions & models
│   ├── storage.ts        # Account storage
│   ├── antigravity.ts    # Antigravity provider
│   ├── codex.ts          # Codex provider
│   └── cli/
│       ├── add-account.ts    # Account management CLI
│       └── setup-factory.ts  # Factory config CLI
├── package.json
├── tsconfig.json
└── README.md
```

---

## ⚠️ Important Notes

1. **Session Tokens Expire**: Codex session tokens expire periodically. Re-add the account when this happens.

2. **Thinking Models**: Claude thinking models require special handling. Thinking is automatically disabled for multi-turn conversations with tool calls to avoid API errors.

3. **Local Use Only**: This server binds to localhost by default for security. Don't expose publicly.

4. **API Key**: Factory AI requires a non-empty API key. Use `sk-not-needed` as shown in examples.

---

## 🐛 Troubleshooting

### "No accounts available"
Run `npm run add-account` to add at least one account.

### "Token refresh failed"
Your refresh token expired. Re-add the account:
```bash
npm run add-account -- --provider antigravity
```

### "400 status code (no body)" in Factory
- Restart Factory AI Droid after updating settings
- Make sure the server is running
- Check that model names in settings.json match exactly

### Rate limit errors
Add more accounts! The server will rotate between them automatically.

---

## 📄 License

MIT

---

## 🙏 Credits

Built for use with [Factory AI Droid](https://factory.ai)

Inspired by [VibeProxy](https://github.com/automazeio/vibeproxy) and [Codex OpenAI Proxy](https://github.com/Securiteru/codex-openai-proxy)
