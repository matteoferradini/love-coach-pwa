import { NextResponse } from "next/server";

type ChatMsg = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `
Sei Love Coach AI, guida relazionale pratica.
Niente diagnosi cliniche. Niente manipolazione o controllo.
Consigli chiari, rispettosi e concreti. Se serve fai 1-2 domande brevi.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: ChatMsg[] = body?.messages ?? [];

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY mancante in .env.local" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    const data = await response.json();

    // ✅ Se OpenAI risponde con errore, lo mostriamo chiaramente
    if (!response.ok) {
      return NextResponse.json(
        {
          error: `OpenAI HTTP ${response.status}: ${
            data?.error?.message ?? "errore sconosciuto"
          }`,
          details: data,
        },
        { status: 500 }
      );
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) {
      return NextResponse.json(
        { error: "Risposta inattesa dal modello", details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Errore sconosciuto" },
      { status: 500 }
    );
  }
}
