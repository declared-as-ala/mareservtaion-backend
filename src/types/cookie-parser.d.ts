declare module 'cookie-parser' {
  import { RequestHandler } from 'express';
  function cookieParser(secret?: string): RequestHandler;
  export = cookieParser;
}
