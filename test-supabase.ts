import { supabase } from "./server/supabase";

async function testConnection() {
  console.log("🔌 Testando conexão com Supabase...");
  
  const { data, error } = await supabase.from("users").select("count").limit(1);
  
  if (error && error.code === "42P01") {
    console.log("✓ Conectado ao Supabase com sucesso!");
    console.log("⚠️  Tabelas ainda não foram criadas.");
    console.log("");
    console.log("📋 Próximo passo: Criar as tabelas no Supabase");
    console.log("   1. Acesse: https://tiwlisugjwlmctbmfedx.supabase.co/project/_/sql");
    console.log("   2. Cole o conteúdo de setup-database.sql");
    console.log("   3. Execute o SQL");
  } else if (error) {
    console.log("✗ Erro de conexão:", error.message);
    process.exit(1);
  } else {
    console.log("✓ Conectado e tabelas existem!");
    console.log("✓ Supabase está pronto para uso!");
  }
}

testConnection();
