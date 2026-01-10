import { NextResponse } from "next/server";

type ChatMsg = { role: "user" | "assistant"; content: string };

type Profile = {
  name?: string;
  situation: "coppia" | "ex" | "frequentazione";
  goal: "chiarire" | "ricostruire" | "distaccarsi" | "capire";
  tone: "calmo" | "deciso" | "dolce";
  boundaries: { noManipulation: boolean; noStalking: boolean };
  context: string;
};

function buildSystemPrompt(profile: Profile, mode: "chat" | "reply_to_message") {
  const who = profile.name ? `L'utente si chiama ${profile.name}.` : "";
  const b = profile.boundaries;

  const rules = [
    "Sei Love Coach AI: guida relazionale pratica, empatica, concreta.",
    "Tono: morbido, rispettoso, mai aggressivo o giudicante.",
    "Obiettivo: aiutare l’utente a comportarsi bene e proteggere dignità e confini.",
    "Regola d’oro: dici sempre la verità anche se è scomoda (crudele realtà), ma con tatto.",
    "Niente diagnosi cliniche. Non sostituisci terapia.",
    b.noManipulation ? "Non proporre manipolazione, giochi mentali o strategie tossiche." : "",
    b.noStalking ? "Non proporre stalking, controllo, accessi non consentiti o ossessioni." : "",
    "Struttura risposta: 1) verità in 1–2 frasi, 2) cosa significa, 3) cosa fare oggi (3–6 passi), 4) frase pronta da inviare (se utile).",
    "Se l’utente vuole far tornare qualcuno: proponi solo azioni mature (spazio, chiarezza, coerenza), mai ricatti o pressioni.",
    "Se mancano dettagli, fai massimo 1 domanda breve, poi dai comunque un piano.",
    profile.tone === "calmo" ? "Stile: calmo e maturo." : "",
    profile.tone === "deciso" ? "Stile: dolce ma fermo nei confini." : "",
    profile.tone === "dolce" ? "Stile: dolce e comprensivo, ma chiaro." : "",
  ]
    .filter(Boolean)
    .join("\n");

  const context = `Contesto: ${profile.context}
Situazione: ${profile.situation}
Obiettivo: ${profile.goal}`;

  if (mode === "reply_to_message") {
    return `${rules}\n${who}\n${context}\n\nModalità: prima fai un "Reality check" in 2 frasi (cosa sta succedendo davvero e cosa rischia l’utente). Poi genera 3 risposte PRONTE da inviare: (1) calma e matura, (2) breve e decisa, (3) empatica con confini.`;
  }

  return `${rules}\n${who}\n${context}\n\nModalità: chat coach. Fai massimo 1 domanda breve se serve, poi dai consigli concreti.`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode: "chat" | "reply_to_message" = body?.mode ?? "chat";
    const profile: Profile | undefined = body?.profile;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY mancante" }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: "Profilo mancante" }, { status: 400 });
    }

    const system = buildSystemPrompt(profile, mode);

    let messages: any[] = [{ role: "system", content: system }];

    if (mode === "reply_to_message") {
      const incoming = String(body?.incoming ?? "").trim();
      if (!incoming) {
        return NextResponse.json({ error: "Messaggio ricevuto mancante" }, { status: 400 });
      }

      messages.push({
        role: "user",
        content: `Messaggio ricevuto:\n"""${incoming}"""\n\n1) Reality check (2 frasi)\n2) Tre risposte pronte (calma/matura, breve/decisa, empatica/con confini).`,
      });
    } else {
      const chatMessages: ChatMsg[] = body?.messages ?? [];
      messages = [...messages, ...chatMessages];
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
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: `OpenAI HTTP ${response.status}: ${data?.error?.message ?? "errore"}` },
        { status: 500 }
      );
    }

    const reply = data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Errore sconosciuto" }, { status: 500 });
  }
}
