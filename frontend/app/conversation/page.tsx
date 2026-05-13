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
  const [newProject, setNewProject] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions();
    fetch(`${API}/sync/projects`)
      .then((res) => res.json())
      .then((data) => setProjects(data))
      .catch(() => {});
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
      body: JSON.stringify({ title: newTitle, project: newProject }),
    });
    const session = await res.json();
    setSessions((prev) => [session, ...prev]);
    setActiveSession(session);
    setMessages([]);
    setNewTitle("");
    setNewProject(null);
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
        width: 260,
        borderRight: "1px solid #e5e5e5",
        display: "flex",
        flexDirection: "column",
        padding: 16,
        gap: 8,
        overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Sessions</strong>
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
            <select
              value={newProject ?? ""}
              onChange={(e) => setNewProject(e.target.value || null)}
              style={{
                padding: "6px 8px",
                fontSize: 13,
                borderRadius: 4,
                border: "1px solid #ccc",
              }}
            >
              <option value="">All Contracts</option>
              {projects.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={createSession}
                style={{
                  flex: 1,
                  padding: "4px 0",
                  fontSize: 12,
                  backgroundColor: "#111",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Create
              </button>
              <button
                onClick={() => setCreating(false)}
                style={{
                  flex: 1,
                  padding: "4px 0",
                  fontSize: 12,
                  backgroundColor: "#eee",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <a href="/" style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
          ← Quick Question
        </a>

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
              {s.project ?? "All Contracts"} · {new Date(s.updated_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid #e5e5e5",
          fontWeight: 600,
          fontSize: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>{activeSession ? activeSession.title : "Select or create a session"}</span>
          {activeSession?.project && (
            <span style={{ fontSize: 12, fontWeight: 400, color: "#666" }}>
              {activeSession.project}
            </span>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {!activeSession && (
            <p style={{ color: "#999", textAlign: "center", marginTop: 60 }}>
              Select a session from the sidebar or create a new one.
            </p>
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
                      Clause {s.clause_ref}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ color: "#999", fontSize: 13, fontStyle: "italic" }}>
              Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {activeSession && (
          <div style={{
            padding: "16px 24px",
            borderTop: "1px solid #e5e5e5",
            display: "flex",
            gap: 12,
          }}>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question... (Enter to send, Shift+Enter for new line)"
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
        )}
      </div>
    </div>
  );
}