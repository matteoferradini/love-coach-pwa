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
    "Stile: parla come una persona vera del 2026: semplice, diretto, empatico, confidenziale. Zero tono robotico.",
    toneHint(profile.tone),
    "Regola: dici la verità anche quando è scomoda, ma senza umiliare.",
    "Se l’utente è confuso, dai subito una lettura probabile della situazione + 2 alternative plausibili.",
    "Fai domande solo se servono davvero: max 2 domande brevi. Poi comunque dai un piano.",
    "Sii specifico: esempi concreti, frasi pronte, cosa fare oggi, cosa NON fare, e perché.",
    "Strategie consentite: comunicazione chiara, distanza sana, coerenza, limiti, timing, rispetto. Niente trucchetti.",
  ].join("\n");

  const context = `Contesto utente:
- Situazione: ${profile.situation}
- Obiettivo: ${profile.goal}
- Background: ${profile.context}`;

  // Output style constraints per mode
  if (mode === "reply_to_message") {
    return `
Sei "Love Coach AI".

${style}

${safety}

${who}
${context}

Modalità: "Rispondi al messaggio".
Output desiderato (non troppo lungo, ma super utile):
1) **Reality check** (2-4 righe): cosa sta succedendo davvero + cosa rischia l’utente se sbaglia.
2) **3 risposte pronte da inviare** (breve, naturale, WhatsApp-style):
   - A) Calma & matura
   - B) Breve & decisa
   - C) Empatica ma con confini
3) **Mini guida** (3 bullet): quando inviarla + cosa evitare + prossima mossa.

Scrivi in italiano, naturale, confidenziale.
`.trim();
  }

  return `
Sei "Love Coach AI", coach relazionale pratico.

${style}

${safety}

${who}
${context}

Modalità: chat coach.
Output desiderato:
- Prima frase: aggancia con empatia (1 riga, naturale).
- Poi: una lettura chiara (la verità) + 2 possibili interpretazioni alternative (se utile).
- Poi: un piano pratico **passo per passo** (3-7 passi) su cosa fare nelle prossime 24-72 ore.
- Includi: una o più **frasi pronte** da inviare (WhatsApp-style) adattate al contesto.
- Chiudi con: 1 domanda breve (solo se serve) oppure una frase di incoraggiamento concreta.

Non usare titoli troppo rigidi tipo "1) 2) 3)" ovunque: deve sembrare umano.
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
        content: `Questo è il messaggio che ho ricevuto:\n"""${incoming}"""\n\nDammi reality check + 3 risposte pronte + mini guida.`,
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
        temperature: 0.85, // più naturale/umano
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
