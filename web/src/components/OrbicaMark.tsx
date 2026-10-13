// The Orbica mark: a planet with an inclined orbit and one satellite on it.
// Inline SVG so it inherits currentColor and costs no request.
export function OrbicaMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <circle cx="16" cy="16" r="6.5" fill="currentColor" opacity="0.9" />
      <ellipse cx="16" cy="16" rx="14" ry="5.5" transform="rotate(-24 16 16)" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      <circle cx="28.8" cy="10.3" r="1.8" fill="currentColor" />
    </svg>
  );
}
