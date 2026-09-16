#!/bin/bash
set -euo pipefail

echo "Installation des dépendances racine..."
npm ci --no-audit --no-fund

echo "Installation des dépendances frontend..."
npm ci --prefix frontend --no-audit --no-fund

echo "Installation des dépendances backend..."
npm ci --prefix backend --no-audit --no-fund

echo "Compilation du frontend..."
npm run build --prefix frontend

echo "Configuration post-fusion terminée."