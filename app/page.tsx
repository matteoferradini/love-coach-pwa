"use client";

import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  async function sendMessage() {
    if (!input.trim()) return;

    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();

      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply ?? "Errore risposta" },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Errore di connessione" },
      ]);
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>❤️ Love Coach AI</h1>

      <div style={{ marginBottom: 20 }}>
        {messages.map((m, i) => (
          <p key={i}>
            <strong>{m.role === "user" ? "Tu" : "Coach"}:</strong>{" "}
            {m.content}
          </p>
        ))}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Scrivi qui…"
        style={{ width: "100%", padding: 10 }}
      />
      <button onClick={sendMessage} style={{ marginTop: 10 }}>
        Invia
      </button>
    </main>
  );
}
