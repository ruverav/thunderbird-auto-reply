const generateBtn = document.getElementById("generate");
const statusEl = document.getElementById("status");
const instructionsEl = document.getElementById("instructions");

function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
}

/**
 * Get the plain text content from the compose window, stripping out
 * the signature (moz-signature) and any HTML.
 */
function getPlainUserContent(composeDetails) {
  let fullText;

  if (composeDetails.isPlainText) {
    fullText = composeDetails.plainTextBody || "";
  } else {
    const html = composeDetails.body || "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    fullText = doc.body ? doc.body.textContent || "" : "";
  }

  // Strip the signature part.
  // Standard separator is "-- " followed by newline.
  const sigRegex = /-- \n/;
  const sigMatch = fullText.match(sigRegex);
  if (sigMatch) {
    return fullText.substring(0, sigMatch.index).trim();
  }

  // Fallback: find moz-signature div in original HTML
  if (!composeDetails.isPlainText) {
    const html = composeDetails.body || "";
    const sigDivMatch = html.match(
      /<div[^>]*class="[^"]*\bmoz-signature\b[^"]*"[^>]*>/i
    );
    if (sigDivMatch) {
      const beforeSigHtml = html.substring(0, sigDivMatch.index);
      const beforeSigDoc = new DOMParser().parseFromString(
        beforeSigHtml,
        "text/html"
      );
      return beforeSigDoc.body
        ? beforeSigDoc.body.textContent.trim()
        : fullText.trim();
    }
  }

  return fullText.trim();
}

generateBtn.addEventListener("click", async () => {
  generateBtn.disabled = true;
  setStatus("⏳ Generating...", "loading");
  console.log("Auto Reply AI: Generate clicked");

  try {
    // --- STEP 1: Get the compose tab ---
    let tabId;
    const currentTab = await messenger.tabs.getCurrent();
    if (currentTab && currentTab.id) {
      tabId = currentTab.id;
    } else {
      const tabs = await messenger.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs || !tabs.length) {
        setStatus("No compose window found.", "error");
        generateBtn.disabled = false;
        return;
      }
      tabId = tabs[0].id;
    }

    // --- STEP 2: Read compose details ---
    const composeDetails = await messenger.compose.getComposeDetails(tabId);

    const subject = composeDetails.subject || "";
    const instructions = instructionsEl.value.trim();
    const userContent = getPlainUserContent(composeDetails);

    if (!userContent && !subject && !instructions) {
      setStatus(
        "Write a subject or some content first, or give instructions.",
        "error"
      );
      generateBtn.disabled = false;
      return;
    }

    // --- STEP 3: Send to background and wait for completion ---
    // The background will call the AI AND update the compose window.
    // If the user closes the popup, the background continues anyway.
    console.log("Auto Reply AI: Sending to background...");
    const response = await messenger.runtime.sendMessage({
      action: "generateComposeContent",
      tabId,
      subject,
      userContent,
      instructions,
      isPlainText: composeDetails.isPlainText,
      existingHtml: composeDetails.isPlainText
        ? undefined
        : composeDetails.body,
      existingPlainText: composeDetails.isPlainText
        ? composeDetails.plainTextBody
        : undefined,
    });

    if (response && response.error) {
      setStatus(`Error: ${response.error}`, "error");
      generateBtn.disabled = false;
      return;
    }

    setStatus("✅ Content updated!", "success");
    console.log("Auto Reply AI: Compose generation complete");
  } catch (err) {
    console.error("Auto Reply AI: Compose error:", err);
    setStatus(`Error: ${err.message}`, "error");
    generateBtn.disabled = false;
  }
});
