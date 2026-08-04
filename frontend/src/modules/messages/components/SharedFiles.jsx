import { useMemo } from "react";

export default function SharedFiles({ conversation }) {
  const sharedFiles = useMemo(() => {
    return (conversation?.messages || [])
      .filter((m) => String(m.content || "").startsWith("📎 "))
      .map((m, i) => {
        const name = String(m.content || "")
          .split("\n")[0]
          .replace("📎 ", "");
        const url = String(m.content || "")
          .split("\n")
          .slice(1)
          .join("\n")
          .trim();
        return {
          id: m.id ?? i,
          name,
          url,
        };
      });
  }, [conversation]);

  if (sharedFiles.length === 0) {
    return (
      <div className="ms-shared-files-empty">
        <span className="material-symbols-outlined">folder_open</span>
        <p>No shared files yet</p>
      </div>
    );
  }

  return (
    <div className="ms-details__block ms-shared-files">
      <p className="ms-details__label">Shared Files ({sharedFiles.length})</p>
      <div className="ms-details__files">
        {sharedFiles.slice(0, 5).map((file) => (
          <a
            key={file.id}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-details__file ms-shared-file-item"
            title={file.name}
          >
            <span className="material-symbols-outlined">description</span>
            <span className="ms-shared-file-item__name">{file.name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
