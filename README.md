Outil interne de scrapping et scoring de prospects (Google Maps -> audits site/SEO/GEO -> matching Pappers -> export Notion/CSV).

## Setup (dev local)

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

## Partager les données avec l'équipe (Turso)

Chaque membre de l'équipe lance l'app en local (comme en dev ci-dessus), mais pour voir
les mêmes campagnes/leads que ses collègues, il suffit de pointer tout le monde vers une
même base de données distante au lieu du fichier SQLite local — pas besoin de déployer
l'app nulle part.

1. Créer un compte sur [turso.tech](https://turso.tech) (gratuit, pas de carte bancaire
   nécessaire à l'inscription à ma connaissance — à vérifier au moment de créer le compte).
2. Créer la base et récupérer l'URL + un token d'accès :
   ```bash
   turso db create prospects-scrapping-tool
   turso db show prospects-scrapping-tool --url
   turso db tokens create prospects-scrapping-tool
   ```
3. Construire l'URL complète (token embarqué) :
   `DATABASE_URL="libsql://<db>-<org>.turso.io?authToken=<token>"`
4. Appliquer les migrations une seule fois sur cette base partagée :
   ```bash
   DATABASE_URL="libsql://..." npx prisma migrate deploy
   ```
5. Chaque membre de l'équipe remplace `DATABASE_URL` dans son propre `.env.local` par
   cette même valeur (à partager via un canal sécurisé — gestionnaire de mots de passe
   partagé par exemple — jamais commité dans git, même logique que la clé Notion).

`gosom` continue de tourner en local chez chacun (`docker compose up -d`) : seule la base
de données est partagée, le scraping/l'analyse tournent toujours sur la machine de la
personne qui lance la campagne.

**Limite** : pas de contrôle d'accès par utilisateur — quiconque a la valeur
`DATABASE_URL` (token inclus) peut lire/écrire toute la base, au même titre qu'avec la clé
API Notion aujourd'hui. Suffisant pour une petite équipe de confiance ; pas adapté si le
besoin évolue vers un accès public ou un grand nombre d'utilisateurs externes.
