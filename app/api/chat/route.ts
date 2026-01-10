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

// ---- Helpers ----
function toneHint(tone: Profile["tone"]) {
  if (tone === "dolce") return "Tono: confidenziale, caldo, rassicurante, moderno.";
  if (tone === "deciso") return "Tono: confidenziale ma fermo, con confini chiari.";
  return "Tono: confidenziale, calmo, maturo, mai freddo.";
}

function buildSystemPrompt(profile: Profile, mode: "chat" | "reply_to_message") {
  const who = profile.name ? `L'utente si chiama ${profile.name}.` : "";
  const b = profile.boundaries;

  const safety = [
    "Niente diagnosi cliniche o linguaggio da terapeuta. Sei un coach relazionale, non uno psicologo.",
    b.noManipulation
      ? "Non proporre manipolazione, giochi mentali, ricatti emotivi, punizioni, gelosia forzata."
      : "",
    b.noStalking
      ? "Non proporre stalking, controllo, accessi non consentiti, triangolazioni o cose illegali."
      : "",
    "Non incoraggiare comportamenti tossici. Proteggi dignità, confini e rispetto reciproco.",
  ]
    .filter(Boolean)
    .join("\n");

  const style = [
    "Stile: parla come una persona vera, semplice, diretto, empatico, confidenziale. Zero tono robotico.",
    toneHint(profile.tone),
    "Regola: dici la verità anche quando è scomoda, ma senza umiliare.",
    "Se l’utente è confuso, dai subito una lettura probabile + 1-2 alternative plausibili.",
    "Fai domande solo se servono davvero: max 2 domande brevi. Poi comunque dai un piano.",
    "Sii specifico: esempi concreti, frasi pronte, cosa fare oggi, cosa NON fare, e perché.",
    "Strategie consentite: comunicazione chiara, distanza sana, coerenza, limiti, timing, rispetto. Niente trucchetti.",
  ].join("\n");

  const formatRules = [
    "FORMAT RULES (OBBLIGATORIE):",
    "- Usa emoji in modo moderato e utile (es. 4–10 per risposta, non a caso).",
    "- Organizza sempre con sezioni e spazi: una riga vuota tra le parti.",
    "- Usa TITOLI IN CAPS con emoji davanti, esempio: '🧠 REALITY CHECK', '✅ COSA FARE ORA', '💬 MESSAGGIO PRONTO'.",
    "- Usa bullet points con trattini '-' e liste brevi (max 6 punti per sezione).",
    "- Evidenzia parole chiave con **grassetto** quando serve (non ovunque).",
    "- Niente muri di testo: paragrafi max 2–4 righe.",
    "- Linguaggio WhatsApp-style nelle frasi pronte: breve, naturale, non formale.",
  ].join("\n");

  const context = `Contesto utente:
- Situazione: ${profile.situation}
- Obiettivo: ${profile.goal}
- Background: ${profile.context}`;

  if (mode === "reply_to_message") {
    return `
Sei "Love Coach AI".

${style}

${formatRules}

${safety}

${who}
${context}

Modalità: "Rispondi al messaggio".
Output desiderato:
🧠 REALITY CHECK
- 2-4 righe: cosa sta succedendo davvero + cosa rischia l’utente se sbaglia.

💬 3 RISPOSTE PRONTE (WhatsApp)
- A) Calma & matura
- B) Breve & decisa
- C) Empatica ma con confini

🧭 MINI GUIDA
- Quando inviarla
- Cosa evitare
- Prossima mossa (1 step)

Scrivi in italiano, confidenziale, moderno.
`.trim();
  }

  return `
Sei "Love Coach AI", coach relazionale pratico.

${style}

${formatRules}

${safety}

${who}
${context}

Modalità: chat coach.
Output desiderato (senza rigidità eccessiva, ma sempre ordinato):
👋 APERTURA EMPATICA
- 1 riga naturale, che fa sentire l’utente al sicuro.

🧠 REALITY CHECK
- verità chiara (1–3 righe) + se utile 1-2 alternative plausibili.

✅ COSA FARE ORA (24–72H)
- 3–7 step pratici, specifici, in ordine.

🚫 COSA NON FARE
- 2–5 punti, per evitare errori classici.

💬 MESSAGGIO PRONTO (se utile)
- 1–3 versioni brevi, WhatsApp-style.

❓ UNA DOMANDA (solo se serve)
- max 1 domanda breve (oppure chiudi con incoraggiamento concreto).

Non usare tono formale. Niente “paper”. Deve sembrare una chat vera.
`.trim();
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
        content: `Messaggio ricevuto:\n"""${incoming}"""\n\nSegui l'output desiderato.`,
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
        temperature: 0.85,
        presence_penalty: 0.35,
        frequency_penalty: 0.15,
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
