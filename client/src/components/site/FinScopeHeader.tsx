import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ArrowLeft, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";

type FinScopeHeaderProps = {
  backHref?: string;
  backLabel?: string;
};

const publicLinks = [
  { href: "/recursos", label: "Recursos" },
  { href: "/faq", label: "FAQ" },
  { href: "/sobre", label: "Sobre" },
  { href: "/blog", label: "Blog" },
  { href: "/contato", label: "Contato" },
] as const;

export function FinScopeHeader({ backHref, backLabel = "Voltar" }: FinScopeHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isLoading, logout } = useAuth();
  const showBackLink = Boolean(backHref);
  const linkClass = "hover:text-primary transition-colors";
  const navClass = "hidden md:flex items-center gap-6 text-sm font-medium text-slate-700";
  const homeHref = user ? "/dashboard" : "/";

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const handleLogout = async () => {
    closeMobileMenu();
    await logout();
  };

  return (
    <header
      className="sticky top-0 z-50 w-full border-b bg-white shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-white/80"
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {showBackLink && (
            <Link href={backHref!}>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-700 hover:text-primary"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Button>
            </Link>
          )}

          <Link href={homeHref}>
            <div className="flex cursor-pointer items-center gap-3">
              <img
                src="/logo.png"
                alt="FinScope"
                className="h-12 w-auto"
              />
            </div>
          </Link>
        </div>

        <nav className={navClass}>
          <Link href={homeHref} className={linkClass}>
            Início
          </Link>
          {publicLinks.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ))}

          {!isLoading && (
            user ? (
              <>
                <Link href="/dashboard" className={linkClass}>
                  Painel
                </Link>
                <Button type="button" variant="outline" onClick={handleLogout}>
                  Sair
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className={linkClass}>
                  Acessar
                </Link>
                <Link href="/signup">
                  <Button>Cadastre-se</Button>
                </Link>
              </>
            )
          )}
        </nav>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6 text-slate-800" />
            </Button>
          </SheetTrigger>

          <SheetContent
            side="right"
            className="w-[300px] bg-white text-slate-900"
          >
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <img src="/logo.png" alt="FinScope" className="h-10 w-auto" />
              </SheetTitle>
            </SheetHeader>

            <nav className="mt-8 flex flex-col gap-4 text-base font-medium text-slate-700">
              <Link href={homeHref}>
                <span
                  className={`block py-2 transition-colors ${linkClass}`}
                  onClick={closeMobileMenu}
                >
                  Início
                </span>
              </Link>

              {publicLinks.map((item) => (
                <Link key={item.href} href={item.href}>
                  <span
                    className={`block py-2 transition-colors ${linkClass}`}
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </span>
                </Link>
              ))}

              {!isLoading && (
                <div className="mt-2 space-y-3 border-t pt-4">
                  {user ? (
                    <>
                      <Link href="/dashboard">
                        <Button
                          className="w-full justify-start"
                          onClick={closeMobileMenu}
                        >
                          Painel
                        </Button>
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={handleLogout}
                      >
                        Sair
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link href="/login">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={closeMobileMenu}
                        >
                          Acessar
                        </Button>
                      </Link>

                      <Link href="/signup">
                        <Button
                          className="w-full justify-start"
                          onClick={closeMobileMenu}
                        >
                          Cadastre-se
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
