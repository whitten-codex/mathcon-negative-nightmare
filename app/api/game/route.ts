import { env } from 'cloudflare:workers';
import { handleGame } from '../../../lib/api.mjs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return handleGame(request, env.DB); }
