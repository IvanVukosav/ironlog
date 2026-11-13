// Small stroke icons for controls, on a 24px grid and coloured by currentColor. Always decoration:
// the button around one carries the name (aria-label) a screen reader reads.
const ICONS = {
  // "⋯": more options.
  more: (
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  // Six dots: something to drag.
  grip: (
    <>
      <circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  flame: (
    <path d="M12 21a6 6 0 0 0 6-6c0-3-2-5.5-3.5-7.5-.3 1.8-1.2 3-2.5 3.5.3-2.8-.7-5.5-3-8 .2 3-1.4 5-2.6 6.8A7.6 7.6 0 0 0 6 15a6 6 0 0 0 6 6z" />
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  trophy: (
    <>
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 6h3v1.5A3.5 3.5 0 0 1 16.6 11M7 6H4v1.5A3.5 3.5 0 0 0 7.4 11" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

function Icon({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

export default Icon;
