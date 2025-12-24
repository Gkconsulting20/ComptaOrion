# Guide de Migration ComptaOrion vers Render

## Étape 1 : Créer un compte Render
1. Allez sur https://render.com
2. Inscrivez-vous avec votre compte GitHub

## Étape 2 : Connecter votre dépôt GitHub
1. Exportez ce projet vers GitHub (depuis Replit : Menu > Export to GitHub)
2. Ou créez un nouveau dépôt et poussez le code

## Étape 3 : Déployer avec le fichier render.yaml
1. Dans Render Dashboard, cliquez sur "New" > "Blueprint"
2. Sélectionnez votre dépôt GitHub
3. Render détectera automatiquement le fichier `render.yaml`
4. Cliquez sur "Apply"

## Étape 4 : Configurer les secrets (si nécessaire)
Dans Render Dashboard > Environment :
- SENDGRID_API_KEY (pour les emails)
- FEDAPAY_SECRET_KEY (pour les paiements)
- FEDAPAY_PUBLIC_KEY

## Étape 5 : Migrer les données
1. Exportez vos données depuis Replit (utiliser le module Intégrations > Export)
2. Importez-les dans la nouvelle base Render

## URLs après déploiement
- Application : https://comptaorion.onrender.com
- Base de données : fournie par Render

## Coûts
- Web Service : GRATUIT (750 heures/mois)
- Base PostgreSQL : GRATUIT (90 jours, puis $7/mois)
- Alternative base gratuite : Neon.tech ou Supabase
