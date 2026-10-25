import { useEffect, useRef, type ReactNode } from 'react';
import './Common.css';

interface ModalProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/** Native <dialog> handles focus trapping, Escape and focus return. */
export function Modal({ label, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    // No close() in cleanup: unmounting removes the dialog, and close() would
    // fire a stray `close` event under StrictMode's double effect run.
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={label}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <button className="modal-close" onClick={onClose} aria-label="Close dialog">
        ×
      </button>
      {children}
    </dialog>
  );
}
