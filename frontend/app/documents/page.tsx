"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Document {
  id: string;
  filename: string;
  project: string;
  chunk_count: number;
  ingested_at: string;
  drive_modified: string;
}

interface SyncResult {
  added: string[];
  updated: string[];
  skipped: string[];
  errors: { filename: string; error: string }[];
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    const res = await fetch(`${API}/sync/documents`);
    const data = await res.json();
    setDocuments(data);
  }

  async function runSync() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);

    try {
      const res = await fetch(`${API}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skip_pages_map: {
            "Contract C2024-49.pdf": 8,
          },
        }),
      });

      if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
      const data = await res.json();
      setSyncResult(data);
      await fetchDocuments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function deleteDocument(fileId: string) {
    setDeleting(fileId);
    try {
      await fetch(`${API}/sync/documents/${fileId}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== fileId));
    } catch {
      setError("Failed to delete document");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      <h1>Documents</h1>

      <nav style={{ marginTop: 8, marginBottom: 32 }}>
        <a href="/" style={{ fontSize: 14, color: "#666", marginRight: 16 }}>Quick Question</a>
        <a href="/conversation" style={{ fontSize: 14, color: "#666", marginRight: 16 }}>Conversation Mode</a>
        <a href="/documents" style={{ fontSize: 14, color: "#111", fontWeight: 600 }}>Documents</a>
      </nav>

      {/* Sync section */}
      <div style={{
        padding: 16,
        backgroundColor: "#f9f9f9",
        borderRadius: 8,
        border: "1px solid #e5e5e5",
        marginBottom: 32,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <p style={{ fontWeight: 600, margin: 0 }}>Sync from Google Drive</p>
          <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>
            Detects new and modified files in your Drive contracts folder.
          </p>
        </div>
        <button
          onClick={runSync}
          disabled={syncing}
          style={{
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            backgroundColor: syncing ? "#999" : "#111",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: syncing ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div style={{
          padding: 16,
          backgroundColor: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          marginBottom: 24,
          fontSize: 13,
        }}>
          <p style={{ fontWeight: 600, margin: "0 0 8px" }}>Sync complete</p>
          <p style={{ margin: "2px 0" }}>✓ Added: {syncResult.added.length > 0 ? syncResult.added.join(", ") : "none"}</p>
          <p style={{ margin: "2px 0" }}>↻ Updated: {syncResult.updated.length > 0 ? syncResult.updated.join(", ") : "none"}</p>
          <p style={{ margin: "2px 0" }}>– Skipped: {syncResult.skipped.length > 0 ? syncResult.skipped.join(", ") : "none"}</p>
          {syncResult.errors.length > 0 && (
            <p style={{ margin: "2px 0", color: "#cc0000" }}>
              ✗ Errors: {syncResult.errors.map((e) => e.filename).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: 16,
          backgroundColor: "#fff0f0",
          border: "1px solid #ffcccc",
          borderRadius: 8,
          marginBottom: 24,
          color: "#cc0000",
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Documents table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e5e5", textAlign: "left" }}>
            <th style={{ padding: "8px 12px" }}>Filename</th>
            <th style={{ padding: "8px 12px" }}>Project</th>
            <th style={{ padding: "8px 12px" }}>Chunks</th>
            <th style={{ padding: "8px 12px" }}>Ingested</th>
            <th style={{ padding: "8px 12px" }}></th>
          </tr>
        </thead>
        <tbody>
          {documents.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: "24px 12px", color: "#999", textAlign: "center" }}>
                No documents ingested yet. Run a sync to get started.
              </td>
            </tr>
          )}
          {documents.map((doc) => (
            <tr key={doc.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "10px 12px", fontWeight: 500 }}>{doc.filename}</td>
              <td style={{ padding: "10px 12px", color: "#666" }}>{doc.project}</td>
              <td style={{ padding: "10px 12px", color: "#666" }}>{doc.chunk_count}</td>
              <td style={{ padding: "10px 12px", color: "#666" }}>
                {new Date(doc.ingested_at).toLocaleDateString()}
              </td>
              <td style={{ padding: "10px 12px" }}>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  disabled={deleting === doc.id}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    backgroundColor: "transparent",
                    color: deleting === doc.id ? "#999" : "#cc0000",
                    border: "1px solid",
                    borderColor: deleting === doc.id ? "#999" : "#cc0000",
                    borderRadius: 4,
                    cursor: deleting === doc.id ? "not-allowed" : "pointer",
                  }}
                >
                  {deleting === doc.id ? "Deleting..." : "Delete"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}