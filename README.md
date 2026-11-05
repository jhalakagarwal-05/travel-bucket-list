# Wanderlist

Wanderlist is a personal travel bucket list for recording places I've visited and places I want to go.

**Live app:** https://eager-darkblue-demand.replit.app

## Tools

- Replit Agent
- PostgreSQL
- Drizzle ORM
- Express
- React and Vite
- Leaflet and OpenStreetMap
- Chart.js
- Vitest
- GitHub

## Run locally

You need Node.js and a PostgreSQL database. Set the database connection string and a session secret in your shell:

```sh
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
export SESSION_SECRET="replace-with-a-long-random-value"
```

Then install dependencies, create the database schema, seed the default categories, and start the development server:

```sh
npm ci
npm run db:push
npm run db:seed
npm run dev
```

Open http://localhost:5000. `DATABASE_URL` and `SESSION_SECRET` are required. In Replit, use the PostgreSQL database connection and store `SESSION_SECRET` in Secrets.

## Run tests

Run the full test suite:

```sh
npm test
```

Run the required PLAN.md tests only:

```sh
npm run test:required
```
