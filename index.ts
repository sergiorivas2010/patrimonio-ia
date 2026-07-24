/**
 * Patrimonio IA — Cloudflare Worker
 */

import type { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

const SYSTEM_PROMPT = `
Eres el Asesor Financiero de Patrimonio.

Responde siempre en español de España y utiliza euros (€).
Ayuda al usuario a gestionar su dinero, comprender educación financiera y aprender a invertir con prudencia.

Cuando recibas un bloque llamado "CONTEXTO FINANCIERO ACTUAL DE LA APLICACIÓN":
- úsalo como fuente principal para hablar de saldos, subcuentas, objetivos y movimientos;
- no inventes cifras que no aparezcan en ese contexto;
- distingue entre patrimonio total, dinero disponible y dinero apartado;
- explica todo de forma sencilla;
- no presentes ninguna inversión como segura ni prometas rentabilidad;
- recuerda que el usuario es menor de edad y las decisiones financieras reales deben contar con la supervisión de sus padres o tutores.

Si no sabes algo o la información puede haber cambiado, dilo claramente.
`;

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin =
    origin === "https://sergiorivas2010.github.io"
      ? origin
      : "https://sergiorivas2010.github.io";

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
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    if (url.pathname === "/") {
      return new Response("Patrimonio IA funciona.", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          ...corsHeaders(request),
        },
      });
    }

    if (url.pathname !== "/api/chat") {
      return new Response("Not found", {
        status: 404,
        headers: corsHeaders(request),
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders(request),
      });
    }

    try {
      const body = (await request.json()) as { messages?: ChatMessage[] };
      const receivedMessages = Array.isArray(body.messages) ? body.messages : [];

      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        ...receivedMessages
          .filter(
            (message): message is ChatMessage =>
              Boolean(message) &&
              ["system", "user", "assistant"].includes(message.role) &&
              typeof message.content === "string",
          )
          .slice(-14),
      ];

      const result = (await env.AI.run(MODEL_ID, {
        messages,
        max_tokens: 900,
        stream: false,
      })) as { response?: string };

      const text =
        typeof result?.response === "string" && result.response.trim()
          ? result.response.trim()
          : "No he podido generar una respuesta.";

      // La app de Patrimonio espera una respuesta en formato SSE.
      const stream =
        `data: ${JSON.stringify({ response: text })}\n\n` +
        `data: [DONE]\n\n`;

      return new Response(stream, {
        status: 200,
        headers: {
          ...corsHeaders(request),
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    } catch (error) {
      console.error("Error processing chat request:", error);

      return new Response(
        JSON.stringify({ error: "No se pudo procesar la solicitud" }),
        {
          status: 500,
          headers: {
            ...corsHeaders(request),
            "Content-Type": "application/json; charset=utf-8",
          },
        },
      );
    }
  },
} satisfies ExportedHandler<Env>;
