
"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  ArrowUp,
  BrainCircuit,
  Check,
  ChevronRight,
  Menu,
  MessageSquare,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
} from "lucide-react";
import {
  AI_PROVIDERS,
  type ProviderId,
} from "@/lib/ai/providers";

type SpeechResult = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionErrorEvent = {
  error: string;
  message?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;

  onresult: ((event: SpeechResult) => void) | null;

  onerror:
    | ((event: SpeechRecognitionErrorEvent) => void)
    | null;

  onend: (() => void) | null;

  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const prompts = [
  "Help me plan a new project",
  "Explain how AI agents work",
  "Write a React component",
  "What can JARVIS do?",
];

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const [provider, setProvider] =
    useState<ProviderId>("gemini");

  const [model, setModel] =
    useState<string>("gemini-3.1-flash-lite");

  const [providerKeys, setProviderKeys] =
    useState<Partial<Record<ProviderId, string>>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const messagesRef = useRef<Message[]>([]);
  const busyRef = useRef(false);

  const conversationProviderRef =
    useRef<ProviderId | null>(null);

  const conversationModelRef =
    useRef<string | null>(null);

  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  const recognitionRef =
    useRef<SpeechRecognitionLike | null>(null);

  const conversationEndRef =
    useRef<HTMLDivElement | null>(null);

  const voiceEnabledRef = useRef(false);

  const apiKey = providerKeys[provider] ?? "";
  const providerConfig = AI_PROVIDERS[provider];

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  function stopSpeech() {
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
    }

    setSpeaking(false);
  }

  function speakReply(reply: string) {
    if (
      !voiceEnabledRef.current ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    stopSpeech();

    const plainText = reply
      .replace(/[`*_#>~\[\]]/g, "")
      .replace(/\((https?:\/\/[^)]+)\)/g, "");

    const utterance = new SpeechSynthesisUtterance(
      plainText
    );

    utterance.rate = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function toggleVoice() {
    if (voiceEnabled) {
      stopSpeech();
    }

    voiceEnabledRef.current = !voiceEnabled;
    setVoiceEnabled(!voiceEnabled);
  }

  function toggleMicrophone() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const speechWindow = window as SpeechWindow;

    const Recognition =
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setVoiceError(
        "Speech recognition is not supported in this browser. Try Chrome or Edge."
      );
      return;
    }

    setVoiceError("");

    try {
      const recognition = new Recognition();

      recognition.lang = navigator.language || "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")
          .trim();

        if (transcript) {
          setInput((previous) =>
            previous
              ? `${previous} ${transcript}`
              : transcript
          );
        }
      };

      recognition.onerror = (event) => {
  setListening(false);

const errorCode = event.error;

  const messages: Record<string, string> = {
    "not-allowed":
      "Microphone access was blocked. Check browser permissions.",

    "service-not-allowed":
      "Speech recognition service is unavailable or blocked.",

    "no-speech":
      "No speech detected. Try speaking closer to your microphone.",

    "audio-capture":
      "No working microphone detected. Check your Windows microphone settings.",

    "network":
      "Speech recognition network error. Check your internet connection.",

    "aborted":
      "Speech recognition was stopped.",

    "language-not-supported":
      "Your selected language is not supported.",
  };

  setVoiceError(
    messages[errorCode ?? ""] ??
      `Speech recognition failed: ${errorCode ?? "unknown error"}`
  );
};

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();

      setListening(true);
    } catch {
      setListening(false);
      setVoiceError(
        "Could not start microphone. Check browser permissions."
      );
    }
  }

  function changeProvider(nextProvider: ProviderId) {
    if (busyRef.current) return;

    setProvider(nextProvider);

    setModel(
      Object.keys(
        AI_PROVIDERS[nextProvider].models
      )[0]
    );

    setError("");
    messagesRef.current = [];
    setMessages([]);

    conversationProviderRef.current = null;
    conversationModelRef.current = null;
  }

  function changeModel(nextModel: string) {
    if (busyRef.current) return;

    setModel(nextModel);
    setError("");

    messagesRef.current = [];
    setMessages([]);

    conversationProviderRef.current = null;
    conversationModelRef.current = null;
  }

  function newChat() {
    requestIdRef.current += 1;

    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;

    setLoading(false);

    messagesRef.current = [];
    setMessages([]);

    conversationProviderRef.current = null;
    conversationModelRef.current = null;

    setInput("");
    setError("");
    setSidebarOpen(false);

    recognitionRef.current?.stop();
    setListening(false);

    stopSpeech();
  }

  async function sendMessage(text = input) {
    const content = text.trim();

    if (!content || busyRef.current) return;

    if (!apiKey.trim()) {
      setError(
        `Enter your ${providerConfig.name} API key in Settings.`
      );

      setSettingsOpen(true);
      return;
    }

    busyRef.current = true;

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    abortRef.current = controller;

    const sameConversation =
      conversationProviderRef.current === provider &&
      conversationModelRef.current === model;

    const previous = sameConversation
      ? messagesRef.current
      : [];

    const nextMessages: Message[] = [
      ...previous,
      {
        id: crypto.randomUUID(),
        role: "user",
        content,
      },
    ];

    conversationProviderRef.current = provider;
    conversationModelRef.current = model;

    messagesRef.current = nextMessages;

    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        signal: controller.signal,

        body: JSON.stringify({
          provider,
          model,
          apiKey: apiKey.trim(),

          messages: nextMessages.map(
            ({ role, content: messageContent }) => ({
              role,
              content: messageContent,
            })
          ),
        }),
      });

      const data: unknown = await response.json();

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!data || typeof data !== "object") {
        throw new Error("Invalid server response.");
      }

      const result = data as {
        reply?: unknown;
        error?: unknown;
      };

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "AI request failed."
        );
      }

      if (
        typeof result.reply !== "string" ||
        !result.reply.trim()
      ) {
        throw new Error(
          "The AI returned an empty reply."
        );
      }

      const updated: Message[] = [
        ...nextMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.reply,
        },
      ];

      messagesRef.current = updated;
      setMessages(updated);

      speakReply(result.reply);
    } catch (caught) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (
        caught instanceof Error &&
        caught.name === "AbortError"
      ) {
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong."
      );
    } finally {
      if (requestId === requestIdRef.current) {
        busyRef.current = false;
        abortRef.current = null;

        setLoading(false);
      }
    }
  }

  return (
    <div className="jarvis-app">
      {sidebarOpen && (
        <button
          className="mobile-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={`sidebar ${
          sidebarOpen ? "is-open" : ""
        }`}
      >
        <div className="brand">
          <div className="brand-icon">
            <BrainCircuit
              size={23}
              strokeWidth={1.6}
            />
          </div>

          <div className="brand-copy">
            <strong>JARVIS</strong>
            <span>INTELLIGENCE SYSTEM</span>
          </div>

          <button
            className="icon-button sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <button
          className="new-chat-button"
          onClick={newChat}
        >
          <Plus size={18} />
          <span>New conversation</span>
          <ChevronRight size={16} />
        </button>

        <div className="nav-heading">
          WORKSPACE
        </div>

        <nav className="navigation">
          <button
            className="nav-link active"
            aria-current="page"
          >
            <MessageSquare size={18} />
            <span>AI Assistant</span>
            <span className="nav-active-dot" />
          </button>

          <button
            className="nav-link"
            onClick={() => {
              setSettingsOpen(true);
              setSidebarOpen(false);
            }}
          >
            <Settings2 size={18} />
            <span>Configuration</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <div className="system-status">
          <div className="status-heading">
            <Activity size={16} />
            <strong>System status</strong>
            <span className="online-dot" />
          </div>

          <p>Interface operational</p>

          <div className="status-detail">
            <span>AI connection</span>
            <span>
              {apiKey.trim()
                ? "Key entered"
                : "Not configured"}
            </span>
          </div>
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar">
            J
          </div>

          <div>
            <strong>Local Workspace</strong>
            <span>Development preview</span>
          </div>

          <ShieldCheck size={17} />
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button menu-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>

            <span className="breadcrumb">
              Workspace
            </span>

            <span className="breadcrumb-divider">
              /
            </span>

            <strong>AI Assistant</strong>
          </div>

          <div className="topbar-actions">
            <div className="preview-indicator">
              <span />
              JARVIS AI
            </div>

            <button
              className="settings-button"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={17} />
              <span>Settings</span>
            </button>
          </div>
        </header>

        <section className="workspace">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div
                className="orb-container"
                aria-hidden="true"
              >
                <div className="orb-orbit orbit-one" />
                <div className="orb-orbit orbit-two" />
                <div className="orb-orbit orbit-three" />

                <div className="orb-core">
                  <div className="orb-core-inner" />
                </div>
              </div>

              <div className="eyebrow">
                <span />
                PERSONAL INTELLIGENCE
                <span />
              </div>

              <h1>
                Intelligence,{" "}
                <em>at your command.</em>
              </h1>

              <p className="welcome-description">
                A personal workspace for ideas,
                development, research, and
                productivity. What would you like
                to work on today?
              </p>

              <div className="prompt-grid">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() =>
                      void sendMessage(prompt)
                    }
                    className="prompt-card"
                    disabled={loading}
                  >
                    <Sparkles size={16} />
                    <span>{prompt}</span>
                    <ArrowUp size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="conversation">
              <div className="conversation-header">
                <div className="conversation-heading-icon">
                  <MessageSquare size={18} />
                </div>

                <div>
                  <h2>Current conversation</h2>
                  <p>
                    JARVIS · {providerConfig.name}
                  </p>
                </div>
              </div>

              {messages.map((message) => (
                <div
                  className="message"
                  key={message.id}
                >
                  <div className="message-avatar">
                    {message.role === "user"
                      ? "U"
                      : "J"}
                  </div>

                  <div className="message-body">
                    <strong>
                      {message.role === "user"
                        ? "You"
                        : "JARVIS"}
                    </strong>

                    <div className="message-markdown">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        skipHtml
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}

              <div
                ref={conversationEndRef}
                aria-hidden="true"
              />
            </div>
          )}
        </section>

        <div className="composer-area">
          {error && (
            <div
              className="chat-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {voiceError && (
            <div
              className="chat-error"
              role="alert"
            >
              {voiceError}
            </div>
          )}

          {loading && (
            <p
              className="chat-loading"
              role="status"
            >
              JARVIS is thinking...
            </p>
          )}

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <textarea
              placeholder="Ask JARVIS anything..."
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              rows={2}
              aria-label="Message JARVIS"
              disabled={loading}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />

            <div className="composer-footer">
              <div className="model-indicator">
                <BrainCircuit size={16} />
                <span>
                  {apiKey.trim()
                    ? `${providerConfig.name} · ${model}`
                    : "AI not configured"}
                </span>
              </div>

              <div className="voice-actions">
                <button
                  type="button"
                  className={`voice-button ${
                    listening ? "is-active" : ""
                  }`}
                  onClick={toggleMicrophone}
                  disabled={loading}
                  aria-label={
                    listening
                      ? "Stop listening"
                      : "Start microphone"
                  }
                  title={
                    listening
                      ? "Stop listening"
                      : "Speak to JARVIS"
                  }
                >
                  {listening ? (
                    <MicOff size={18} />
                  ) : (
                    <Mic size={18} />
                  )}
                </button>

                <button
                  type="button"
                  className={`voice-button ${
                    voiceEnabled ? "is-active" : ""
                  }`}
                  onClick={toggleVoice}
                  aria-label={
                    voiceEnabled
                      ? "Turn off spoken replies"
                      : "Turn on spoken replies"
                  }
                  title={
                    voiceEnabled
                      ? "Spoken replies on"
                      : "Spoken replies off"
                  }
                >
                  {voiceEnabled ? (
                    <Volume2 size={18} />
                  ) : (
                    <VolumeX size={18} />
                  )}
                </button>

                {speaking && (
                  <button
                    type="button"
                    className="voice-button"
                    onClick={stopSpeech}
                    aria-label="Stop speaking"
                    title="Stop speaking"
                  >
                    <Square size={16} />
                  </button>
                )}

                <button
                  type="submit"
                  className="send-button"
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                >
                  <ArrowUp size={19} />
                </button>
              </div>
            </div>
          </form>

          <p className="composer-note">
            {listening
              ? "Listening… speak now, then review your text before sending"
              : "Microphone requires browser permission · Voice replies are optional · API keys are not saved"}
          </p>
        </div>
      </main>

      {settingsOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSettingsOpen(false);
            }
          }}
        >
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <div className="modal-heading">
              <div>
                <span>WORKSPACE SETTINGS</span>
                <h2 id="settings-title">
                  Configuration
                </h2>
              </div>

              <button
                className="icon-button"
                onClick={() =>
                  setSettingsOpen(false)
                }
                aria-label="Close settings"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-content">
              <div className="configuration-icon">
                <BrainCircuit size={23} />
              </div>

              <h3>AI provider configuration</h3>

              <p>
                Choose your preferred AI provider
                and connect your own API key.
              </p>

              <div className="ai-settings">
                <label htmlFor="ai-provider">
                  AI Provider
                </label>

                <select
                  id="ai-provider"
                  value={provider}
                  disabled={loading}
                  onChange={(event) =>
                    changeProvider(
                      event.target.value as ProviderId
                    )
                  }
                >
                  {Object.entries(AI_PROVIDERS).map(
                    ([id, config]) => (
                      <option key={id} value={id}>
                        {config.name}
                      </option>
                    )
                  )}
                </select>

                <label htmlFor="ai-model">
                  AI Model
                </label>

                <select
                  id="ai-model"
                  value={model}
                  disabled={loading}
                  onChange={(event) =>
                    changeModel(event.target.value)
                  }
                >
                  {Object.entries(
                    providerConfig.models
                  ).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>

                <label htmlFor="api-key">
                  {providerConfig.name} API Key
                </label>

                <input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(event) =>
                    setProviderKeys((previous) => ({
                      ...previous,
                      [provider]: event.target.value,
                    }))
                  }
                  placeholder="Enter your provider API key"
                  autoComplete="off"
                  spellCheck={false}
                />

                <p className="api-key-note">
                  Keys stay in browser memory for
                  this session. They are sent to
                  your Next.js server for AI
                  requests and are not saved to
                  local storage or a database.
                </p>

                <div className="configuration-status">
                  <span>Selected provider</span>
                  <strong>
                    {providerConfig.name}
                  </strong>
                </div>

                <div className="configuration-status">
                  <span>Connection setup</span>
                  <strong>
                    {apiKey.trim()
                      ? "Key entered"
                      : "Not configured"}
                  </strong>
                </div>
              </div>

              <div className="configuration-info">
                <ShieldCheck size={18} />

                <span>
                  Private accounts and secure API
                  key storage must be added before
                  public release.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <span>
                <Check size={15} />
                Interface ready
              </span>

              <button
                onClick={() =>
                  setSettingsOpen(false)
                }
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
