"use client";

import { useState } from "react";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);

  async function sendMessage() {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages: ChatMsg[] = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();

      const assistantMsg: ChatMsg = {
        role: "assistant",
        content: data.reply ?? data.error ?? "Errore risposta",
      };

      setMessages((m) => [...m, assistantMsg]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Errore: ${e?.message ?? "connessione"}` },
      ]);
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>❤️ Love Coach AI</h1>

      <div style={{ marginBottom: 20 }}>
        {messages.map((m, i) => (
          <p key={i}>
            <strong>{m.role === "user" ? "Tu" : "Coach"}:</strong> {m.content}
          </p>
        ))}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Scrivi qui…"
        style={{ width: "100%", padding: 10 }}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
      />
      <button onClick={sendMessage} style={{ marginTop: 10 }}>
        Invia
      </button>
    </main>
  );
}
