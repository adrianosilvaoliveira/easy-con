import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../src/createApp';

const appPromise = createApp();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await appPromise;
  return app(req, res);
}
