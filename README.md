# Auto Reply AI

A Thunderbird extension that generates email reply drafts using any OpenAI or Anthropic-compatible API.

## Features

- Generate reply drafts using AI
- Supports OpenAI-compatible APIs (`/v1/chat/completions`) and Anthropic APIs (`/v1/messages`)
- Custom instructions to guide the AI response
- Preserves email quotes and configured signatures
- User reviews and sends manually

## Installation

### From XPI

1. Download the `auto-reply-ai.xpi` file
2. In Thunderbird: Add-ons (Ctrl+Shift+A) > gear icon > "Install Add-on From File..."
3. Select the XPI file

### Development (temporary load)

1. In Thunderbird: Add-ons > gear icon > "Debug Add-ons"
2. "Load Temporary Add-on" and select `manifest.json`

## Configuration

Open Settings from the extension popup and configure:

| Field | Description |
|-------|-------------|
| **API Format** | `OpenAI Compatible` or `Anthropic` |
| **API URL** | API endpoint URL |
| **API Key** | Your API key |
| **Model** | Model name to use |
| **System Prompt** | Base instructions for the AI |

### Default Configurations

**OpenAI:**
- URL: `https://api.openai.com/v1/chat/completions`
- Model: `gpt-4o-mini`

**Anthropic:**
- URL: `https://api.anthropic.com/v1/messages`
- Model: `claude-3-5-sonnet-20241022`

## Provider Examples

### OpenAI

- **Format:** OpenAI Compatible
- **URL:** `https://api.openai.com/v1/chat/completions`
- **Model:** `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`
- **API Key:** Get from [platform.openai.com](https://platform.openai.com/api-keys)

### Anthropic

- **Format:** Anthropic
- **URL:** `https://api.anthropic.com/v1/messages`
- **Model:** `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`, `claude-3-haiku-20240307`
- **API Key:** Get from [console.anthropic.com](https://console.anthropic.com/)

### OpenCode Go

- **Format:** Anthropic
- **URL:** `https://opencode.ai/zen/go/v1/messages`
- **Model:** `qwen3.7-max`, `qwen3.6-plus`
- **API Key:** Get from [opencode.ai](https://opencode.ai/)

### Azure OpenAI

- **Format:** OpenAI Compatible
- **URL:** `https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/chat/completions?api-version=2024-02-15-preview`
- **Model:** Your deployment name
- **API Key:** Your Azure OpenAI key

### Google Gemini (via OpenAI compatibility)

- **Format:** OpenAI Compatible
- **URL:** `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
- **Model:** `gemini-1.5-pro`, `gemini-1.5-flash`
- **API Key:** Get from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Groq

- **Format:** OpenAI Compatible
- **URL:** `https://api.groq.com/openai/v1/chat/completions`
- **Model:** `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`
- **API Key:** Get from [console.groq.com](https://console.groq.com/)

### Together AI

- **Format:** OpenAI Compatible
- **URL:** `https://api.together.xyz/v1/chat/completions`
- **Model:** `meta-llama/Llama-3.3-70B-Instruct-Turbo`, `mistralai/Mixtral-8x7B-Instruct-v0.1`
- **API Key:** Get from [api.together.ai](https://api.together.ai/)

### Mistral AI

- **Format:** OpenAI Compatible
- **URL:** `https://api.mistral.ai/v1/chat/completions`
- **Model:** `mistral-large-latest`, `mistral-small-latest`, `open-mistral-nemo`
- **API Key:** Get from [console.mistral.ai](https://console.mistral.ai/)

### Perplexity

- **Format:** OpenAI Compatible
- **URL:** `https://api.perplexity.ai/chat/completions`
- **Model:** `llama-3.1-sonar-large-128k-online`, `llama-3.1-sonar-small-128k-online`
- **API Key:** Get from [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)

### Fireworks AI

- **Format:** OpenAI Compatible
- **URL:** `https://api.fireworks.ai/inference/v1/chat/completions`
- **Model:** `accounts/fireworks/models/llama-v3p3-70b-instruct`
- **API Key:** Get from [fireworks.ai](https://fireworks.ai/)

### Ollama (Local)

- **Format:** OpenAI Compatible
- **URL:** `http://localhost:11434/v1/chat/completions`
- **Model:** `llama3.3`, `mistral`, `qwen2.5` (any model you've pulled)
- **API Key:** Leave empty or use any value (not required for local)

### OpenRouter

- **Format:** OpenAI Compatible
- **URL:** `https://openrouter.ai/api/v1/chat/completions`
- **Model:** `openai/gpt-4o`, `anthropic/claude-3.5-sonnet`, `google/gemini-pro-1.5`
- **API Key:** Get from [openrouter.ai](https://openrouter.ai/)

## Usage

1. Open an email in Thunderbird
2. Click the "Auto Reply AI" button in the toolbar
3. Write optional instructions (e.g., "Accept the invitation", "Decline politely")
4. Click "Generate Draft Reply"
5. Review the generated draft and send manually

## Building XPI

```bash
cd thunderbird-auto-reply
python3 -c "import zipfile; import os; z = zipfile.ZipFile('auto-reply-ai.xpi', 'w', zipfile.ZIP_DEFLATED); [z.write(os.path.join(root, file), os.path.relpath(os.path.join(root, file), '.')) for root, dirs, files in os.walk('.') for file in files if file != 'auto-reply-ai.xpi']; z.close()"
```

Or with `zip`:

```bash
cd thunderbird-auto-reply
zip -r auto-reply-ai.xpi . -x "auto-reply-ai.xpi"
```

## Structure

```
thunderbird-auto-reply/
├── manifest.json
├── background.js
├── icons/
│   └── icon.svg
├── options/
│   ├── options.html
│   └── options.js
└── popup/
    ├── popup.html
    └── popup.js
```

## License

MIT
