exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "無効なリクエストです" }) };
  }

  const { text, fieldName } = body;
  if (!text || !fieldName) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "text と fieldName が必要です" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "APIキーが設定されていません。Netlifyの環境変数 GEMINI_API_KEY を確認してください。" }),
    };
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const prompt = `あなたは高校の授業実践報告書を作成するアシスタントです。
教師が入力したキーワードや箇条書きを、「${fieldName}」として報告書に適した自然な文体（です・ます調）に変換してください。
元の意図を損なわず、具体的で明確な文章にしてください。変換後の文章のみを出力してください（前置きや説明は不要です）。

入力：
${text}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    return { statusCode: 200, headers, body: JSON.stringify({ result }) };
  } catch (e) {
    console.error("Gemini APIエラー:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "AI処理でエラーが発生しました: " + e.message }) };
  }
};
