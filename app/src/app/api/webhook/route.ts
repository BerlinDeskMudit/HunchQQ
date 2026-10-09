import { handleWebhook } from "@/lib/webhook";

export async function POST(req: Request): Promise<Response> {
  return handleWebhook(req);
}
