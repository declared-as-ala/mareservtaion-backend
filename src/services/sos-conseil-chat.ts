import { z } from 'zod';

const MAX_MESSAGE_CHARS = 4000;

const extractedDataSchema = z
  .object({
    fullName: z.union([z.string(), z.literal(null)]).optional(),
    phone: z.union([z.string(), z.literal(null)]).optional(),
    email: z.union([z.string(), z.literal(null)]).optional(),
    eventType: z.union([z.string(), z.literal(null)]).optional(),
    participants: z.union([z.string(), z.number(), z.literal(null)]).optional(),
    ageRanges: z.array(z.string()).optional(),
    region: z.union([z.string(), z.literal(null)]).optional(),
    placeType: z.union([z.string(), z.literal(null)]).optional(),
    date: z.union([z.string(), z.literal(null)]).optional(),
    time: z.union([z.string(), z.literal(null)]).optional(),
    budget: z.union([z.string(), z.literal(null)]).optional(),
    ambiance: z.array(z.string()).optional(),
    contactPreference: z.union([z.string(), z.literal(null)]).optional(),
    details: z.union([z.string(), z.literal(null)]).optional(),
  })
  .optional();

export const sosChatBotResponseSchema = z.object({
  assistantMessage: z.string().default(''),
  extractedData: z
    .object({
      fullName: z.string().default(''),
      phone: z.string().default(''),
      email: z.string().default(''),
      eventType: z.string().default(''),
      participants: z.string().default(''),
      ageRanges: z.array(z.string()).default([]),
      region: z.string().default(''),
      placeType: z.string().default(''),
      date: z.string().default(''),
      time: z.string().default(''),
      budget: z.string().default(''),
      ambiance: z.array(z.string()).default([]),
      contactPreference: z.string().default(''),
      details: z.string().default(''),
    })
    .default({
      fullName: '',
      phone: '',
      email: '',
      eventType: '',
      participants: '',
      ageRanges: [],
      region: '',
      placeType: '',
      date: '',
      time: '',
      budget: '',
      ambiance: [],
      contactPreference: '',
      details: '',
    }),
  missingFields: z.array(z.string()).default([]),
  readyToSubmit: z.boolean().default(false),
  confidence: z
    .object({
      fullName: z.number().min(0).max(1).default(0),
      phone: z.number().min(0).max(1).default(0),
      eventType: z.number().min(0).max(1).default(0),
      participants: z.number().min(0).max(1).default(0),
      region: z.number().min(0).max(1).default(0),
      placeType: z.number().min(0).max(1).default(0),
    })
    .default({
      fullName: 0,
      phone: 0,
      eventType: 0,
      participants: 0,
      region: 0,
      placeType: 0,
    }),
});

export type SOSChatParsedResponse = z.infer<typeof sosChatBotResponseSchema>;

/** Salvage JSON from assistant output (often wrapped in prose or fenced blocks). */
export function salvageJsonFromAssistantText(raw: string): unknown {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1]?.trim() ?? trimmed;
    try {
      return JSON.parse(candidate);
    } catch {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(candidate.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

function coerceParticipants(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v);
}

function coerceString(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

/** Parse loose envelope from model + merge into validated shape. */
export function parseEnvelopeToResponse(parsed: unknown): SOSChatParsedResponse | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;

  const assistantMessageRaw = typeof o.assistantMessage === 'string' ? o.assistantMessage.trim() : '';
  if (!assistantMessageRaw) return null;

  const edParsed = extractedDataSchema.safeParse(o.extractedData);
  const rd = edParsed.success ? edParsed.data : undefined;

  const merged = {
    assistantMessage: assistantMessageRaw.slice(0, 12000),
    extractedData: {
      fullName: coerceString(rd?.fullName),
      phone: coerceString(rd?.phone),
      email: coerceString(rd?.email),
      eventType: coerceString(rd?.eventType),
      participants: coerceParticipants(rd?.participants),
      ageRanges: Array.isArray(rd?.ageRanges) ? rd!.ageRanges.map((x) => String(x)).filter(Boolean).slice(0, 24) : [],
      region: coerceString(rd?.region),
      placeType: coerceString(rd?.placeType),
      date: coerceString(rd?.date),
      time: coerceString(rd?.time),
      budget: coerceString(rd?.budget),
      ambiance: Array.isArray(rd?.ambiance) ? [...new Set(rd!.ambiance.map((x) => String(x)))].slice(0, 50) : [],
      contactPreference: coerceString(rd?.contactPreference),
      details: coerceString(rd?.details),
    },
    missingFields: Array.isArray(o.missingFields)
      ? o.missingFields.map((x) => String(x)).slice(0, 40)
      : [],
    readyToSubmit: typeof o.readyToSubmit === 'boolean' ? o.readyToSubmit : false,
    confidence:
      o.confidence && typeof o.confidence === 'object'
        ? {
            fullName: Number((o.confidence as Record<string, unknown>).fullName ?? 0),
            phone: Number((o.confidence as Record<string, unknown>).phone ?? 0),
            eventType: Number((o.confidence as Record<string, unknown>).eventType ?? 0),
            participants: Number((o.confidence as Record<string, unknown>).participants ?? 0),
            region: Number((o.confidence as Record<string, unknown>).region ?? 0),
            placeType: Number((o.confidence as Record<string, unknown>).placeType ?? 0),
          }
        : {
            fullName: 0,
            phone: 0,
            eventType: 0,
            participants: 0,
            region: 0,
            placeType: 0,
          },
  };

  const final = sosChatBotResponseSchema.safeParse(merged);
  return final.success ? final.data : null;
}

function hasNonEmpty(v: unknown): boolean {
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return v !== null && v !== undefined;
}

function computeMissingFields(data: SOSChatParsedResponse['extractedData'], currentForm: Record<string, unknown>): string[] {
  const required: Array<{ key: keyof SOSChatParsedResponse['extractedData']; label: string; formKey?: string }> = [
    { key: 'fullName', label: 'fullName' },
    { key: 'phone', label: 'phone' },
    { key: 'eventType', label: 'eventType', formKey: 'occasionType' },
    { key: 'participants', label: 'participants', formKey: 'participantsCount' },
    { key: 'ageRanges', label: 'ageRanges', formKey: 'averageAgeRanges' },
    { key: 'region', label: 'region', formKey: 'preferredRegion' },
    { key: 'placeType', label: 'placeType', formKey: 'preferredCategory' },
  ];
  return required
    .filter(({ key, formKey }) => !hasNonEmpty(data[key]) && !hasNonEmpty(currentForm[formKey ?? key]))
    .map(({ label }) => label);
}

function buildSystemPrompt(currentFormSnapshot: Record<string, unknown>): string {
  return `Tu es Assistant SOS Conseil pour MaTable (Ma Reservation), concierge pour restaurants, cafés, hôtels, salons, rooftops et lieux événementiels en Tunisie.

COMPORTEMENT:
- Questions courtes, utiles, une ou deux maximum par tour.
- N'invente JAMAIS les infos personnelles ; seuls les faits donnés ou déduits avec prudence hors identité précise font partie du JSON.
- Réponds dans la même langue que l'utilisateur (français, arabe, dialecte tunisien, anglais).

STRUCTURE:
Clés extractedData lorsque pertinentes depuis la conversation OU le snapshot (merge prudent):
fullName, phone, email, eventType (valeurs conseillées backend: birthday | wedding_engagement | business_meeting | family_event | romantic_dinner | graduation | corporate | other)
participants — nombre sous forme de chaîne dans JSON
ageRanges — uniquement valeurs parmi exactement : 18-20 , 20-30 , 30-40 , 40-50 , 50-60 , +60
region, placeType (cafe | restaurant | hotel | cinema | event_space | lounge | rooftop ...)
date, time, budget (chaîne ou indicateur niveau comme moins_100, 100_300 ...)
ambiance (tableau de tags courts)
contactPreference une seule valeur: whatsapp | phone | email
details pour le reste

Snapshot formulaire existant à fusionner (JSON strict):
${JSON.stringify(currentFormSnapshot)}

IMPORTANT: Une seule ligne logique avant le JSON INTERDITE — Réponds STRICTEMENT avec un UNIQUE objet JSON UTF-8, sans prose hors JSON.

Schéma exact obligatoire:
{"assistantMessage":"string","extractedData":{"fullName":"","phone":"","email":"","eventType":"","participants":"","ageRanges":[],"region":"","placeType":"","date":"","time":"","budget":"","ambiance":[],"contactPreference":"","details":""},"missingFields":[],"readyToSubmit":false,"confidence":{"fullName":0,"phone":0,"eventType":0,"participants":0,"region":0,"placeType":0}}`;
}

export interface ChatCompletionMessageInput {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function runSOSConseilChat(opts: {
  messages: ChatCompletionMessageInput[];
  currentFormData: Record<string, unknown>;
  apiKey: string | undefined;
  model: string;
  siteUrl: string;
  appTitle: string;
}): Promise<{ ok: true; data: SOSChatParsedResponse } | { ok: false; httpStatus: number; message: string }> {
  const apiKey = opts.apiKey?.trim();
  if (!apiKey) {
    return {
      ok: false,
      httpStatus: 503,
      message: 'Assistant indisponible (configuration serveur)',
    };
  }

  const systemPrompt = buildSystemPrompt(opts.currentFormData);

  const openRouterMessages: { role: string; content: string }[] = [{ role: 'system', content: systemPrompt }];
  for (const m of opts.messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const content = typeof m.content === 'string' ? m.content.slice(0, MAX_MESSAGE_CHARS) : '';
    openRouterMessages.push({ role: m.role, content });
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': opts.siteUrl,
        'X-OpenRouter-Title': opts.appTitle || 'MaTable SOS Conseil',
      },
      body: JSON.stringify({
        model: opts.model?.trim() || 'openrouter/free',
        messages: openRouterMessages,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
      message?: string;
    };

    if (!res.ok) {
      const msg = json?.error?.message ?? json?.message ?? `Erreur ${res.status}`;
      console.error('[SOS Chat] OpenRouter:', res.status, msg);
      return { ok: false, httpStatus: 502, message: 'Réponse IA indisponible. Réessayez.' };
    }

    const rawContent = json?.choices?.[0]?.message?.content;
    const text = typeof rawContent === 'string' ? rawContent : '';
    const salvaged = salvageJsonFromAssistantText(text || '');
    if (salvaged == null) {
      return { ok: false, httpStatus: 502, message: 'Format de réponse invalide.' };
    }

    const coerced = parseEnvelopeToResponse(salvaged);
    if (!coerced) {
      return { ok: false, httpStatus: 502, message: 'Format de réponse invalide.' };
    }

    const missing = coerced.missingFields.length
      ? coerced.missingFields
      : computeMissingFields(coerced.extractedData, opts.currentFormData);
    const ready = missing.length === 0;

    return {
      ok: true,
      data: {
        ...coerced,
        missingFields: missing,
        readyToSubmit: coerced.readyToSubmit && ready,
      },
    };
  } catch (e) {
    console.error('[SOS Chat] fetch error:', e);
    return { ok: false, httpStatus: 502, message: 'Erreur réseau vers le service IA.' };
  }
}
