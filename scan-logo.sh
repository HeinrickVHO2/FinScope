#!/bin/bash

echo "🔍 Procurando referências a logos no projeto FinScope..."
echo

# Termos mais comuns
KEYWORDS=(
  "logo"
  "favicon"
  "icon"
  "brand"
  "image"
  "assets"
  "logo.svg"
  "logo.png"
  ".svg"
  ".png"
)

# Pastas que devem ser escaneadas
DIRECTORIES=(
  "client"
  "server"
  "public"
  "src"
)

echo "📁 Procurando nos diretórios: ${DIRECTORIES[*]}"
echo

for DIR in "${DIRECTORIES[@]}"; do
  if [[ -d "$DIR" ]]; then
    echo "📂 Escaneando pasta: $DIR"
    echo

    for WORD in "${KEYWORDS[@]}"; do
      echo "➤ Termo: $WORD"
      grep -Rni --color=always "$WORD" "$DIR"
      echo
    done
  fi
done

echo "✅ Varredura completa!"
