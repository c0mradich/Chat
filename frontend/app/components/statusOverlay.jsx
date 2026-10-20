
import { useEffect, useState } from "react";

const FADE_DURATION = 5000; // 0.5 секунды

export default function StatusOverlay({ loading, error }) {
  const visible = loading || Boolean(error);

  const [mounted, setMounted] = useState(visible);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setFading(false);
      return;
    }

    if (!mounted) return;
    
    const frame = requestAnimationFrame(() => {
      setFading(true);
    });

    const timer = setTimeout(() => {
      setMounted(false);
      setFading(false);
    }, FADE_DURATION);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [visible, mounted]);

  if (!mounted) return null;


    return (
    <div className={`status-overlay ${fading ? "fade-out" : ""}`}>
        {loading ? (
        <div className="status-card loading-card">
            <div className="loader" />
            <div className="status-title">Loading...</div>
            <div className="status-description">
            Please wait a moment
            </div>
        </div>
        ) : error ? (
        <div className="status-card error-card">
            <div className="error-icon">!</div>
            <div className="status-title">Something went wrong</div>
            <div className="status-description">{error}</div>
        </div>
        ) : null}
    </div>
    );
}
