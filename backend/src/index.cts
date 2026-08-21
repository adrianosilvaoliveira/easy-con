import './shared/types/express';
import { createApp } from './createApp';

/** Entrypoint para Vercel (@vercel/backends / Express) — .cts força shim CommonJS. */
export default createApp();
