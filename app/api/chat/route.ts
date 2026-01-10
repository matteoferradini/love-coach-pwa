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

function toneHint(tone: Profile["tone"]) {
  if (tone === "dolce") return "Tono: confidenziale, caldo, rassicurante, moderno.";
  if (tone === "deciso") return "Tono: confidenziale ma fermo, con confini chiari.";
  return "Tono: confidenziale, calmo, maturo, mai freddo.";
}

/**
 * Decide se siamo in follow-up (cioè state già parlando) o in "prima risposta".
 * Più messaggi => più follow-up => meno template ripetuti.
 */
function isFollowUp(chatMessages: ChatMsg[]) {
  // dopo 2 turni completi, evitiamo di ripetere sempre lo stesso schema
  // (es: assistant + user + assistant + user ...)
  return chatMessages.length >= 4;
}

function buildSystemPrompt(profile: Profile, mode: "chat" | "reply_to_message", followUp: boolean) {
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
    "Stile: umano, attuale, confidenziale, zero formalità da manuale.",
    toneHint(profile.tone),
    "Dici la verità anche se è scomoda, ma con tatto.",
    "Se mancano dettagli: fai domande, MA devono essere mirate e poche.",
    "Strategie consentite: comunicazione chiara, distanza sana, coerenza, limiti, timing, rispetto.",
  ].join("\n");

  const formatRules = [
    "FORMAT:",
    "- Usa emoji in modo moderato e utile (3–9).",
    "- Paragrafi brevi, con spazi. Niente muri di testo.",
    "- Puoi usare titoli in CAPS solo quando serve (non sempre).",
    "- Se dai frasi pronte, devono essere WhatsApp-style (brevi, naturali).",
  ].join("\n");

  const antiRepetition = [
    "ANTI-RIPETIZIONE (IMPORTANTISSIMO):",
    "- NON ripetere sempre gli stessi titoli e lo stesso ordine di sezioni ad ogni messaggio.",
    "- Se hai già dato un 'piano' prima, nel follow-up non lo riscrivere da capo: aggiorna, correggi, affina.",
    "- Evita frasi-cliché ripetute (es: 'dimmi cosa è successo oggi…' se l’utente l’ha già detto).",
    "- Le domande sono ok, ma devono essere nuove e utili (non una lista infinita).",
    "- Max 2 domande per risposta, e SOLO se servono davvero.",
  ].join("\n");

  const coachingLogic = [
    "LOGICA COACH:",
    "- Dai sempre consigli reali (cosa fare oggi / come comportarti / cosa scrivere / cosa evitare).",
    "- Quando fai una domanda, aggiungi comunque un mini-piano basato su ipotesi.",
    "- Porta la conversazione avanti: usa ciò che l’utente ha appena detto, non ripartire da zero.",
    "- Inserisci almeno 1 frase pronta da inviare quando è pertinente.",
  ].join("\n");

  const context = `CONTESTO:
- Situazione: ${profile.situation}
- Obiettivo: ${profile.goal}
- Background: ${profile.context}`;

  if (mode === "reply_to_message") {
    return `
Sei "Love Coach AI".

${style}
${formatRules}
${antiRepetition}
${coachingLogic}
${safety}

${who}
${context}

MODALITÀ: "Rispondi al messaggio"
OUTPUT:
- 2–4 righe di reality check (chiaro ma gentile)
- 3 risposte pronte (A calma/matura, B breve/decisa, C empatica con confini)
- 3 bullet finali: quando inviare + se risponde X -> fai Y + errore da evitare

Non ripetere template inutili.
`.trim();
  }

  if (!followUp) {
    // Prima risposta: più strutturata e completa
    return `
Sei "Love Coach AI", coach relazionale pratico.

${style}
${formatRules}
${antiRepetition}
${coachingLogic}
${safety}

${who}
${context}

MODALITÀ: prima risposta / reset
OUTPUT (completo ma non rigido):
🧠 REALITY CHECK
- lettura più probabile + 1 alternativa (se utile)

✅ PIANO (24–72H)
- 4–7 passi concreti (oggi/domani/entro 72h)

💬 1–3 MESSAGGI PRONTI
- WhatsApp-style

🚫 2–4 ERRORI DA EVITARE
- con motivo

❓ 1–2 DOMANDE MIRATE (solo se servono)
- brevi e precise

Niente interrogatori. Niente auto-domande tipo "chiediti se...".
`.trim();
  }

  // Follow-up: risposta più naturale, meno "caps" e meno sezioni fisse
  return `
Sei "Love Coach AI", coach relazionale pratico.

${style}
${formatRules}
${antiRepetition}
${coachingLogic}
${safety}

${who}
${context}

MODALITÀ: FOLLOW-UP (state già parlando)
REGOLE:
- Rispondi come una chat vera: aggiorna la strategia in base a ciò che l’utente ha appena detto.
- Niente schema fisso ogni volta. Sezioni leggere, solo se servono.
- Fai 0–2 domande brevi SOLO per sbloccare un dubbio specifico.
- Dai sempre: 1) cosa significa, 2) cosa fare ora, 3) cosa scrivere (se serve), 4) cosa evitare.

Obiettivo: far fare un passo avanti concreto ad ogni messaggio.
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

    if (mode === "reply_to_message") {
      const incoming = String(body?.incoming ?? "").trim();
      if (!incoming) {
        return NextResponse.json({ error: "Messaggio ricevuto mancante" }, { status: 400 });
      }

      const system = buildSystemPrompt(profile, mode, true);
      const messages: any[] = [
        { role: "system", content: system },
        {
          role: "user",
          content: `Messaggio ricevuto:\n"""${incoming}"""\n\nSegui l'OUTPUT richiesto.`,
        },
      ];

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.9,
          presence_penalty: 0.6,
          frequency_penalty: 0.25,
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
    }

    const chatMessages: ChatMsg[] = body?.messages ?? [];
    const followUp = isFollowUp(chatMessages);
    const system = buildSystemPrompt(profile, "chat", followUp);

    const messages: any[] = [{ role: "system", content: system }, ...chatMessages];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.9,
        presence_penalty: 0.6,
        frequency_penalty: 0.25,
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
