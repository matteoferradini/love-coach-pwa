"use client";

import { useMemo, useState } from "react";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Ciao. Sono il tuo Love Coach. Dimmi cosa sta succedendo nella tua relazione e cosa vuoi ottenere.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const canSend = useMemo(
    () => input.trim().length > 0 && !loading,
    [input, loading]
  );

  async function send() {
    if (!canSend) return;

    const userMsg: ChatMsg = { role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      const data = await res.json();

      const assistantMsg: ChatMsg = {
        role: "assistant",
        content: data.reply || "Errore nella risposta",
      };

      setMessages((m) => [...m, assistantMsg]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Errore di connessione.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: 16 }}>
      <h1>Love Coach AI</h1>

      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: 10,
          padding: 10,
          height: "65vh",
          overflowY: "auto",
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              textAlign: m.role === "user" ? "right" : "left",
              margin: "8px 0",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: 8,
                borderRadius: 8,
                background: m.role === "user" ? "#eee" : "#fff",
                border: "1px solid #ddd",
              }}
            >
              {m.content}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Scrivi qui…"
          style={{ flex: 1, padding: 10 }}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} disabled={!canSend}>
          Invia
        </button>
      </div>
    </main>
  );
}
