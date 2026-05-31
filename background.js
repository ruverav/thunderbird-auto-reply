async function getSettings() {
  return await messenger.storage.local.get([
    "apiUrl",
    "apiKey",
    "model",
    "systemPrompt",
    "apiFormat",
  ]);
}

async function callOpenAI(apiUrl, apiKey, model, systemPrompt, emailSubject, emailBody, senderName, instructions) {
  const userPrompt = instructions
    ? `Generate a reply to the following email. User instructions: ${instructions}\n\nFrom: ${senderName}\nSubject: ${emailSubject}\n\n${emailBody}`
    : `Generate a reply to the following email.\n\nFrom: ${senderName}\nSubject: ${emailSubject}\n\n${emailBody}`;

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
    const replyHtml = replyText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>");

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

messenger.runtime.onMessage.addListener((msg) => {
  if (msg.action === "generateDraft" && msg.messageId) {
    messenger.messages.get(msg.messageId).then((message) => {
      generateDraftForMessage(message, msg.instructions || "").catch((err) => {
        console.error("Auto Reply AI: Failed to generate reply:", err);
      });
    });
  }
});
