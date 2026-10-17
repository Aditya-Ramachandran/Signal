type SignalMarkProps = {
  className?: string;
};

/** The app icon is the single source of truth for Signal's mark. */
export default function SignalMark({ className = 'mark' }: SignalMarkProps) {
  return <img className={className} src="/Signal/icon.svg" alt="" aria-hidden="true" />;
}
