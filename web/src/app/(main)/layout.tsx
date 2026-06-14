// Shell for all content pages (everything except the full-bleed landing page).
// Adds the centered container and clears the fixed header.
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-6xl px-6 pt-28 pb-20">{children}</main>;
}
