#!/bin/bash

# Script rápido para fazer OTA Updates
# Use: ./scripts/ota-quick-start.sh

echo "🚀 EAS OTA Quick Deploy"
echo "======================="
echo ""
echo "Escolha o canal:"
echo "1) development (seu amigo)"
echo "2) preview"
echo "3) production"
echo ""

read -p "Digite o número (1-3): " choice

case $choice in
  1)
    echo "📤 Publicando para DEVELOPMENT..."
    npm run update:development
    ;;
  2)
    echo "📤 Publicando para PREVIEW..."
    npm run update:preview
    ;;
  3)
    echo "⚠️  Publicando para PRODUCTION..."
    echo "Tem certeza? (s/n)"
    read -p "" confirm
    if [ "$confirm" = "s" ]; then
      npm run update:production
    else
      echo "Cancelado!"
    fi
    ;;
  *)
    echo "Opção inválida!"
    ;;
esac

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "💡 Seu amigo vai receber a atualização quando abrir o app"
echo "📊 Para ver histórico: eas update:list"
