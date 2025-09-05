// frontend/components/ChatWindow.tsx
'use client';
import React, { useState, useRef } from 'react';

type Msg = { role: 'user' | 'assistant' | 'system'; text: string };

export default function ChatWindow() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function appendMessage(m: Msg) {
    setMessages((prev) => [...prev, m]);
  }

  async function send() {
    if (!input.trim()) return;
    const userText = input.trim();
    appendMessage({ role: 'user', text: userText });
    setInput('');
    setStreaming(true);

    // POST to the existing chat API (keeps original behavior)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, threadId: 'default-thread' }),
      });
      if (!res.ok) throw new Error('chat failed');
      const data = await res.json();
      appendMessage({ role: 'assistant', text: data.answer ?? 'No answer' });
    } catch (err) {
      appendMessage({
        role: 'assistant',
        text: 'Error: ' + (err as Error).message,
      });
    } finally {
      setStreaming(false);
    }
  }

  function downloadChat() {
    const md = messages
      .map((m) => `**${m.role.toUpperCase()}**\n\n${m.text}`)
      .join('\n\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdf-chat-${new Date().toISOString()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="chat-wrapper">
      <div className="chat-controls">
        <button onClick={downloadChat} className="download-btn">
          Download chat
        </button>
      </div>

      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <div className="bubble">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="composer">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder="Ask a question..."
        />
        <button onClick={send} disabled={streaming || !input.trim()}>
          {streaming ? 'Thinking…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
