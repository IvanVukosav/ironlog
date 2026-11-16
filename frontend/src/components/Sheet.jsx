import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./Sheet.module.css";

/**
 * A panel that comes up from the bottom of a phone screen (a dialog in the middle of a wider one)
 * over the dimmed page. A tap on the page around it, or Escape, closes it through `onClose`.
 *
 * It is drawn into the body, so no card around the button that opened it (a blurred glass card
 * makes itself the frame of everything fixed inside it) can cut it short. Focus moves into it
 * and goes back to that button afterwards.
 */
function Sheet({ labelledBy, closeLabel, onClose, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  return createPortal(
    <div className={styles.overlay}>
      <button type="button" className={styles.scrim} aria-label={closeLabel} onClick={onClose} />
      <section
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          onClose();
        }}
      >
        <span className={styles.grabber} aria-hidden="true" />
        {children}
      </section>
    </div>,
    document.body,
  );
}

export default Sheet;
