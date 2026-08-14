import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";

// Mount <LightboxProvider> once near the app root. Any page can then call
// useLightbox() to get an `open(images, startIndex)` function — click any
// chart screenshot anywhere in the site and it opens here, one click to
// zoom in, scroll/pinch or the buttons to zoom further, drag to pan.
const LightboxCtx = createContext(null);

export function LightboxProvider({ children }) {
  const [state, setState] = useState(null); // { images: string[], index: number }
  const open = useCallback((images, index = 0) => {
    if (!images || images.length === 0) return;
    setState({ images, index });
  }, []);
  const close = useCallback(() => setState(null), []);
  return (
    <LightboxCtx.Provider value={open}>
      {children}
      {state && (
        <LightboxModal
          images={state.images}
          index={state.index}
          onClose={close}
          onIndex={(i) => setState((s) => (s ? { ...s, index: i } : s))}
        />
      )}
    </LightboxCtx.Provider>
  );
}

export function useLightbox() {
  const ctx = useContext(LightboxCtx);
  // A route must never fail just because an older deployment is missing the
  // provider at the app root. This can happen briefly when the lazy-loaded
  // Trade View chunk is newer than the main app bundle. Images remain visible
  // on the page; only the optional zoom modal is unavailable until the next
  // complete deployment loads the provider.
  if (!ctx) {
    console.warn("Lightbox is unavailable because LightboxProvider is not mounted.");
    return () => {};
  }
  return ctx;
}

function LightboxModal({ images, index, onClose, onIndex }) {
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  useEffect(() => { setZoom(1); setPos({ x: 0, y: 0 }); }, [index]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndex(Math.min(index + 1, images.length - 1));
      else if (e.key === "ArrowLeft") onIndex(Math.max(index - 1, 0));
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 4));
      else if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onIndex]);

  const onWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.min(Math.max(z - e.deltaY * 0.0015, 1), 4));
  };
  const onMouseDown = (e) => { if (zoom > 1) dragRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; };
  const onMouseMove = (e) => { if (dragRef.current) setPos({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y }); };
  const stopDrag = () => { dragRef.current = null; };

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center touch-none"
      onClick={onClose}
      data-testid="image-lightbox"
    >
      <div className="absolute top-4 right-4 flex gap-2 z-10" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setZoom((z) => Math.max(z - 0.25, 1))} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" aria-label="Zoom out"><ZoomOut className="w-5 h-5" /></button>
        <button onClick={() => setZoom((z) => Math.min(z + 0.25, 4))} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" aria-label="Zoom in"><ZoomIn className="w-5 h-5" /></button>
        <button onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }); }} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" aria-label="Reset zoom"><RotateCcw className="w-5 h-5" /></button>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" aria-label="Close"><X className="w-5 h-5" /></button>
      </div>

      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); onIndex(Math.max(index - 1, 0)); }} disabled={index === 0} className="absolute left-3 sm:left-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center"><ChevronLeft className="w-6 h-6" /></button>
          <button onClick={(e) => { e.stopPropagation(); onIndex(Math.min(index + 1, images.length - 1)); }} disabled={index === images.length - 1} className="absolute right-3 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center"><ChevronRight className="w-6 h-6" /></button>
        </>
      )}

      <img
        src={images[index]}
        alt=""
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onDoubleClick={(e) => { e.stopPropagation(); setZoom((z) => (z > 1 ? 1 : 2)); setPos({ x: 0, y: 0 }); }}
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
          cursor: zoom > 1 ? "grab" : "zoom-in",
          maxWidth: "90vw",
          maxHeight: "85vh",
          transition: dragRef.current ? "none" : "transform 0.15s ease-out",
          userSelect: "none",
        }}
      />

      {images.length > 1 && (
        <div className="absolute bottom-4 text-white/60 text-xs tjfx-mono" onClick={(e) => e.stopPropagation()}>
          {index + 1} / {images.length} · double-click ya scroll se zoom
        </div>
      )}
    </div>
  );
}
