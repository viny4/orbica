// Shell for all content pages (everything except the full-bleed landing page).
// Adds the centered container and clears the fixed header. The <main> landmark
// itself lives in the root layout.
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <div className="shell max-w-7xl pb-8 pt-24 sm:pt-28">{children}</div>;
}
