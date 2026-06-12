import { CatalogBrief, Character, PsionicPower } from "./types";

const BASE = "/api/v1";

async function get<T>(url: string): Promise<T> {
  const r = await fetch(BASE + url);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export interface CatalogQuery {
  q?: string;
  trait?: string;
  tradition?: string;
  category?: string;
  level_min?: number;
  level_max?: number;
  allowed_only?: boolean;
  limit?: number;
  offset?: number;
}

export const api = {
  catalog(type: string, params: CatalogQuery = {}): Promise<CatalogBrief[]> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "" && v !== false) qs.set(k, String(v));
    }
    return get(`/catalog/${type}?${qs}`);
  },
  item(uid: string): Promise<Record<string, unknown>> {
    return get(`/item/${uid}`);
  },
  powers(params: { discipline?: string; rank?: number; max_rank?: number; q?: string } = {}): Promise<PsionicPower[]> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    return get(`/psionics/powers?${qs}`);
  },
  disciplines(): Promise<{ name: string; foco: string; key_ability: string; primary_save: string; skills: string[] }[]> {
    return get(`/psionics/disciplines`);
  },
  wildTalents(): Promise<{ rank: number; name: string; tier: string; cost: number; prob_min: number; prob_max: number; power_id: number | null }[]> {
    return get(`/psionics/wild-talents`);
  },
  houserules(kind = "", ancestry = ""): Promise<{ id: number; kind: string; title: string; content: string; data: Record<string, unknown> | null }[]> {
    const qs = new URLSearchParams();
    if (kind) qs.set("kind", kind);
    if (ancestry) qs.set("ancestry", ancestry);
    return get(`/houserules?${qs}`);
  },
  houserule(id: number): Promise<{ id: number; kind: string; title: string; content: string; data: Record<string, unknown> | null }> {
    return get(`/houserules/${id}`);
  },
  characters(): Promise<{ id: number; name: string; level: number; ancestry: string; className: string; updated_at: string }[]> {
    return get(`/characters`);
  },
  character(id: number): Promise<Character> {
    return get(`/characters/${id}`);
  },
  createCharacter(c: Character): Promise<{ id: number }> {
    return send("POST", `/characters`, c);
  },
  updateCharacter(id: number, c: Character): Promise<{ ok: boolean }> {
    return send("PUT", `/characters/${id}`, c);
  },
  deleteCharacter(id: number): Promise<{ ok: boolean }> {
    return send("DELETE", `/characters/${id}`);
  },
};
