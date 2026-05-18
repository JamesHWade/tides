import { useEffect, useRef } from "react";
import type { WildlifeNote, WildlifeKind } from "../data/wildlife";
import type { WikiImage } from "../utils/wikipediaImages";

type Props = {
  note: WildlifeNote;
  image: WikiImage | null;
  kindEmoji: string;
  onClose: () => void;
};

const KIND_LABEL: Record<WildlifeKind, string> = {
  bird: "Bird",
  reptile: "Reptile",
  mammal: "Mammal",
  marineMammal: "Marine mammal",
  fish: "Fish",
  insect: "Insect",
};

export function WildlifeModal({ note, image, kindEmoji, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // Open as a real modal so the browser handles focus trap, ESC, and the
  // top-layer rendering. showModal() throws if already open, so guard it.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (!el.open) {
      try {
        el.showModal();
      } catch {
        // Fallback for older browsers without <dialog> support.
        el.setAttribute("open", "");
      }
    }
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  // Click on the backdrop (outside the inner card) closes.
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  const heroSrc = image?.originalImage ?? image?.thumbnail ?? null;

  return (
    <dialog
      ref={dialogRef}
      className="wildlife-modal"
      aria-labelledby={`wildlife-modal-title-${note.id}`}
      onClick={handleBackdropClick}
    >
      <div className="wildlife-modal__card">
        <button
          type="button"
          className="wildlife-modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        {heroSrc ? (
          <figure className="wildlife-modal__figure">
            <img
              src={heroSrc}
              alt={`Photo of ${note.title}`}
              className="wildlife-modal__image"
              loading="lazy"
            />
            <figcaption className="wildlife-modal__caption">
              Image &amp; description via{" "}
              <a href={image?.pageUrl} target="_blank" rel="noreferrer">
                Wikipedia
              </a>{" "}
              (CC BY-SA). Open the article for full author / license details.
            </figcaption>
          </figure>
        ) : (
          <div className="wildlife-modal__no-image">
            <span aria-hidden="true">📷</span>
            <p>No photo cached for this species yet.</p>
          </div>
        )}

        <header className="wildlife-modal__head">
          <span className="wildlife-modal__kind">
            <span aria-hidden="true">{kindEmoji}</span> {KIND_LABEL[note.kind]}
          </span>
          <h3
            id={`wildlife-modal-title-${note.id}`}
            className="wildlife-modal__title"
          >
            {note.title}
          </h3>
        </header>

        <p className="wildlife-modal__blurb">{note.blurb}</p>

        {note.where && (
          <p className="wildlife-modal__where">
            <strong>Where to look:</strong> {note.where}
          </p>
        )}

        {image?.extract && (
          <p className="wildlife-modal__extract">{image.extract}</p>
        )}

        <p className="wildlife-modal__source">
          Trip-guide source:{" "}
          <a href={note.sourceUrl} target="_blank" rel="noreferrer">
            {note.sourceLabel}
          </a>
        </p>
      </div>
    </dialog>
  );
}
