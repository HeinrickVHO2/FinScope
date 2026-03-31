import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";

type FinScopeHeaderProps = {
  backHref?: string;
  backLabel?: string;
  landingMode?: boolean;
};

const publicLinks = [
  { href: "/recursos", label: "Recursos" },
  { href: "/faq", label: "FAQ" },
  { href: "/sobre", label: "Sobre" },
  { href: "/blog", label: "Blog" },
  { href: "/contato", label: "Contato" },
] as const;

const landingLinks = [
  { href: "#como-funciona", label: "Solução" },
  { href: "#prova", label: "Como funciona" },
  { href: "#planos", label: "Planos" },
] as const;

export function FinScopeHeader({ backHref, backLabel = "Voltar", landingMode = false }: FinScopeHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isLoading, logout } = useAuth();
  const showBackLink = Boolean(backHref);
  const homeHref = user ? "/dashboard" : "/";
  const primaryHref = user ? "/dashboard" : "/signup";
  const primaryLabel = user ? "Abrir painel" : "Começar agora";

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleLogout = async () => {
    closeMobileMenu();
    await logout();
  };

  const renderAuthActions = (mobile = false) => {
    if (isLoading) return null;

    if (user) {
      return (
        <>
          <Link href="/dashboard">
            <Button
              variant={mobile ? "default" : "outline"}
              className={mobile ? "w-full justify-start" : undefined}
              onClick={mobile ? closeMobileMenu : undefined}
            >
              Painel
            </Button>
          </Link>
          <Button
            type="button"
            variant="ghost"
            className={mobile ? "w-full justify-start" : undefined}
            onClick={handleLogout}
          >
            Sair
          </Button>
        </>
      );
    }

    return (
      <>
        <Link href="/login">
          <Button
            variant="ghost"
            className={mobile ? "w-full justify-start" : "text-slate-700"}
            onClick={mobile ? closeMobileMenu : undefined}
          >
            Já tenho conta
          </Button>
        </Link>
        <Link href={primaryHref}>
          <Button className={mobile ? "w-full justify-start" : "rounded-xl bg-slate-950 text-white hover:bg-slate-900"} onClick={mobile ? closeMobileMenu : undefined}>
            {primaryLabel}
          </Button>
        </Link>
      </>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/85 shadow-sm backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {showBackLink ? (
            <Link href={backHref!}>
              <Button variant="ghost" size="sm" className="text-slate-700 hover:text-primary">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Button>
            </Link>
          ) : null}

          <Link href={homeHref}>
            <div className="flex cursor-pointer items-center gap-3">
              <img src="/logo.png" alt="FinScope" className="h-12 w-auto" />
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex">
          {landingMode ? (
            <>
              {landingLinks.map((item) => (
                <a key={item.href} href={item.href} className="transition-colors hover:text-slate-950">
                  {item.label}
                </a>
              ))}
              {renderAuthActions()}
            </>
          ) : (
            <>
              <Link href={homeHref} className="transition-colors hover:text-primary">
                Início
              </Link>
              {publicLinks.map((item) => (
                <Link key={item.href} href={item.href} className="transition-colors hover:text-primary">
                  {item.label}
                </Link>
              ))}
              {renderAuthActions()}
            </>
          )}
        </nav>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6 text-slate-800" />
            </Button>
          </SheetTrigger>

          <SheetContent side="right" className="w-[300px] bg-white text-slate-900">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <img src="/logo.png" alt="FinScope" className="h-10 w-auto" />
              </SheetTitle>
            </SheetHeader>

            <nav className="mt-8 flex flex-col gap-4 text-base font-medium text-slate-700">
              {landingMode ? (
                <>
                  {landingLinks.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="block py-2 transition-colors hover:text-slate-950"
                      onClick={closeMobileMenu}
                    >
                      {item.label}
                    </a>
                  ))}
                </>
              ) : (
                <>
                  <Link href={homeHref}>
                    <span className="block py-2 transition-colors hover:text-primary" onClick={closeMobileMenu}>
                      Início
                    </span>
                  </Link>

                  {publicLinks.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <span className="block py-2 transition-colors hover:text-primary" onClick={closeMobileMenu}>
                        {item.label}
                      </span>
                    </Link>
                  ))}
                </>
              )}

              <div className="mt-2 space-y-3 border-t pt-4">{renderAuthActions(true)}</div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
