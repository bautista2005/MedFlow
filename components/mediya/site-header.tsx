import { Logo } from "@/components/mediya/logo";

export function SiteHeader() {
  return (
    <header className="relative z-20">
      <div className="mx-auto flex w-full max-w-7xl items-center px-6 py-5 md:px-10 lg:px-12">
        <Logo />
      </div>
    </header>
  );
}
