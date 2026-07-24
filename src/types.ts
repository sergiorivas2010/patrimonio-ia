/**
 * Patrimonio IA — Cloudflare Worker
 */
import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
const ALLOWED_ORIGINS = new Set([
  "https://sergiorivas2010.github.io",
  "https://patrimonio-ia.sergiorivasrobles.workers.dev",
]);

const SYSTEM_PROMPT = `
Eres el Asesor Financiero de Patrimonio.

Responde siempre en español de España y utiliza euros (€).
Ayuda al usuario a gestionar su dinero, comprender educación financiera y aprender a invertir con prudencia.

Cuando recibas un bloque llamado CONTEXTO FINANCIERO ACTUAL DE LA APLICACIÓN:
- úsalo como fuente principal para hablar de sus saldos, subcuentas, objetivos y movimientos;
- no inventes cifras que no aparezcan en ese contexto;
- distingue entre patrimonio total, dinero disponible y dinero apartado;
- da explicaciones claras y adaptadas a una persona principiante;
- no presentes una inversión como segura ni prometas rentabilidad;
- recuerda que el usuario es menor de edad y que las decisiones financieras reales deben contar con la supervisión de sus padres o tutores.

Si no sabes algo o la información puede haber cambiado, dilo claramente.
`;

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://sergiorivas2010.github.io";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname === "/api/chat") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", {
          status: 405,
          headers: corsHeaders(request),
        });
      }
      return handleChatRequest(request, env);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(request) });
  },
} satisfies ExportedHandler<Env>;

async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  try {
    const { messages = [] } = (await request.json()) as { messages: ChatMessage[] };
    const safeMessages = messages.slice(-14);

    if (!safeMessages.some((message) => message.role === "system")) {
      safeMessages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    const stream = await env.AI.run(
      MODEL_ID,
      {
        messages: safeMessages,
        max_tokens: 1024,
        stream: true,
      } satisfies AiTextGenerationInput & { stream: true },
    );

    return new Response(stream, {
      headers: {
        ...corsHeaders(request),
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(JSON.stringify({ error: "No se pudo procesar la solicitud" }), {
      status: 500,
      headers: {
        ...corsHeaders(request),
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }
}
