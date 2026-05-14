"use client";

import { useState, useEffect, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Session {
  id: string;
  title: string;
  project: string | null;
  created_at: string;
  updated_at: string;
}

interface Source {
  clause_ref: string;
  filename: string;
  project: string;
  similarity: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  created_at: string;
}

export default function ConversationPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchSessions() {
    const res = await fetch(`${API}/chat/sessions`);
    const data = await res.json();
    setSessions(data);
  }

  async function openSession(session: Session) {
    setActiveSession(session);
    const res = await fetch(`${API}/chat/session/${session.id}`);
    const data = await res.json();
    setMessages(data.messages);
  }

  async function createSession() {
    if (!newTitle.trim()) return;
    const res = await fetch(`${API}/chat/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, project: null }),
    });
    const session = await res.json();
    setSessions((prev) => [session, ...prev]);
    setActiveSession(session);
    setMessages([]);
    setNewTitle("");
    setCreating(false);
  }

  async function sendMessage() {
    if (!query.trim() || !activeSession) return;
    const userQuery = query;
    setQuery("");
    setLoading(true);

    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userQuery,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`${API}/chat/session/${activeSession.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userQuery }),
      });
      const data = await res.json();

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Something went wrong. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>

      {/* Sidebar */}
      <div style={{
        width: 270,
        borderRight: "1px solid #e5e5e5",
        display: "flex",
        flexDirection: "column",
        padding: 16,
        gap: 8,
        overflowY: "auto",
      }}>
        {/* Branding */}
        <div style={{ marginBottom: 4 }}>
          <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>SCL Protocol Assistant</p>
          <p style={{ fontSize: 11, color: "#999", margin: "2px 0 0" }}>Conversation Mode</p>
        </div>

        {/* Nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #f0f0f0" }}>
          <a href="/" style={{ fontSize: 13, color: "#666" }}>← Quick Question</a>
          <a href="/documents" style={{ fontSize: 13, color: "#666" }}>Documents</a>
        </div>

        {/* Sessions header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 13 }}>Sessions</strong>
          <button
            onClick={() => setCreating(true)}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              backgroundColor: "#111",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            + New
          </button>
        </div>

        {/* New session input */}
        {creating && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createSession()}
              placeholder="Session title..."
              style={{
                padding: "6px 8px",
                fontSize: 13,
                borderRadius: 4,
                border: "1px solid #ccc",
              }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={createSession}
                style={{
                  flex: 1, padding: "4px 0", fontSize: 12,
                  backgroundColor: "#111", color: "#fff",
                  border: "none", borderRadius: 4, cursor: "pointer",
                }}
              >
                Create
              </button>
              <button
                onClick={() => setCreating(false)}
                style={{
                  flex: 1, padding: "4px 0", fontSize: 12,
                  backgroundColor: "#eee", border: "none",
                  borderRadius: 4, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Session list */}
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => openSession(s)}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              backgroundColor: activeSession?.id === s.id ? "#f0f0f0" : "transparent",
              fontWeight: activeSession?.id === s.id ? 600 : 400,
            }}
          >
            {s.title}
            <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
              {new Date(s.updated_at).toLocaleDateString()}
            </div>
          </div>
        ))}

        {/* Bottom disclaimer */}
        <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
          <p style={{ fontSize: 11, color: "#bbb", lineHeight: 1.5, margin: 0 }}>
            Powered by GPT-4o mini · SCL Protocol 2nd Ed. (2017)
          </p>
          <p style={{ fontSize: 11, color: "#bbb", lineHeight: 1.5, margin: "4px 0 0" }}>
            Non-commercial demo · Not affiliated with or endorsed by the{" "}
            <a href="https://www.scl.org.uk" target="_blank" rel="noopener noreferrer" style={{ color: "#bbb" }}>
              SCL
            </a>
            . Verify all answers against the{" "}
            <a href="https://www.scl.org.uk/resources/delay-disruption-protocol" target="_blank" rel="noopener noreferrer" style={{ color: "#bbb" }}>
              original document
            </a>
            .
          </p>
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Chat header */}
        <div style={{
          padding: "14px 24px",
          borderBottom: "1px solid #e5e5e5",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {activeSession ? activeSession.title : "Select or create a session"}
          </span>
          {activeSession && (
            <span style={{ fontSize: 12, color: "#999" }}>SCL Protocol 2nd Ed.</span>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {!activeSession && (
            <div style={{ textAlign: "center", marginTop: 60 }}>
              <p style={{ color: "#999", marginBottom: 8 }}>
                Select a session or create a new one to start.
              </p>
              <p style={{ color: "#bbb", fontSize: 12, maxWidth: 400, margin: "0 auto" }}>
                Ask multi-turn questions about the SCL Delay and Disruption Protocol.
                Answers cite the relevant sections of the Protocol.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                marginBottom: 24,
                display: "flex",
                flexDirection: "column",
                alignItems: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div style={{
                maxWidth: "75%",
                padding: "12px 16px",
                borderRadius: 10,
                backgroundColor: m.role === "user" ? "#111" : "#f4f4f4",
                color: m.role === "user" ? "#fff" : "#111",
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}>
                {m.content}
              </div>

              {m.sources && m.sources.length > 0 && (
                <div style={{ marginTop: 8, maxWidth: "75%", display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {m.sources.map((s, i) => (
                    <span key={i} style={{
                      padding: "3px 8px",
                      backgroundColor: "#e8f0fe",
                      borderRadius: 4,
                      fontSize: 11,
                      color: "#1a56db",
                    }}>
                      Section {s.clause_ref}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ color: "#999", fontSize: 13, fontStyle: "italic" }}>Thinking...</div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        {activeSession && (
          <div style={{
            padding: "16px 24px",
            borderTop: "1px solid #e5e5e5",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <div style={{ display: "flex", gap: 12 }}>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the SCL Protocol... (Enter to send, Shift+Enter for new line)"
                rows={2}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  fontSize: 14,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  resize: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !query.trim()}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  backgroundColor: loading ? "#999" : "#111",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: loading ? "not-allowed" : "pointer",
                  alignSelf: "flex-end",
                }}
              >
                {loading ? "..." : "Send"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#bbb", margin: 0 }}>
              Demo only · Not legal advice · Verify all answers against the original SCL Protocol document
            </p>
          </div>
        )}
      </div>
    </div>
  );
}