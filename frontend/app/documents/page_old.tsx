"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Document {
  id: string;
  filename: string;
  project: string;
  chunk_count: number;
  ingested_at: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/sync/documents`)
      .then((res) => res.json())
      .then((data) => {
        setDocuments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      <h1>Documents</h1>

      <nav style={{ marginTop: 8, marginBottom: 32 }}>
        <a href="/" style={{ fontSize: 14, color: "#666", marginRight: 16 }}>Quick Question</a>
        <a href="/conversation" style={{ fontSize: 14, color: "#666", marginRight: 16 }}>Conversation Mode</a>
        <a href="/documents" style={{ fontSize: 14, color: "#111", fontWeight: 600 }}>Documents</a>
      </nav>

      <p style={{ color: "#666", fontSize: 14, marginBottom: 32 }}>
        Reference documents available for querying.
      </p>

      {loading ? (
        <p style={{ color: "#999" }}>Loading...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e5e5", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Filename</th>
              <th style={{ padding: "8px 12px" }}>Project</th>
              <th style={{ padding: "8px 12px" }}>Chunks</th>
              <th style={{ padding: "8px 12px" }}>Ingested</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "24px 12px", color: "#999", textAlign: "center" }}>
                  No documents available.
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}