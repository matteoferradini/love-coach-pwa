"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";
type ChatMsg = { role: Role; content: string };

type Profile = {
  name?: string;
  situation: "coppia" | "ex" | "frequentazione";
  goal: "chiarire" | "ricostruire" | "distaccarsi" | "capire";
  tone: "calmo" | "deciso" | "dolce" | "ironico" | "brevissimo" | "nofrills";
  boundaries: {
    noManipulation: boolean;
    noStalking: boolean;
  };
  context: string;
};

const PROFILE_KEY = "love_coach_profile_v2";

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

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<"chat" | "reply" | "analyze" | "daily" | "profile">("chat");

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Ciao 👋 Compila il profilo e poi dimmi cosa sta succedendo." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [incomingMsg, setIncomingMsg] = useState("");
  const [replyResult, setReplyResult] = useState("");

  const [transcript, setTranscript] = useState("");
  const [analyzeResult, setAnalyzeResult] = useState("");

  const [dailyNote, setDailyNote] = useState("");
  const [dailyResult, setDailyResult] = useState("");

  const [toast, setToast] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const p = loadProfile();
    if (p) {
      setProfile(p);
      setView("chat");
      setMessages([
        {
          role: "assistant",
          content: "Bentornato 🙂 Dimmi cosa è successo oggi (1–3 righe) e cosa vuoi ottenere.",
        },
      ]);
    } else {
      setView("profile");
    }
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (!listRef.current) return;
      listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, [messages, loading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function sendChat() {
    if (!profile || !canSend) return;

    const userMsg: ChatMsg = { role: "user", content: input.trim() };
    const newMessages: ChatMsg[] = [...messages, userMsg];
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

  async function analyzeChat() {
    if (!profile || transcript.trim().length === 0) return;
    setLoading(true);
    setAnalyzeResult("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "analyze_chat",
          profile,
          transcript: transcript.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Errore API");

      setAnalyzeResult(data.reply);
    } catch (e: any) {
      setAnalyzeResult(`Errore: ${e?.message ?? "connessione"}`);
    } finally {
      setLoading(false);
    }
  }

  async function getDailyTask() {
    if (!profile) return;
    setLoading(true);
    setDailyResult("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "daily_task",
          profile,
          note: dailyNote.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Errore API");

      setDailyResult(data.reply);
    } catch (e: any) {
      setDailyResult(`Errore: ${e?.message ?? "connessione"}`);
    } finally {
      setLoading(false);
    }
  }

  function resetProfile() {
    localStorage.removeItem(PROFILE_KEY);
    setProfile(null);
    setView("profile");
    setMessages([{ role: "assistant", content: "Ok 👇 rifacciamo il profilo e ripartiamo bene." }]);
    setIncomingMsg("");
    setReplyResult("");
    setTranscript("");
    setAnalyzeResult("");
    setDailyNote("");
    setDailyResult("");
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copiato ✅");
    } catch {
      setToast("Non riesco a copiare 😅");
    }
  }

  const titleRight = profile
    ? `${profile.situation.toUpperCase()} • ${profile.goal.toUpperCase()}`
    : "SETUP";

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      {/* Top bar (mobile) */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-lg">❤️</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Love Coach AI</div>
              <div className="text-xs text-zinc-400">{titleRight}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {profile && (
              <>
                <button
                  onClick={() => setView("chat")}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-medium transition",
                    view === "chat" ? "bg-white text-zinc-950" : "bg-white/10 hover:bg-white/15"
                  )}
                >
                  Chat
                </button>
                <button
                  onClick={() => setView("reply")}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-medium transition",
                    view === "reply" ? "bg-white text-zinc-950" : "bg-white/10 hover:bg-white/15"
                  )}
                >
                  📝
                </button>
                <button
                  onClick={() => setView("analyze")}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-medium transition",
                    view === "analyze" ? "bg-white text-zinc-950" : "bg-white/10 hover:bg-white/15"
                  )}
                >
                  📎
                </button>
                <button
                  onClick={() => setView("daily")}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-medium transition",
                    view === "daily" ? "bg-white text-zinc-950" : "bg-white/10 hover:bg-white/15"
                  )}
                >
                  🎯
                </button>
                <button
                  onClick={() => setView("profile")}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-medium transition",
                    view === "profile" ? "bg-white text-zinc-950" : "bg-white/10 hover:bg-white/15"
                  )}
                >
                  ⚙️
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[280px_1fr]">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:block">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="mb-3 text-sm font-semibold text-zinc-200">Pannello</div>

            <div className="flex flex-col gap-2">
              <SideBtn active={view === "chat"} onClick={() => setView("chat")} icon="💬" label="Chat" />
              <SideBtn active={view === "reply"} onClick={() => setView("reply")} icon="📝" label="Rispondi" />
              <SideBtn active={view === "analyze"} onClick={() => setView("analyze")} icon="📎" label="Analizza chat" />
              <SideBtn active={view === "daily"} onClick={() => setView("daily")} icon="🎯" label="Obiettivo oggi" />
              <SideBtn active={view === "profile"} onClick={() => setView("profile")} icon="⚙️" label="Profilo" />
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-zinc-950/40 p-3 text-xs text-zinc-300">
              <div className="font-semibold text-zinc-200">Tip veloce</div>
              <div className="mt-1">
                📎 incolla chat + “cosa vuoi ottenere” → ti do piano 48h + risposte pronte. 🎯 ti do un task
                giornaliero semplice.
              </div>
            </div>

            {profile && (
              <button
                onClick={resetProfile}
                className="mt-4 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
              >
                Reimposta profilo
              </button>
            )}
          </div>
        </aside>

        {/* Main */}
        <section className="min-h-[70vh]">
          {view === "profile" || !profile ? (
            <ProfileCard
              profile={profile}
              onDone={(p) => {
                saveProfile(p);
                setProfile(p);
                setView("chat");
                setMessages([
                  {
                    role: "assistant",
                    content: "Perfetto 🙂 Dimmi cosa è successo oggi (1–3 righe) e cosa vuoi ottenere.",
                  },
                ]);
              }}
            />
          ) : view === "reply" ? (
            <ReplyCard
              incomingMsg={incomingMsg}
              setIncomingMsg={setIncomingMsg}
              replyResult={replyResult}
              loading={loading}
              onGenerate={generateReplies}
              onCopy={() => replyResult && copy(replyResult)}
            />
          ) : view === "analyze" ? (
            <AnalyzeCard
              transcript={transcript}
              setTranscript={setTranscript}
              result={analyzeResult}
              loading={loading}
              onGenerate={analyzeChat}
              onCopy={() => analyzeResult && copy(analyzeResult)}
            />
          ) : view === "daily" ? (
            <DailyCard
              note={dailyNote}
              setNote={setDailyNote}
              result={dailyResult}
              loading={loading}
              onGenerate={getDailyTask}
              onCopy={() => dailyResult && copy(dailyResult)}
            />
          ) : (
            <ChatCard
              messages={messages}
              loading={loading}
              input={input}
              setInput={setInput}
              canSend={canSend}
              onSend={sendChat}
              listRef={listRef}
              onCopy={(text) => copy(text)}
            />
          )}
        </section>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function SideBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-white/10 px-3 py-3 text-left text-sm transition",
        active ? "bg-white text-zinc-950" : "bg-white/5 hover:bg-white/10 text-zinc-100"
      )}
    >
      <span className="text-base">{icon}</span>
      <span className="font-semibold">{label}</span>
    </button>
  );
}

function ChatCard({
  messages,
  loading,
  input,
  setInput,
  canSend,
  onSend,
  listRef,
  onCopy,
}: {
  messages: ChatMsg[];
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
  canSend: boolean;
  onSend: () => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="text-sm font-semibold text-zinc-200">Chat</div>
        <div className="text-xs text-zinc-400">Risposte con realtà + piano</div>
      </div>

      <div ref={listRef} className="h-[60vh] overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div key={i} className={cn("mb-3 flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "group max-w-[92%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                m.role === "user"
                  ? "border-white/10 bg-white text-zinc-950"
                  : "border-white/10 bg-zinc-950/40 text-zinc-100"
              )}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>

              {m.role === "assistant" && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => onCopy(m.content)}
                    className="invisible rounded-lg bg-white/10 px-2 py-1 text-xs text-zinc-200 hover:bg-white/15 group-hover:visible"
                  >
                    Copia
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="mb-3 flex justify-start">
            <div className="max-w-[92%] rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-300">
              Sto pensando… ⏳
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi qui… (Invio per andare a capo, CMD+Invio per inviare)"
            className="min-h-[48px] max-h-[140px] flex-1 resize-none rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-white/20"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSend();
            }}
          />
          <button
            onClick={onSend}
            disabled={!canSend}
            className={cn(
              "rounded-2xl px-4 py-3 text-sm font-semibold transition",
              canSend ? "bg-white text-zinc-950 hover:bg-zinc-200" : "bg-white/10 text-zinc-500"
            )}
          >
            Invia
          </button>
        </div>

        <div className="mt-2 text-xs text-zinc-500">
          Tip: prova “Dimmi la verità e cosa fare oggi”. Per inviare da tastiera: <b>CMD+Invio</b>.
        </div>
      </div>
    </div>
  );
}

function ReplyCard({
  incomingMsg,
  setIncomingMsg,
  replyResult,
  loading,
  onGenerate,
  onCopy,
}: {
  incomingMsg: string;
  setIncomingMsg: (v: string) => void;
  replyResult: string;
  loading: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="text-sm font-semibold text-zinc-200">📝 Rispondi al messaggio</div>
        <div className="text-xs text-zinc-400">Reality check + 3 risposte</div>
      </div>

      <div className="p-4">
        <label className="text-xs font-semibold text-zinc-300">Incolla qui il messaggio</label>
        <textarea
          value={incomingMsg}
          onChange={(e) => setIncomingMsg(e.target.value)}
          className="mt-2 min-h-[140px] w-full resize-none rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-white/20"
          placeholder="Esempio: “Non lo so… in questo periodo sono confusa”"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={onGenerate}
            disabled={loading || incomingMsg.trim().length === 0}
            className={cn(
              "rounded-2xl px-4 py-2 text-sm font-semibold transition",
              incomingMsg.trim().length > 0 && !loading
                ? "bg-white text-zinc-950 hover:bg-zinc-200"
                : "bg-white/10 text-zinc-500"
            )}
          >
            {loading ? "Generando…" : "Genera"}
          </button>

          {replyResult && (
            <button
              onClick={onCopy}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Copia risposta
            </button>
          )}
        </div>

        {replyResult && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-300">Risultato</div>
              <button
                onClick={onCopy}
                className="rounded-lg bg-white/10 px-2 py-1 text-xs text-zinc-200 hover:bg-white/15"
              >
                Copia
              </button>
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
              {replyResult}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyzeCard({
  transcript,
  setTranscript,
  result,
  loading,
  onGenerate,
  onCopy,
}: {
  transcript: string;
  setTranscript: (v: string) => void;
  result: string;
  loading: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="text-sm font-semibold text-zinc-200">📎 Analizza chat</div>
        <div className="text-xs text-zinc-400">Dinamica + piano 48h + risposte pronte</div>
      </div>

      <div className="p-4">
        <label className="text-xs font-semibold text-zinc-300">Incolla qui la conversazione</label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          className="mt-2 min-h-[180px] w-full resize-none rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-white/20"
          placeholder={`Incolla pezzi di chat. Va bene anche disordinato.
Esempio:
Io: ...
Lei: ...
Io: ...`}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={onGenerate}
            disabled={loading || transcript.trim().length === 0}
            className={cn(
              "rounded-2xl px-4 py-2 text-sm font-semibold transition",
              transcript.trim().length > 0 && !loading
                ? "bg-white text-zinc-950 hover:bg-zinc-200"
                : "bg-white/10 text-zinc-500"
            )}
          >
            {loading ? "Analizzando…" : "Analizza"}
          </button>

          {result && (
            <button
              onClick={onCopy}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Copia
            </button>
          )}
        </div>

        {result && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-300">Risultato</div>
              <button
                onClick={onCopy}
                className="rounded-lg bg-white/10 px-2 py-1 text-xs text-zinc-200 hover:bg-white/15"
              >
                Copia
              </button>
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
              {result}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DailyCard({
  note,
  setNote,
  result,
  loading,
  onGenerate,
  onCopy,
}: {
  note: string;
  setNote: (v: string) => void;
  result: string;
  loading: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="text-sm font-semibold text-zinc-200">🎯 Obiettivo oggi</div>
        <div className="text-xs text-zinc-400">1 task + micro azioni</div>
      </div>

      <div className="p-4">
        <label className="text-xs font-semibold text-zinc-300">Nota (facoltativa)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-2 min-h-[120px] w-full resize-none rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-white/20"
          placeholder="Esempio: oggi sono tentato di scriverle / mi ha visualizzato / sono nervoso..."
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={onGenerate}
            disabled={loading}
            className={cn(
              "rounded-2xl px-4 py-2 text-sm font-semibold transition",
              !loading ? "bg-white text-zinc-950 hover:bg-zinc-200" : "bg-white/10 text-zinc-500"
            )}
          >
            {loading ? "Generando…" : "Dammi il task"}
          </button>

          {result && (
            <button
              onClick={onCopy}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Copia
            </button>
          )}
        </div>

        {result && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-300">Risultato</div>
              <button
                onClick={onCopy}
                className="rounded-lg bg-white/10 px-2 py-1 text-xs text-zinc-200 hover:bg-white/15"
              >
                Copia
              </button>
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
              {result}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
  onDone,
}: {
  profile: Profile | null;
  onDone: (p: Profile) => void;
}) {
  const [name, setName] = useState(profile?.name ?? "");
  const [situation, setSituation] = useState<Profile["situation"]>(profile?.situation ?? "coppia");
  const [goal, setGoal] = useState<Profile["goal"]>(profile?.goal ?? "capire");
  const [tone, setTone] = useState<Profile["tone"]>(profile?.tone ?? "dolce");
  const [context, setContext] = useState(profile?.context ?? "");
  const [noManipulation, setNoManipulation] = useState(profile?.boundaries.noManipulation ?? true);
  const [noStalking, setNoStalking] = useState(profile?.boundaries.noStalking ?? true);

  const ok = context.trim().length >= 10;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="text-sm font-semibold text-zinc-200">⚙️ Profilo</div>
        <div className="text-xs text-zinc-400">60 secondi e poi il coach ti segue meglio.</div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <label className="text-xs font-semibold text-zinc-300">Nome (opzionale)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-white/20"
            placeholder="Matteo…"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-300">Situazione</label>
          <select
            value={situation}
            onChange={(e) => setSituation(e.target.value as any)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-sm outline-none focus:border-white/20"
          >
            <option value="coppia">Coppia</option>
            <option value="ex">Ex</option>
            <option value="frequentazione">Frequentazione</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-300">Obiettivo</label>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as any)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-sm outline-none focus:border-white/20"
          >
            <option value="capire">Capire cosa fare</option>
            <option value="chiarire">Chiarire</option>
            <option value="ricostruire">Ricostruire</option>
            <option value="distaccarsi">Distaccarsi</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-semibold text-zinc-300">Stile del coach</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as any)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-sm outline-none focus:border-white/20"
          >
            <option value="dolce">Dolce (morbido ma onesto)</option>
            <option value="calmo">Calmo e maturo</option>
            <option value="deciso">Fermo (ma rispettoso)</option>
            <option value="ironico">Ironico leggero (smart)</option>
            <option value="brevissimo">Ultra breve</option>
            <option value="nofrills">Zero fronzoli</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-semibold text-zinc-300">Contesto (2–6 righe)</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="mt-2 min-h-[140px] w-full resize-none rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-white/20"
            placeholder="Esempio: Ci sentiamo da settimane, lei sparisce, io voglio capire se investire o chiudere..."
          />
          <div className="mt-2 text-xs text-zinc-500">Più contesto = consigli più specifici.</div>
        </div>

        <div className="lg:col-span-2 grid gap-2">
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={noManipulation}
              onChange={(e) => setNoManipulation(e.target.checked)}
              className="h-4 w-4"
            />
            Niente strategie manipolative
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={noStalking}
              onChange={(e) => setNoStalking(e.target.checked)}
              className="h-4 w-4"
            />
            Niente stalking / controllo
          </label>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-zinc-500">
            {ok ? "✅ Perfetto, possiamo partire." : "Scrivi almeno qualche riga di contesto."}
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
            className={cn(
              "rounded-2xl px-4 py-3 text-sm font-semibold transition",
              ok ? "bg-white text-zinc-950 hover:bg-zinc-200" : "bg-white/10 text-zinc-500"
            )}
          >
            Inizia
          </button>
        </div>
      </div>
    </div>
  );
}
