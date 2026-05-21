import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BatchService } from '../../src/modules/batches/BatchService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization;
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    res.status(401).json({ success: false, message: 'Não autorizado' });
    return;
  }

  try {
    const result = await BatchService.runExpirationJob();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Cron expiration failed', error);
    res.status(500).json({ success: false, message: 'Falha no job de vencimentos' });
  }
}
