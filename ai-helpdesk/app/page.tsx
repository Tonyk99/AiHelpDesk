import React, { useRef, useState, useEffect } from "react";
import styles from "./page.module.css";

interface Message {
  sender: "user" | "ai";
  text: string;
  imageUrl?: string;
}

// For OpenAI API
interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatHistory, setChatHistory] = useState<OpenAIMessage[]>([
    {
      role: "system",
      content:
        "You are a helpful IT support assistant for non-technical users. Explain things simply and step by step.",
    },
  ]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem("ai-helpdesk-messages");
    const savedChatHistory = localStorage.getItem("ai-helpdesk-chatHistory");
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
    if (savedChatHistory) {
      setChatHistory(JSON.parse(savedChatHistory));
    }
  }, []);

  // Save to localStorage after each change
  useEffect(() => {
    localStorage.setItem("ai-helpdesk-messages", JSON.stringify(messages));
  }, [messages]);
  useEffect(() => {
    localStorage.setItem("ai-helpdesk-chatHistory", JSON.stringify(chatHistory));
  }, [chatHistory]);

  // Clear chat handler
  const handleClearChat = () => {
    setMessages([]);
    setChatHistory([
      {
        role: "system",
        content:
          "You are a helpful IT support assistant for non-technical users. Explain things simply and step by step.",
      },
    ]);
    localStorage.removeItem("ai-helpdesk-messages");
    localStorage.removeItem("ai-helpdesk-chatHistory");
  };

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

    // Text-only chat: send to /api/chat with history
    const newHistory = [
      ...chatHistory,
      { role: "user", content: input },
    ];
    setChatHistory(newHistory);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }),
      });
      const data = await res.json();
      setMessages((msgs) => [
        ...msgs,
        {
          sender: "ai",
          text: data.result || data.error || "Sorry, I couldn't generate a response.",
        },
      ]);
      setChatHistory([
        ...newHistory,
        { role: "assistant", content: data.result || "" },
      ]);
    } catch (err: any) {
      setMessages((msgs) => [
        ...msgs,
        {
          sender: "ai",
          text: "Sorry, there was an error getting a response from the AI.",
        },
      ]);
    }
    setIsLoading(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  // Screen sharing logic
  const handleStartScreenShare = async () => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
      setScreenStream(stream);
      setIsScreenSharing(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      // Stop sharing if user closes the share dialog
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        handleStopScreenShare();
      });
    } catch (err) {
      // User cancelled or error
    }
  };

  const handleStopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Optional: Capture screenshot from screen share
  const handleCaptureScreenShotFromStream = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setIsLoading(true);
      setMessages((msgs) => [
        ...msgs,
        {
          sender: "user",
          text: input || "(Screenshot from screen share)",
          imageUrl: URL.createObjectURL(blob),
        },
      ]);
      // Send to /api/vision
      const formData = new FormData();
      formData.append("image", blob, "screenshot.png");
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
    }, "image/png");
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>AI Helpdesk</h1>
        <p style={{ fontSize: 18, marginBottom: 24 }}>
          Describe your problem or upload a screenshot. Our AI will help you step by step.
        </p>
        <div style={{ marginBottom: 12 }}>
          <button
            className={styles.bigButton}
            style={{ background: "#f59e42", color: "#222" }}
            onClick={handleClearChat}
            title="Clear the chat and start over"
            disabled={isLoading}
          >
            🗑️ Clear Chat
          </button>
        </div>
        {/* Screen sharing controls */}
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          {!isScreenSharing && (
            <button
              className={styles.bigButton}
              style={{ background: "#10b981" }}
              onClick={handleStartScreenShare}
              title="Share your screen with the AI assistant"
            >
              🖥️ Share My Screen
            </button>
          )}
          {isScreenSharing && (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                style={{ width: 160, height: 100, borderRadius: 8, border: "2px solid #6366f1", background: "#222" }}
                aria-label="Screen share preview"
              />
              <button
                className={styles.bigButton}
                style={{ background: "#ef4444" }}
                onClick={handleStopScreenShare}
                title="Stop sharing your screen"
              >
                ✖️ Stop Sharing
              </button>
              <button
                className={styles.bigButton}
                style={{ background: "#6366f1" }}
                onClick={handleCaptureScreenShotFromStream}
                title="Capture a screenshot from your shared screen and send to AI"
                disabled={isLoading}
              >
                📸 Capture Screenshot from Shared Screen
              </button>
            </>
          )}
        </div>
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
            {isLoading && !image && (
              <div style={{ color: "#888", textAlign: "center", marginTop: 16 }}>
                <span aria-live="polite">AI is thinking...</span>
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
