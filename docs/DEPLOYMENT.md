# Git and Vercel deployment

Production source: https://github.com/DevTeamStudios-git/Tempo-Agenda, branch main. Vercel project agenda builds the repository root; native source in mobile is excluded from web TypeScript and ESLint. Keep credentials in Vercel environment settings, never Git.

The production build generates Prisma Client and builds Next.js. Apply Prisma migrations separately with prisma migrate deploy using the intended database connection. The schema migrations in this release have already been applied to the database used for verification. Do not run prisma migrate dev against production.

For native development, run npm run mobile:install followed by npm run mobile:start. Then run npm run mobile:android in another terminal with an emulator or Android device configured. Metro is a development server and is not required by the Vercel web app. For release mobile builds, configure a deployed HTTPS backend and release signing.
