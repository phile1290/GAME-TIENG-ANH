import type { VercelRequest, VercelResponse } from '@vercel/node';
import extractQuizHandler from './gemini/extract-quiz.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return extractQuizHandler(req, res);
}
