# SQLite Setup Instructions for Development

To set up your local development environment with SQLite:

1. Update your `.env` file with the following:

```
# SQLite configuration for local development
DATABASE_URL="file:./dev.db"
```

2. Run the following commands to apply the database schema changes:

```bash
# Generate SQLite migration files
npx prisma migrate dev --name sqlite-migration

# Generate Prisma client
npx prisma generate
```

3. This will create a `dev.db` SQLite database file in your `/prisma` directory.
