import { Link } from "wouter";
import { TrendingUp } from "lucide-react";

export function FinScopeFooter() {
  const textClass = "text-muted-foreground";
  const linkClass = "hover:text-foreground transition-colors cursor-pointer";

  return (
    <footer className="border-t py-12 bg-muted/20">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-poppins font-bold"></span>
            </div>
            <p className={`text-sm ${textClass}`}>
              Controle financeiro inteligente para pessoas e microempresas.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Produto</h3>
            <ul className={`space-y-2 text-sm ${textClass}`}>
              <li><Link href="/recursos"><span className={linkClass}>Recursos</span></Link></li>
              <li><a href="#planos" className={linkClass}>Planos</a></li>
              <li><Link href="/faq"><span className={linkClass}>FAQ</span></Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Empresa</h3>
            <ul className={`space-y-2 text-sm ${textClass}`}>
              <li><Link href="/sobre"><span className={linkClass}>Sobre</span></Link></li>
              <li><Link href="/blog"><span className={linkClass}>Blog</span></Link></li>
              <li><Link href="/contato"><span className={linkClass}>Contato</span></Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className={`space-y-2 text-sm ${textClass}`}>
              <li><Link href="/privacidade"><span className={linkClass}>Privacidade</span></Link></li>
              <li><Link href="/termos"><span className={linkClass}>Termos</span></Link></li>
            </ul>
          </div>
        </div>

        <div className={`mt-8 pt-8 border-t text-center text-sm ${textClass}`}>
          <p>&copy; 2025 FinScope. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
