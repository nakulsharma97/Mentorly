import { useEffect, useState } from "react";

/**
 * Private mentor notes — soft yellow card, editable, persisted per-student in
 * localStorage (no backend round-trip required).
 */
export default function MentorNotes({ studentId }) {
  const noteKey = `mentor_student_note_${studentId}`;
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNote(localStorage.getItem(noteKey) || "");
    setSaved(false);
  }, [noteKey]);

  const save = () => {
    localStorage.setItem(noteKey, note);
    setSaved(true);
  };

  return (
    <div className="ss-notes">
      <div className="ss-notes__head">
        <span className="material-symbols-outlined">edit_note</span>
        Mentor notes
      </div>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        placeholder="Add private notes about this learner…"
        aria-label="Private notes about this learner"
      />
      <button type="button" className="ss-notes__save" onClick={save}>
        <span className="material-symbols-outlined">{saved ? "check" : "save"}</span>
        {saved ? "Saved" : "Save note"}
      </button>
    </div>
  );
}
