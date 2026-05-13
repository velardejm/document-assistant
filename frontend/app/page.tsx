"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Source {
  clause_ref: string;
  filename: string;
  project: string;
  similarity: number;
}

interface Result {
  query: string;
  answer: string;
  sources: Source[];
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("All Contracts");
  const [projects, setProjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/sync/projects`)
      .then((res) => res.json())
      .then((data) => setProjects(data))
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API}/chat/quick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          project: project === "All Contracts" ? null : project,
          top_k: 5,
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
      <h1>Contract Assistant</h1>

      <nav style={{ marginTop: 8, marginBottom: 32 }}>
        <a href="/" style={{ fontSize: 14, color: "#111", marginRight: 16, fontWeight: 600 }}>
          Quick Question
        </a>
        <a href="/conversation" style={{ fontSize: 14, color: "#666", marginRight: 16 }}>
          Conversation Mode
        </a>
        <a href="/documents" style={{ fontSize: 14, color: "#666" }}>
          Documents
        </a>
      </nav>

      <p style={{ color: "#666" }}>
        Ask a question about your contracts. Answers are cited by clause reference.
      </p>

      <div style={{ marginTop: 32 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Project
          </label>
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            style={{ padding: "8px 12px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc" }}
          >
            <option value="All Contracts">All Contracts</option>
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Question
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. What are the penalties for late completion?"
            rows={3}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14,
              borderRadius: 6,
              border: "1px solid #ccc",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <p style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
            Press Enter to submit, Shift+Enter for new line
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !query.trim()}
          style={{
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            backgroundColor: loading ? "#999" : "#111",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Searching..." : "Ask"}
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: 24,
          padding: 16,
          backgroundColor: "#fff0f0",
          border: "1px solid #ffcccc",
          borderRadius: 6,
          color: "#cc0000",
        }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 32 }}>
          <div style={{
            padding: 20,
            backgroundColor: "#f9f9f9",
            borderRadius: 8,
            border: "1px solid #e5e5e5",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}>
            {result.answer}
          </div>

          <div style={{ marginTop: 16 }}>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Sources</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {result.sources.map((s, i) => (
                <div key={i} style={{
                  padding: "8px 12px",
                  backgroundColor: "#f0f0f0",
                  borderRadius: 6,
                  fontSize: 13,
                  display: "flex",
                  justifyContent: "space-between",
                }}>
                  <span><strong>Clause {s.clause_ref}</strong> — {s.filename}</span>
                  <span style={{ color: "#888" }}>{(s.similarity * 100).toFixed(1)}% match</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}