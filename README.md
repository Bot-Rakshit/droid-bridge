# 🌉 Droid Provider Bridge

**Connect your Antigravity (Google) and Codex (ChatGPT Pro) subscriptions to Factory AI Droid**

A local OpenAI-compatible API server that bridges premium AI subscriptions to Factory AI. Use your existing Claude Sonnet/Opus 4.5, Gemini 3 Pro/Flash, or GPT-4.5/GPT-5 Codex access with Droid.

## ✨ Features

- 🔌 **OpenAI-Compatible API** - Drop-in replacement for OpenAI API
- 🌐 **Multi-Provider Support** - Antigravity (Google) + Codex (OpenAI)
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
# Automatically add models to Factory's config.json
npm run setup-factory
```

### 4. Start Server

```bash
npm start
# Server runs at http://127.0.0.1:8787
```

That's it! The models are now available in Factory AI Droid.

---

### Manual Configuration (Optional)

If you prefer to manually configure, add these to `~/.factory/config.json`:

```json
{
  "custom_models": [
    {
      "model_display_name": "Claude Sonnet 4.5",
      "model": "claude-sonnet-4.5",
      "base_url": "http://127.0.0.1:8787/v1",
      "api_key": "sk-not-needed",
      "provider": "generic-chat-completion-api"
    },
    {
      "model_display_name": "Claude Opus 4.5 (Thinking)",
      "model": "claude-opus-4.5-thinking",
      "base_url": "http://127.0.0.1:8787/v1",
      "api_key": "sk-not-needed",
      "provider": "generic-chat-completion-api"
    },
    {
      "model_display_name": "Gemini 3 Pro",
      "model": "gemini-3-pro",
      "base_url": "http://127.0.0.1:8787/v1",
      "api_key": "sk-not-needed",
      "provider": "generic-chat-completion-api"
    },
    {
      "model_display_name": "Gemini 3 Flash",
      "model": "gemini-3-flash",
      "base_url": "http://127.0.0.1:8787/v1",
      "api_key": "sk-not-needed",
      "provider": "generic-chat-completion-api"
    }
  ]
}
```

---

## 📋 Available Models

### Antigravity (Google) Models

| Model ID | Display Name | Description |
|----------|--------------|-------------|
| `claude-sonnet-4.5` | Claude Sonnet 4.5 | Fast, capable Claude model |
| `claude-sonnet-4.5-thinking` | Claude Sonnet 4.5 (Thinking) | With extended thinking |
| `claude-opus-4.5-thinking` | Claude Opus 4.5 (Thinking) | Most capable Claude model |
| `gemini-3-flash` | Gemini 3 Flash | Fast Gemini model |
| `gemini-3-pro` | Gemini 3 Pro | Powerful Gemini with thinking |

### Codex (ChatGPT Pro) Models

| Model ID | Display Name | Description |
|----------|--------------|-------------|
| `gpt-4.5` | GPT-4.5 | Latest GPT model |
| `gpt-5-codex` | GPT-5 Codex | Code-focused GPT model |

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
    "model": "claude-sonnet-4.5",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

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
│   ├── types.ts          # Type definitions
│   ├── storage.ts        # Account storage
│   ├── antigravity.ts    # Antigravity provider
│   ├── codex.ts          # Codex provider
│   └── cli/
│       └── add-account.ts # Account management CLI
├── package.json
├── tsconfig.json
└── README.md
```

---

## ⚠️ Important Notes

1. **Session Tokens Expire**: Codex session tokens expire periodically. Re-add the account when this happens.

2. **Thinking Models**: Claude thinking models require special handling. Thinking is automatically disabled for multi-turn conversations with tool calls.

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

### "Invalid JSON schema" errors
The server automatically sanitizes tool schemas. If errors persist, the tool definition may be incompatible.

### Rate limit errors
Add more accounts! The server will rotate between them automatically.

---

## 📄 License

MIT

---

## 🙏 Credits

Built for use with [Factory AI Droid](https://factory.ai)
