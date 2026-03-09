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

type FinScopeHeaderProps = {
  backHref?: string;
  backLabel?: string;
};

export function FinScopeHeader({ backHref, backLabel = "Voltar" }: FinScopeHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const showBackLink = Boolean(backHref);
  const linkClass = "hover:text-primary transition-colors";
  const navClass = "hidden md:flex items-center gap-6 text-sm font-medium text-slate-700";

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

          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <img
                src="/logo.png"
                alt="FinScope"
                className="h-12 w-auto"
              />
            </div>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className={navClass}>
          <Link href="/dashboard" className={linkClass}>
            Início
          </Link>
          <Link href="/recursos" className={linkClass}>
            Recursos
          </Link>
          <Link href="/faq" className={linkClass}>
            FAQ
          </Link>
          <Link href="/sobre" className={linkClass}>
            Sobre
          </Link>
          <Link href="/blog" className={linkClass}>
            Blog
          </Link>
          <Link href="/contato" className={linkClass}>
            Contato
          </Link>

          <Link href="/login" className={linkClass}>
            Acessar
          </Link>
          <Link href="/signup">
            <Button>Cadastre-se</Button>
          </Link>
        </nav>

        {/* Mobile nav */}
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

            <nav
              className="flex flex-col gap-4 mt-8 text-base font-medium text-slate-700"
            >
              <Link href="/dashboard">
                <span
                  className={`block py-2 transition-colors ${linkClass}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Início
                </span>
              </Link>
              <Link href="/recursos">
                <span 
                  className={`block py-2 transition-colors ${linkClass}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Recursos
                </span>
              </Link>
              <Link href="/faq">
                <span 
                  className={`block py-2 transition-colors ${linkClass}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  FAQ
                </span>
              </Link>
              <Link href="/sobre">
                <span 
                  className={`block py-2 transition-colors ${linkClass}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sobre
                </span>
              </Link>
              <Link href="/blog">
                <span 
                  className={`block py-2 transition-colors ${linkClass}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Blog
                </span>
              </Link>
              <Link href="/contato">
                <span 
                  className={`block py-2 transition-colors ${linkClass}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contato
                </span>
              </Link>

              <div className="border-t pt-4 mt-2 space-y-3">
                <Link href="/login">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Acessar
                  </Button>
                </Link>

                <Link href="/signup">
                  <Button
                    className="w-full justify-start"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Cadastre-se
                  </Button>
                </Link>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
