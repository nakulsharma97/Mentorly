import { useMemo } from "react";

const EMPTY_CAPTIONS = "data:text/vtt,WEBVTT%0A";

/**
 * Renders an attachment message (file / voice) with inline preview:
 * images and audio inline, PDFs in a preview card, everything else as a
 * downloadable file chip.
 */
export default function AttachmentPreview({ attachment, content }) {
  const isImage = useMemo(() => {
    if (!attachment) return false;
    return /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(attachment.name) || /image\//i.test(attachment.name);
  }, [attachment]);

  const isAudio = useMemo(() => {
    if (!attachment) return false;
    return attachment.type === "voice" || /\.(webm|mp3|wav|ogg|m4a)(\?.*)?$/i.test(attachment.name);
  }, [attachment]);

  const isPdf = useMemo(() => {
    if (!attachment) return false;
    return /\.pdf(\?.*)?$/i.test(attachment.name);
  }, [attachment]);

  if (!attachment) return <span className="ms-bubble__text">{content}</span>;

  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="ms-attachment">
        <img className="ms-attachment__img" src={attachment.url} alt={attachment.name} />
        <span className="ms-attachment__name">{attachment.name}</span>
      </a>
    );
  }

  if (isAudio) {
    return (
      <div className="ms-attachment ms-attachment--audio">
        <span className="ms-attachment__file">
          <span className="material-symbols-outlined">mic</span>
          <strong>{attachment.name}</strong>
        </span>
        <audio controls src={attachment.url} preload="none" style={{ width: "100%", maxWidth: 260, height: 40 }}>
          <track kind="captions" srcLang="en" src={EMPTY_CAPTIONS} />
          Your browser does not support audio.
        </audio>
        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="ms-attachment__download">
          Open
        </a>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="ms-attachment ms-attachment--pdf">
        <span className="ms-attachment__file">
          <span className="material-symbols-outlined">picture_as_pdf</span>
          <span>
            <strong>{attachment.name}</strong>
            <em>PDF document</em>
          </span>
        </span>
        <div className="ms-attachment__actions">
          <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="ms-btn ms-btn--sm ms-btn--outline">
            Preview
          </a>
          <a href={attachment.url} download className="ms-btn ms-btn--sm ms-btn--outline">
            <span className="material-symbols-outlined">download</span>
            Download
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="ms-attachment ms-attachment--file">
      <span className="ms-attachment__file">
        <span className="material-symbols-outlined">attach_file</span>
        <strong>{attachment.name}</strong>
      </span>
      <a href={attachment.url} download className="ms-attachment__download">
        <span className="material-symbols-outlined">download</span>
        Download
      </a>
    </div>
  );
}
