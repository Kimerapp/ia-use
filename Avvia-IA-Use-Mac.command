#!/bin/bash
cd "$(dirname "$0")"

echo "==================================================="
echo "  ⚡ Avvio di IA-Use (Multi-AI Desktop Workspace)  "
echo "==================================================="

if ! command -v node &> /dev/null; then
  echo ""
  echo "❌ Node.js non è installato sul tuo Mac."
  echo "👉 Scaricalo gratis da: https://nodejs.org (clicca sul bottone verde 'LTS')"
  echo "   Una volta installato Node.js, fai di nuovo doppio click su questo file!"
  echo ""
  open "https://nodejs.org/"
  read -p "Premi Invio per chiudere..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 Prima installazione in corso (richiede circa 15-30 secondi)..."
  npm install
fi

echo ""
echo "🚀 Apertura di IA-Use in corso..."
npm start
