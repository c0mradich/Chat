
import { useState, useEffect } from "react";
import "./Lightbox.css";

export default function Lightbox({ src, alt = "Photo" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  function openLightbox() {
    setIsZoomed(false);
    setIsOpen(true);
  }

  function closeLightbox() {
    setIsOpen(false);
    setIsZoomed(false);
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeLightbox();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className="gallery-image"
        onClick={openLightbox}
      />

      {isOpen && (

<div className="lightbox" onClick={closeLightbox}>
    <button
      className="lightbox-close"
      onClick={(event) => {
        event.stopPropagation();
        closeLightbox();
      }}
      aria-label="Close image"
    >
      &times;
    </button>

    <div
      className="lightbox-viewport"
      onClick={(event) => event.stopPropagation()}
    >
      <img
        src={src}
        alt={alt}
        className={`lightbox-image ${isZoomed ? "zoomed" : ""}`}
        onClick={() => setIsZoomed((prev) => !prev)}
      />
    </div>
  </div>
      )}
    </>
  );
}
