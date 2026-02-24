/**
 * Vercel serverless entry. Committed so Vercel finds a function at /api.
 * The real handler is built by npm run build:vercel → api/handler.mjs
 */
import handler from './handler.mjs';
export default handler;
