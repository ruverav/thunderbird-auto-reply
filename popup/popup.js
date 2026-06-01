const generateBtn = document.getElementById("generate");
const statusEl = document.getElementById("status");
const instructionsEl = document.getElementById("instructions");

function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
}

generateBtn.addEventListener("click", async () => {
  generateBtn.disabled = true;
  setStatus("⏳ Generating draft...", "loading");

  try {
    const messages = await messenger.messageDisplay.getDisplayedMessages();
    if (!messages.length) {
      setStatus("No message is currently open.", "error");
      generateBtn.disabled = false;
      return;
    }

    const messageId = messages[0].id;
    const instructions = instructionsEl.value.trim();

    // Send to background and wait for completion.
    // If the popup closes, the background continues anyway.
    const response = await messenger.runtime.sendMessage({
      action: "generateDraft",
      messageId,
      instructions,
    });

    if (response && response.error) {
      setStatus(`Error: ${response.error}`, "error");
      generateBtn.disabled = false;
      return;
    }

    setStatus("✅ Draft ready! Check compose window.", "success");
  } catch (err) {
    console.error("Auto Reply AI: Reply error:", err);
    setStatus(`Error: ${err.message}`, "error");
    generateBtn.disabled = false;
  }
});

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  messenger.runtime.openOptionsPage();
});
