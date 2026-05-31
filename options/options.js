const fields = ["apiUrl", "apiKey", "model", "systemPrompt", "apiFormat"];

const DEFAULTS = {
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    model: "claude-3-5-sonnet-20241022",
  },
};

async function loadSettings() {
  const data = await messenger.storage.local.get(fields);
  const format = data.apiFormat || "openai";
  document.getElementById("apiFormat").value = format;
  document.getElementById("apiUrl").value = data.apiUrl || DEFAULTS[format].url;
  document.getElementById("apiKey").value = data.apiKey || "";
  document.getElementById("model").value = data.model || DEFAULTS[format].model;
  document.getElementById("systemPrompt").value =
    data.systemPrompt ||
    "You are a helpful email assistant. Generate a professional, concise, and polite reply to the email provided. Match the language of the original email. Do not include greetings or signatures unless contextually appropriate.";
}

document.getElementById("apiFormat").addEventListener("change", (e) => {
  const format = e.target.value;
  document.getElementById("apiUrl").value = DEFAULTS[format].url;
  document.getElementById("model").value = DEFAULTS[format].model;
});

function showStatus(msg, type) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = `status ${type}`;
  setTimeout(() => { el.className = "status"; }, 3000);
}

async function saveSettings() {
  const settings = {
    apiFormat: document.getElementById("apiFormat").value,
    apiUrl: document.getElementById("apiUrl").value.trim(),
    apiKey: document.getElementById("apiKey").value.trim(),
    model: document.getElementById("model").value.trim(),
    systemPrompt: document.getElementById("systemPrompt").value.trim(),
  };

  if (!settings.apiUrl || !settings.apiKey || !settings.model) {
    showStatus("API URL, API Key, and Model are required.", "error");
    return;
  }

  await messenger.storage.local.set(settings);
  showStatus("Settings saved successfully.", "success");
}

document.getElementById("save").addEventListener("click", saveSettings);
loadSettings();
