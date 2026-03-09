import { supabase } from "./supabase";
import fs from "fs";
import path from "path";

async function setupDatabase() {
  console.log("🔧 Configurando banco de dados Supabase...");

  const sqlPath = path.join(process.cwd(), "setup-database.sql");
  const sqlContent = fs.readFileSync(sqlPath, "utf-8");

  // Split SQL into individual statements
  const statements = sqlContent
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("--"));

  console.log(`📝 Executando ${statements.length} comandos SQL...`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        if (error) {
          console.log(`⚠️  Comando ${i + 1}: ${error.message} (pode ser esperado se já existe)`);
        } else {
          console.log(`✓ Comando ${i + 1} executado com sucesso`);
        }
      } catch (err) {
        console.log(`⚠️  Comando ${i + 1}: ${err} (pode ser esperado se já existe)`);
      }
    }
  }

  console.log("✅ Configuração do banco de dados concluída!");
  console.log("\nPróximos passos:");
  console.log("1. Acesse o Supabase SQL Editor: https://tiwlisugjwlmctbmfedx.supabase.co/project/_/sql");
  console.log("2. Cole e execute o conteúdo do arquivo setup-database.sql");
  console.log("3. Reinicie o servidor e teste a aplicação");
}

setupDatabase().catch(console.error);
