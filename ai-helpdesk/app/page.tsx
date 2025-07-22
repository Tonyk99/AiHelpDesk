import React, { useRef, useState } from "react";
import styles from "./page.module.css";

interface Message {
  sender: "user" | "ai";
  text: string;
  imageUrl?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!input && !image) return;
    const newMsg: Message = {
      sender: "user",
      text: input,
      imageUrl: image ? URL.createObjectURL(image) : undefined,
    };
    setMessages((msgs) => [...msgs, newMsg]);
    setInput("");
    setImage(null);
    setIsLoading(true);

    if (image) {
      // Send to /api/vision
      const formData = new FormData();
      formData.append("image", image);
      formData.append("prompt", input || "Please help me with this issue.");
      try {
        const res = await fetch("/api/vision", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        setMessages((msgs) => [
          ...msgs,
          {
            sender: "ai",
            text: data.result || data.error || "Sorry, I couldn't analyze the screenshot.",
          },
        ]);
      } catch (err: any) {
        setMessages((msgs) => [
          ...msgs,
          {
            sender: "ai",
            text: "Sorry, there was an error analyzing your screenshot.",
          },
        ]);
      }
      setIsLoading(false);
      return;
    }
    // Placeholder for chat-only (no image) response
    setTimeout(() => {
      setMessages((msgs) => [
        ...msgs,
        {
          sender: "ai",
          text: `AI: (Chat response to "${input}")`,
        },
      ]);
      setIsLoading(false);
    }, 1500);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>AI Helpdesk</h1>
        <p style={{ fontSize: 18, marginBottom: 24 }}>
          Describe your problem or upload a screenshot. Our AI will help you step by step.
        </p>
        <div style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--gray-alpha-100)",
          borderRadius: 16,
          padding: 16,
          minHeight: 320,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          <div style={{ flex: 1, overflowY: "auto", marginBottom: 8 }}>
            {messages.length === 0 && (
              <div style={{ color: "#888", textAlign: "center", marginTop: 32 }}>
                Start by typing your issue or uploading a screenshot.
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: msg.sender === "user" ? "row-reverse" : "row",
                  alignItems: "flex-end",
                  marginBottom: 8,
                  gap: 8,
                }}
              >
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="User screenshot"
                    className={styles.imagePreview}
                  />
                )}
                <div
                  className={
                    styles.chatBubble +
                    " " +
                    (msg.sender === "user" ? styles.chatBubbleUser : styles.chatBubbleAI)
                  }
                  title={msg.sender === "user" ? "You" : "AI Assistant"}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ color: "#888", textAlign: "center", marginTop: 16 }}>
                AI is thinking...
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your issue..."
              className={styles.input}
              disabled={isLoading}
              title="Type your problem here"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={styles.bigButton}
              style={{ background: "#f3f4f6", color: "#222", border: "1px solid #ccc" }}
              title="Upload a screenshot"
              disabled={isLoading}
            >
              📷 Screenshot
            </button>
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              ref={fileInputRef}
              onChange={handleImageChange}
              title="Choose a screenshot to upload"
            />
            <button
              onClick={handleSend}
              className={styles.bigButton}
              disabled={isLoading || (!input && !image)}
              title="Send your message or screenshot"
            >
              Send
            </button>
          </div>
          {image && (
            <div style={{ marginTop: 8, fontSize: 15, color: "#444" }}>
              <b>Selected image:</b> {image.name}
              <button
                onClick={() => setImage(null)}
                style={{ marginLeft: 12, color: "#c00", background: "none", border: "none", cursor: "pointer", fontSize: 15 }}
                title="Remove selected image"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </main>
      <footer className={styles.footer}>
        <span style={{ fontSize: 16 }}>AI Helpdesk &copy; {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
