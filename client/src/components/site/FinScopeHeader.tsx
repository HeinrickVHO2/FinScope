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
import { Menu } from "lucide-react";

export function FinScopeHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="
      sticky top-0 z-50 w-full border-b
      bg-white/80 backdrop-blur-xl 
      supports-[backdrop-filter]:bg-white/70
      shadow-sm
    ">
      <div className="container flex h-16 items-center justify-between">
        
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <img
              src="/logo.png"
              alt="FinScope"
              className="h-19 w-auto mas h-20"
            />
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
          <Link href="/recursos" className="hover:text-primary transition-colors">
            Recursos
          </Link>
          <Link href="/faq" className="hover:text-primary transition-colors">
            FAQ
          </Link>
          <Link href="/sobre" className="hover:text-primary transition-colors">
            Sobre
          </Link>
          <Link href="/blog" className="hover:text-primary transition-colors">
            Blog
          </Link>
          <Link href="/contato" className="hover:text-primary transition-colors">
            Contato
          </Link>

          <Link href="/login">
            <Button variant="ghost" className="text-slate-700 hover:text-primary">
              Entrar
            </Button>
          </Link>
          <Link href="/signup">
            <Button> Criar Conta </Button>
          </Link>
        </nav>

        {/* Mobile nav */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6 text-slate-800" />
            </Button>
          </SheetTrigger>

          <SheetContent side="right" className="w-[300px]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <img src="/logo.png" alt="FinScope" className="h-10 w-auto" />
              </SheetTitle>
            </SheetHeader>

            <nav className="flex flex-col gap-4 mt-8 text-base font-medium text-slate-700">
              <Link href="/recursos">
                <span 
                  className="block py-2 hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Recursos
                </span>
              </Link>
              <Link href="/faq">
                <span 
                  className="block py-2 hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  FAQ
                </span>
              </Link>
              <Link href="/sobre">
                <span 
                  className="block py-2 hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sobre
                </span>
              </Link>
              <Link href="/blog">
                <span 
                  className="block py-2 hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Blog
                </span>
              </Link>
              <Link href="/contato">
                <span 
                  className="block py-2 hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contato
                </span>
              </Link>

              <div className="border-t pt-4 mt-2 space-y-3">
                <Link href="/login">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Entrar
                  </Button>
                </Link>

                <Link href="/signup">
                  <Button
                    className="w-full justify-start"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Criar Conta
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
