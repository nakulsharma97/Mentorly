import { useEffect, useRef, useState } from "react";

const COMMON_EMOJIS = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "🥰",
  "😎",
  "🤩",
  "😢",
  "😤",
  "😡",
  "🥺",
  "🤔",
  "🙄",
  "👍",
  "👎",
  "👏",
  "🙌",
  "🔥",
  "💯",
  "💪",
  "🎉",
  "❤️",
  "💔",
  "💀",
  "✅",
  "❌",
  "⭐",
  "🌈",
  "🍕",
  "☕",
  "🚀",
  "✨",
  "💡",
  "📚",
  "🎯",
  "🏆",
  "💼",
  "🤝",
];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * The message composer — attachments, emoji, code snippets and a quick-reply
 * friendly textarea. Enter sends, Shift+Enter adds a newline. There is
 * deliberately no voice recording: communication happens through scheduled
 * sessions.
 */
export default function MessageInput({
  value,
  onChange,
  onSend,
  onTyping,
  onFile,
  sending,
  uploading,
  placeholder = "Write a message…",
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const fileRef = useRef(null);
  const imageRef = useRef(null);
  const pdfRef = useRef(null);
  const codeRef = useRef(null);
  const emojiRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    if (!showEmoji) return undefined;
    const handler = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target))
        setShowEmoji(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmoji]);

  useEffect(() => {
    if (!mediaRecorder) return;
    const onData = (event) => {
      if (event.data && event.data.size > 0) {
        setRecordedChunks((prev) => [...prev, event.data]);
      }
    };
    const onStop = () => {
      setRecording(false);
    };
    mediaRecorder.addEventListener("dataavailable", onData);
    mediaRecorder.addEventListener("stop", onStop);
    return () => {
      mediaRecorder.removeEventListener("dataavailable", onData);
      mediaRecorder.removeEventListener("stop", onStop);
    };
  }, [mediaRecorder]);

  useEffect(() => {
    if (!recordedChunks.length || recording) return;
    const blob = new Blob(recordedChunks, { type: "audio/webm" });
    const file = new File([blob], `voice-${Date.now()}.webm`, {
      type: "audio/webm",
    });
    onFile?.(file);
    setRecordedChunks([]);
  }, [recordedChunks, recording, onFile]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !sending) onSend?.();
    } else {
      onTyping?.();
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      onFile?.({ error: "File must be 10 MB or smaller." });
      return;
    }
    onFile?.(file);
  };

  const insertGif = () => {
    // eslint-disable-next-line no-alert
    const url = window.prompt("Paste a GIF URL");
    if (!url) return;
    const trimmed = String(url).trim();
    if (!trimmed) return;
    onChange(`${value}${value ? "\n" : ""}🎞 ${trimmed}`);
  };

  const toggleRecording = async () => {
    if (recording && mediaRecorder) {
      mediaRecorder.stop();
      mediaRecorder.stream?.getTracks?.().forEach((t) => t.stop());
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      onFile?.({ error: "Voice recording is not supported in this browser." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      setMediaRecorder(recorder);
      setRecordedChunks([]);
      recorder.start();
      setRecording(true);
    } catch {
      onFile?.({ error: "Microphone access was denied." });
    }
  };

  // Wrap the current content (or selection) in a code fence.
  const insertCodeSnippet = () => {
    const el = taRef.current;
    if (!el) {
      onChange(
        `${value.trim() ? `${value}\n\n` : ""}\`\`\`\n// your code here\n\`\`\``,
      );
      return;
    }
    const { selectionStart, selectionEnd } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    const snippet = selected
      ? `\`\`\`\n${selected}\n\`\`\``
      : "```\n// your code here\n```";
    const next =
      value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart, selectionStart + snippet.length);
    });
  };

  const autoGrow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className="ms-composer-wrap">
      <form
        className="ms-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim() && !sending) onSend?.();
        }}
      >
        <input
          ref={fileRef}
          type="file"
          onChange={handleFile}
          hidden
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          ref={imageRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFile}
          hidden
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          ref={pdfRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
          onChange={handleFile}
          hidden
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          ref={codeRef}
          type="file"
          accept=".js,.jsx,.ts,.tsx,.java,.py,.json,.md,.txt,.xml,.yaml,.yml"
          onChange={handleFile}
          hidden
          aria-hidden="true"
          tabIndex={-1}
        />

        <button
          type="button"
          className="ms-icon-btn"
          title="Attach a file"
          aria-label="Attach a file"
          onClick={() => fileRef.current?.click()}
          disabled={Boolean(uploading)}
        >
          <span className="material-symbols-outlined">attach_file</span>
        </button>
        <button
          type="button"
          className="ms-icon-btn"
          title="Upload image or video"
          aria-label="Upload image or video"
          onClick={() => imageRef.current?.click()}
          disabled={Boolean(uploading)}
        >
          <span className="material-symbols-outlined">image</span>
        </button>
        <button
          type="button"
          className="ms-icon-btn"
          title="Upload document"
          aria-label="Upload document"
          onClick={() => pdfRef.current?.click()}
          disabled={Boolean(uploading)}
        >
          <span className="material-symbols-outlined">description</span>
        </button>

        <textarea
          ref={taRef}
          className="ms-composer__input"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            autoGrow();
          }}
          onKeyDown={handleKeyDown}
          onInput={autoGrow}
          placeholder={placeholder}
          aria-label="Write a message"
          rows={1}
        />

        <div className="ms-composer__actions" ref={emojiRef}>
          <button
            type="button"
            className="ms-icon-btn"
            title="Insert code snippet"
            aria-label="Insert code snippet"
            onClick={insertCodeSnippet}
            disabled={Boolean(uploading)}
          >
            <span className="material-symbols-outlined">code</span>
          </button>
          <button
            type="button"
            className="ms-icon-btn"
            title="Upload code file"
            aria-label="Upload code file"
            onClick={() => codeRef.current?.click()}
            disabled={Boolean(uploading)}
          >
            <span className="material-symbols-outlined">terminal</span>
          </button>
          <button
            type="button"
            className="ms-icon-btn"
            title="Insert GIF"
            aria-label="Insert GIF"
            onClick={insertGif}
            disabled={Boolean(uploading)}
          >
            <span className="material-symbols-outlined">gif_box</span>
          </button>
          <button
            type="button"
            className={`ms-icon-btn${recording ? " is-active" : ""}`}
            title={recording ? "Stop recording" : "Voice recording"}
            aria-label={recording ? "Stop recording" : "Voice recording"}
            onClick={toggleRecording}
            disabled={Boolean(uploading)}
          >
            <span className="material-symbols-outlined">
              {recording ? "stop_circle" : "mic"}
            </span>
          </button>
          <button
            type="button"
            className={`ms-icon-btn${showEmoji ? " is-active" : ""}`}
            title="Add emoji"
            aria-label="Add emoji"
            onClick={() => setShowEmoji((p) => !p)}
          >
            <span className="material-symbols-outlined">mood</span>
          </button>
          {showEmoji && (
            <div className="ms-emoji-picker">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="ms-emoji-btn"
                  onClick={() => {
                    onChange(value + emoji);
                    setShowEmoji(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="ms-btn ms-btn--primary ms-btn--send"
          disabled={!value.trim() || sending || Boolean(uploading)}
          aria-label="Send message"
        >
          <span className="material-symbols-outlined">send</span>
        </button>
      </form>

      {uploading && (
        <div className="ms-uploading">
          <span className="ms-uploading__spinner" />
          <span>
            {typeof uploading === "string" ? uploading : "Uploading…"}
          </span>
        </div>
      )}
    </div>
  );
}
