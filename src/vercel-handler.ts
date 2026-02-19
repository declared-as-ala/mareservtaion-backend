import { connectDatabase } from './config/database';
import app from './app';

let dbConnected = false;

async function ensureDb() {
  if (!dbConnected) {
    await connectDatabase();
    dbConnected = true;
  }
}

export default async function handler(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
  await ensureDb();
  return (app as any)(req, res);
}
