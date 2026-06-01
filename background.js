async function getSettings() {
  return await messenger.storage.local.get([
    "apiUrl",
    "apiKey",
    "model",
    "systemPrompt",
    "apiFormat",
  ]);
}

async function getComposeSystemPrompt() {
  const data = await messenger.storage.local.get("composeSystemPrompt");
  return (
    data.composeSystemPrompt ||
    "You are a helpful email writing assistant. Based on the subject and any existing content provided, write or improve the email body. Match the tone implied by the subject. Be clear, concise, and professional. Respond with ONLY the email body content, no extra commentary."
  );
}

/**
 * Convert AI plain text to safe HTML with basic formatting support.
 * Handles line endings (\\r\\n, \\r, \\n), markdown formatting,
 * and escapes HTML special characters.
 */
function textToHtml(text) {
  // 1. Normalize line endings
  let html = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 2. Extract markdown links and replace with placeholders.
  //    This protects the URL from HTML escaping while keeping it intact.
  const links = [];
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
    const idx = links.length;
    links.push({ text: linkText, url });
    return `\x00LINK${idx}\x00`;
  });

  // 3. Escape HTML special characters
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 4. Restore links as proper HTML anchors
  for (let i = 0; i < links.length; i++) {
    const escapedText = links[i].text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const escapedUrl = links[i].url
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    html = html.replace(
      `\x00LINK${i}\x00`,
      `<a href="${escapedUrl}">${escapedText}</a>`
    );
  }

  // 5. Convert other markdown formatting to HTML tags
  //    Order: code first (to protect its content), then bold before italic
  html = html
    .replace(/`(.+?)`/g, "<code>$1</code>")                // `code`
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")      // **bold**
    .replace(/__(.+?)__/g, "<strong>$1</strong>")          // __bold__
    .replace(/\*(.+?)\*/g, "<em>$1</em>")                  // *italic*
    .replace(/_(.+?)_/g, "<em>$1</em>")                     // _italic_
    .replace(/~~(.+?)~~/g, "<s>$1</s>");                    // ~~strikethrough~~

  // 6. Convert line breaks to HTML
  html = html
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");

  return html;
}

async function callOpenAI(apiUrl, apiKey, model, systemPrompt, emailSubject, emailBody, senderName, instructions) {
  const userPrompt = instructions
    ? `Generate a reply to the following email. User instructions: ${instructions}\n\nFrom: ${senderName}\nSubject: ${emailSubject}\n\n${emailBody}`
    : `Generate a reply to the following email.\n\nFrom: ${senderName}\nSubject: ${emailSubject}\n\n${emailBody}`;

  return callOpenAIDirect(apiUrl, apiKey, model, systemPrompt, userPrompt);
}

async function callOpenAIDirect(apiUrl, apiKey, model, systemPrompt, userPrompt) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(apiUrl, apiKey, model, systemPrompt, emailSubject, emailBody, senderName, instructions) {
  const userContent = instructions
    ? `Generate a reply to the following email. User instructions: ${instructions}\n\nFrom: ${senderName}\nSubject: ${emailSubject}\n\n${emailBody}`
    : `Generate a reply to the following email.\n\nFrom: ${senderName}\nSubject: ${emailSubject}\n\n${emailBody}`;

  return callAnthropicDirect(apiUrl, apiKey, model, systemPrompt, userContent);
}

async function callAnthropicDirect(apiUrl, apiKey, model, systemPrompt, userContent) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  const responseText = await response.text();
  console.log("Auto Reply AI: API response =", responseText);

  if (!response.ok) {
    throw new Error(`API error (${response.status}): ${responseText}`);
  }

  const data = JSON.parse(responseText);

  if (data.content && Array.isArray(data.content)) {
    const textBlock = data.content.find((b) => b.type === "text");
    if (textBlock && textBlock.text) {
      return textBlock.text;
    }
  }

  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content;
  }

  throw new Error("Unexpected API response format: " + responseText);
}

function extractBody(parts) {
  if (!parts) return "";
  for (const part of parts) {
    if (part.parts) {
      const nested = extractBody(part.parts);
      if (nested) return nested;
    }
    if (part.contentType === "text/plain" && part.body) {
      return part.body;
    }
  }
  for (const part of parts) {
    if (part.parts) {
      const nested = extractBody(part.parts);
      if (nested) return nested;
    }
    if (part.contentType === "text/html" && part.body) {
      const doc = new DOMParser().parseFromString(part.body, "text/html");
      return doc.body.textContent || "";
    }
  }
  return "";
}

async function generateDraftForMessage(message, instructions = "") {
  const settings = await getSettings();

  if (!settings.apiUrl || !settings.apiKey || !settings.model) {
    throw new Error("API not configured. Open Settings to configure.");
  }

  const systemPrompt =
    settings.systemPrompt ||
    "You are a helpful email assistant. Generate a professional, concise, and polite reply to the email provided. Match the language of the original email. Do not include greetings or signatures unless contextually appropriate.";

  const fullMessage = await messenger.messages.getFull(message.id);
  const body = extractBody(fullMessage.parts);
  const senderName = message.author || "Unknown";
  const subject = message.subject || "(no subject)";

  const callApi = settings.apiFormat === "anthropic" ? callAnthropic : callOpenAI;

  const replyText = await callApi(
    settings.apiUrl,
    settings.apiKey,
    settings.model,
    systemPrompt,
    subject,
    body,
    senderName,
    instructions
  );

  console.log("Auto Reply AI: replyText =", replyText);

  const composeTab = await messenger.compose.beginReply(
    message.id,
    "replyToSender"
  );

  const composeTabId = composeTab.id;

  const currentDetails = await messenger.compose.getComposeDetails(composeTabId);

  if (currentDetails.isPlainText) {
    const existingBody = currentDetails.plainTextBody || "";
    await messenger.compose.setComposeDetails(composeTabId, {
      plainTextBody: replyText + "\n\n" + existingBody,
    });
  } else {
    const existingHtml = currentDetails.body || "";
    const replyHtml = textToHtml(replyText);

    const bodyMatch = existingHtml.match(/<body[^>]*>/i);
    if (bodyMatch) {
      const insertPos = bodyMatch.index + bodyMatch[0].length;
      const newHtml = existingHtml.substring(0, insertPos) +
        replyHtml +
        existingHtml.substring(insertPos);

      await messenger.compose.setComposeDetails(composeTabId, {
        body: newHtml,
      });
    } else {
      await messenger.compose.setComposeDetails(composeTabId, {
        body: replyHtml + existingHtml,
      });
    }
  }

  console.log("Auto Reply AI: Draft ready for review.");
}

async function generateAndUpdateCompose(msg) {
  const {
    tabId,
    subject,
    userContent,
    instructions,
    isPlainText,
    existingHtml,
    existingPlainText,
  } = msg;

  console.log("Auto Reply AI: Background processing compose request", {
    tabId,
    subject,
    userContentLength: (userContent || "").length,
    isPlainText,
  });

  const settings = await getSettings();
    const composeSystemPrompt = await getComposeSystemPrompt();

    if (!settings.apiUrl || !settings.apiKey || !settings.model) {
      throw new Error("API not configured. Open Settings to configure.");
    }

    // Build prompt
    let userPrompt;
    if (instructions) {
      userPrompt = `Write or improve the email below based on these instructions: ${instructions}\n\nSubject: ${subject}\n\n${userContent || "(no existing content yet — write a full email based on the subject and instructions)"}`;
    } else {
      userPrompt = `Write or improve the following email.\n\nSubject: ${subject}\n\n${userContent || "(no existing content yet — write a full email based on the subject)"}`;
    }

    const callDirect =
      settings.apiFormat === "anthropic" ? callAnthropicDirect : callOpenAIDirect;

    const rawText = await callDirect(
      settings.apiUrl,
      settings.apiKey,
      settings.model,
      composeSystemPrompt,
      userPrompt
    );

    // Clean up the response
    let generatedText = rawText.trim();
    const codeBlockRegex = /^```(?:\w*)\n?([\s\S]*?)\n?```$/;
    const match = generatedText.match(codeBlockRegex);
    if (match) {
      generatedText = match[1].trim();
    }

    if (!generatedText) {
      throw new Error("AI returned empty content.");
    }

    console.log("Auto Reply AI: Generated text:", generatedText);

    // Update the compose window (preserve signature)
    if (isPlainText) {
      let newBody = generatedText;
      if (existingPlainText) {
        // Try to keep the signature after "-- "
        const sigMatch = existingPlainText.match(/-- \n/);
        if (sigMatch) {
          const sigPart = existingPlainText.substring(sigMatch.index);
          newBody = generatedText + "\n\n" + sigPart;
        } else {
          newBody = generatedText + "\n\n" + existingPlainText;
        }
      }
      await messenger.compose.setComposeDetails(tabId, {
        plainTextBody: newBody,
      });
    } else {
      // HTML mode — preserve signature
      if (existingHtml) {
        const sigDivMatch = existingHtml.match(
          /<div[^>]*class="[^"]*\bmoz-signature\b[^"]*"[^>]*>[\s\S]*?<\/div>/i
        );

        if (sigDivMatch) {
          // Found a moz-signature div.
          // Replace everything between <body> and the signature div.
          const sigStart = sigDivMatch.index;
          const bodyOpenMatch = existingHtml.match(/<body[^>]*>/i);
          if (bodyOpenMatch) {
            const bodyOpenEnd = bodyOpenMatch.index + bodyOpenMatch[0].length;

            const replyHtml = textToHtml(generatedText);

            const newHtml =
              existingHtml.substring(0, bodyOpenEnd) +
              replyHtml +
              "\n" +
              existingHtml.substring(sigStart);

            console.log(
              "Auto Reply AI: Replacing content before signature"
            );
            await messenger.compose.setComposeDetails(tabId, {
              body: newHtml,
            });
            console.log(
              "Auto Reply AI: Compose window updated (preserved signature)"
            );
            return;
          }
        }

        // No moz-signature found — fall back to inserting after <body>
        const bodyMatch = existingHtml.match(/<body[^>]*>/i);
        if (bodyMatch) {
          const insertPos = bodyMatch.index + bodyMatch[0].length;
          const replyHtml = textToHtml(generatedText);

          const newHtml =
            existingHtml.substring(0, insertPos) +
            replyHtml +
            existingHtml.substring(insertPos);

          await messenger.compose.setComposeDetails(tabId, {
            body: newHtml,
          });
          console.log(
            "Auto Reply AI: Compose window updated (insert after body)"
          );
          return;
        }

        // No <body> either — just set the text directly
        const replyHtml = textToHtml(generatedText);
        await messenger.compose.setComposeDetails(tabId, {
          body: replyHtml,
        });
        console.log("Auto Reply AI: Compose window updated (direct)");
      } else {
        // No existing HTML — just set the text
        const replyHtml = textToHtml(generatedText);
        await messenger.compose.setComposeDetails(tabId, {
          body: replyHtml,
        });
        console.log("Auto Reply AI: Compose window updated (no existing)");
      }
    }
}

messenger.runtime.onMessage.addListener((msg) => {
  if (msg.action === "generateDraft" && msg.messageId) {
    // Return a Promise so the popup can await the result.
    // If the popup closes, the background continues anyway.
    return messenger.messages.get(msg.messageId).then((message) => {
      return generateDraftForMessage(message, msg.instructions || "");
    }).then(
      () => ({ success: true }),
      (err) => {
        console.error("Auto Reply AI: Failed to generate reply:", err);
        return { error: err.message };
      }
    );
  }

  if (msg.action === "generateComposeContent") {
    // Return a Promise so the popup can await the result.
    // If the popup closes, the background continues anyway.
    return generateAndUpdateCompose(msg).then(
      () => ({ success: true }),
      (err) => {
        console.error("Auto Reply AI: Compose handler error:", err);
        return { error: err.message };
      }
    );
  }
});
