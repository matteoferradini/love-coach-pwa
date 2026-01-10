"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "user" | "assistant";
type ChatMsg = { role: Role; content: string };

type Profile = {
  name?: string;
  situation: "coppia" | "ex" | "frequentazione";
  goal: "chiarire" | "ricostruire" | "distaccarsi" | "capire";
  tone: "calmo" | "deciso" | "dolce";
  boundaries: {
    noManipulation: boolean;
    noStalking: boolean;
  };
  context: string; // 2-6 righe
};

const PROFILE_KEY = "love_coach_profile_v1";

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function saveProfile(p: Profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [step, setStep] = useState<"onboarding" | "chat" | "reply">("onboarding");

  // chat
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Ciao. Compila il profilo e poi iniziamo 👇" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // reply mode
  const [incomingMsg, setIncomingMsg] = useState("");
  const [replyResult, setReplyResult] = useState<string>("");

  useEffect(() => {
    const p = loadProfile();
    if (p) {
      setProfile(p);
      setStep("chat");
      setMessages([
        {
          role: "assistant",
          content:
            "Bentornato. Dimmi cosa è successo oggi (1–3 righe) e cosa vuoi ottenere.",
        },
      ]);
    }
  }, []);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function sendChat() {
    if (!profile || !canSend) return;

    const userMsg: ChatMsg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          profile,
          messages: newMessages,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Errore API");

      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Errore: ${e?.message ?? "connessione"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function generateReplies() {
    if (!profile || incomingMsg.trim().length === 0) return;
    setLoading(true);
    setReplyResult("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "reply_to_message",
          profile,
          incoming: incomingMsg.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Errore API");

      setReplyResult(data.reply);
    } catch (e: any) {
      setReplyResult(`Errore: ${e?.message ?? "connessione"}`);
    } finally {
      setLoading(false);
    }
  }

  function resetProfile() {
    localStorage.removeItem(PROFILE_KEY);
    setProfile(null);
    setStep("onboarding");
    setMessages([{ role: "assistant", content: "Ok, rifacciamo il profilo 👇" }]);
  }

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>❤️ Love Coach AI</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {profile && (
            <>
              <button onClick={() => setStep("chat")}>Chat</button>
              <button onClick={() => setStep("reply")}>📝 Rispondi</button>
              <button onClick={resetProfile}>Reimposta</button>
            </>
          )}
        </div>
      </header>

      {!profile || step === "onboarding" ? (
        <Onboarding
          onDone={(p) => {
            saveProfile(p);
            setProfile(p);
            setStep("chat");
            setMessages([
              {
                role: "assistant",
                content:
                  "Perfetto. Ora dimmi cosa è successo oggi e cosa vuoi ottenere (1–3 righe).",
              },
            ]);
          }}
        />
      ) : step === "reply" ? (
        <section style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>📝 Rispondi al messaggio</h2>
          <p style={{ color: "#555", marginTop: 4 }}>
            Incolla qui il messaggio che hai ricevuto e ti preparo 3 risposte pronte (calma, decisa,
            empatica con confini).
          </p>

          <textarea
            value={incomingMsg}
            onChange={(e) => setIncomingMsg(e.target.value)}
            placeholder="Incolla il messaggio ricevuto…"
            style={{ width: "100%", minHeight: 120, padding: 12 }}
          />

          <button onClick={generateReplies} disabled={loading} style={{ marginTop: 10 }}>
            {loading ? "…" : "Genera risposte"}
          </button>

          {replyResult && (
            <pre
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 10,
                whiteSpace: "pre-wrap",
              }}
            >
              {replyResult}
            </pre>
          )}
        </section>
      ) : (
        <section style={{ marginTop: 16 }}>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 12,
              height: "65vh",
              overflowY: "auto",
              background: "white",
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  margin: "8px 0",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #eee",
                    background: m.role === "user" ? "#f5f5f5" : "#ffffff",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Scrivi qui…"
              style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
            />
            <button
              onClick={sendChat}
              disabled={!canSend}
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: canSend ? "black" : "#999",
                color: "white",
              }}
            >
              {loading ? "…" : "Invia"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [name, setName] = useState("");
  const [situation, setSituation] = useState<Profile["situation"]>("coppia");
  const [goal, setGoal] = useState<Profile["goal"]>("capire");
  const [tone, setTone] = useState<Profile["tone"]>("calmo");
  const [context, setContext] = useState("");
  const [noManipulation, setNoManipulation] = useState(true);
  const [noStalking, setNoStalking] = useState(true);

  const ok = context.trim().length >= 10;

  return (
    <section style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
      <h2 style={{ marginTop: 0 }}>Profilo rapido</h2>

      <label style={{ display: "block", marginTop: 8 }}>
        Il tuo nome (opzionale)
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 6 }}
          placeholder="Matteo…"
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <label>
          Situazione
          <select
            value={situation}
            onChange={(e) => setSituation(e.target.value as any)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            <option value="coppia">Coppia</option>
            <option value="ex">Ex</option>
            <option value="frequentazione">Frequentazione</option>
          </select>
        </label>

        <label>
          Obiettivo
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as any)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            <option value="capire">Capire cosa fare</option>
            <option value="chiarire">Chiarire</option>
            <option value="ricostruire">Ricostruire</option>
            <option value="distaccarsi">Distaccarsi</option>
          </select>
        </label>

        <label>
          Tono consigli
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as any)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            <option value="calmo">Calmo</option>
            <option value="deciso">Deciso</option>
            <option value="dolce">Dolce</option>
          </select>
        </label>
      </div>

      <label style={{ display: "block", marginTop: 10 }}>
        Contesto (2–6 righe): cosa è successo e cosa vuoi evitare
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          style={{ width: "100%", minHeight: 110, padding: 10, marginTop: 6 }}
          placeholder="Esempio: Ci sentiamo da settimane, lei sparisce, io voglio capire se investire o chiudere. Voglio evitare di sembrare bisognoso..."
        />
      </label>

      <div style={{ marginTop: 10 }}>
        <label style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={noManipulation}
            onChange={(e) => setNoManipulation(e.target.checked)}
          />{" "}
          Niente strategie manipolative
        </label>
        <label style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={noStalking}
            onChange={(e) => setNoStalking(e.target.checked)}
          />{" "}
          Niente stalking / controllo
        </label>
      </div>

      <button
        onClick={() =>
          onDone({
            name: name.trim() || undefined,
            situation,
            goal,
            tone,
            boundaries: { noManipulation, noStalking },
            context: context.trim(),
          })
        }
        disabled={!ok}
        style={{ marginTop: 12 }}
      >
        Inizia
      </button>

      {!ok && <p style={{ color: "#777" }}>Scrivi almeno qualche riga di contesto per partire.</p>}
    </section>
  );
}
