Outil interne de scrapping et scoring de prospects (Google Maps -> audits site/SEO/GEO -> matching Pappers -> export Notion/CSV).

## Setup

```bash
npm install          # installe les deps + genere le client Prisma (postinstall)
cp .env.example .env.local
# renseigner les clés dans .env.local (demander à un membre de l'équipe)

npx prisma migrate deploy   # cree dev.db et applique les migrations
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Le service de scraping Google Maps (`GOSOM_API_URL`) tourne via Docker :

```bash
docker compose up -d
```

## Notion

`NOTION_DATABASE_ID` doit être l'ID de la **base** Notion (pas celui de sa data source,
qui apparaît parfois dans l'URL et lui ressemble). Pour le vérifier : ouvrir la base
"Prospects" en pleine page, partager avec l'intégration (menu `...` -> Connexions ->
"MOBEM Notion connection"), puis récupérer l'ID dans l'URL `https://www.notion.so/<id>?v=...`.

## Tests

```bash
npm run test
```
