import { Link } from "wouter";
import { TrendingUp } from "lucide-react";

export function FinScopeFooter() {
  return (
    <footer className="border-t py-12 bg-muted/20">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-poppins font-bold"></span>
            </div>
            <p className="text-sm text-muted-foreground">
              Controle financeiro inteligente para pessoas e microempresas.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Produto</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/recursos"><span className="hover:text-foreground transition-colors cursor-pointer">Recursos</span></Link></li>
              <li><a href="#planos" className="hover:text-foreground transition-colors">Preços</a></li>
              <li><Link href="/faq"><span className="hover:text-foreground transition-colors cursor-pointer">FAQ</span></Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Empresa</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/sobre"><span className="hover:text-foreground transition-colors cursor-pointer">Sobre</span></Link></li>
              <li><Link href="/blog"><span className="hover:text-foreground transition-colors cursor-pointer">Blog</span></Link></li>
              <li><Link href="/contato"><span className="hover:text-foreground transition-colors cursor-pointer">Contato</span></Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/privacidade"><span className="hover:text-foreground transition-colors cursor-pointer">Privacidade</span></Link></li>
              <li><Link href="/termos"><span className="hover:text-foreground transition-colors cursor-pointer">Termos</span></Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; 2025 FinScope. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
