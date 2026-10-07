/** A template is re-created on every navigation, so each page in the app fades in softly while the header stays put. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page">{children}</div>;
}
