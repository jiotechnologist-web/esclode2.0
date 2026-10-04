# Escloud server merge

This package is based on the updated application and keeps its updated UI/API/features.
Deployment-specific parts were aligned with the main Hostinger version:

- Prisma datasource restored to MySQL.
- Updated `Note` model retained.
- Updated `User.privatePasswordHash` retained.
- Hostinger production scripts restored to npm + normal `next start`.
- Prisma generate/db push/seed run during build, matching the main server.
- Existing admin records are never overwritten by the seed script.
- Main SQLite-to-MySQL migration utility and Hostinger deployment docs are included.
- The bundled `db/custom.db` remains as a local/legacy database copy; production uses MySQL via `DATABASE_URL`.

Production `DATABASE_URL` must be supplied by the Hostinger server environment.
