import { useEffect, useRef, useState } from "react";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Minimal premium composer — Attach File, the message textarea, Voice
 * recording and Send. Enter sends, Shift+Enter adds a newline, and Send is
 * disabled while the message is empty. Everything else (GIFs, code snippets,
 * image/pdf shortcuts, emoji picker) has been removed for a clean, spacious
 * chat area.
 */
export default function MessageInput({
  value,
  onChange,
  onSend,
  onTyping,
  onFile,
  sending,
  uploading,
  placeholder = "Type your message...",
}) {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const fileRef = useRef(null);
  const taRef = useRef(null);

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

        <button
          type="button"
          className="ms-icon-btn ms-composer__attach"
          title="Attach a file"
          aria-label="Attach a file"
          onClick={() => fileRef.current?.click()}
          disabled={Boolean(uploading)}
        >
          <span className="material-symbols-outlined">attach_file</span>
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

        <div className="ms-composer__actions">
          <button
            type="button"
            className={`ms-icon-btn${recording ? " is-active" : ""}`}
            title={recording ? "Stop recording" : "Record audio"}
            aria-label={recording ? "Stop recording" : "Record audio"}
            onClick={toggleRecording}
            disabled={Boolean(uploading)}
          >
            <span className="material-symbols-outlined">
              {recording ? "stop_circle" : "mic"}
            </span>
          </button>
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
