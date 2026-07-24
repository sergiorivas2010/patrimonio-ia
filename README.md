# Patrimonio IA corregido

Worker independiente para conectar `patrimonio-app` con Cloudflare Workers AI.

## Archivos importantes
- `src/index.ts`: servidor y endpoint `/api/chat`
- `src/types.ts`: tipos
- `wrangler.jsonc`: binding `AI`
- `package.json`: comando de despliegue

No utiliza `ASSETS.fetch`, por lo que corrige el error:
`Cannot read properties of undefined (reading 'fetch')`.
