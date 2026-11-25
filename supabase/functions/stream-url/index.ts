// SAMMEERE JIME — Edge Function « stream-url »
//
// Délivre au lecteur une URL signée de courte durée pour un titre, après avoir
// vérifié les droits d'écoute de l'utilisateur connecté (can_stream_track).
//   POST /functions/v1/stream-url   { "track_id": "…", "mode": "stream" | "offline" }
//   → { url, expires_in, quality }
//
// • Les auditeurs n'ont aucun accès direct au bucket privé « audio ».
// • Les Premium reçoivent la qualité améliorée (audio_hq_path) si elle existe.
// • mode "offline" : réservé aux Premium et aux acheteurs ; l'app doit chiffrer
//   le fichier dans son stockage interne (jamais dans la galerie / les fichiers).
import { createClient } from "npm:@supabase/supabase-js@2";

const STREAM_TTL_SECONDS = 60 * 10; // le lecteur redemande une URL au besoin
const OFFLINE_TTL_SECONDS = 60 * 5; // juste le temps du téléchargement interne

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Connexion requise" }, 401);

  let body: { track_id?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requête invalide" }, 400);
  }
  const trackId = body.track_id;
  const mode = body.mode === "offline" ? "offline" : "stream";
  if (!trackId || !/^[0-9a-f-]{36}$/i.test(trackId)) {
    return json({ error: "track_id manquant ou invalide" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Client « au nom de l'utilisateur » : les règles d'accès s'appliquent.
  const asUser = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData.user) return json({ error: "Session invalide" }, 401);

  const rightFn = mode === "offline" ? "can_download_offline" : "can_stream_track";
  const { data: allowed, error: rightError } = await asUser.rpc(rightFn, { p_track_id: trackId });
  if (rightError) return json({ error: "Vérification impossible" }, 500);
  if (!allowed) {
    return json({
      error: mode === "offline"
        ? "Le mode hors ligne est réservé aux abonnés Premium et aux acheteurs de l'album"
        : "Ce titre n'est pas accessible avec votre compte",
    }, 403);
  }

  const { data: premium } = await asUser.rpc("is_premium");

  // Client serveur : seul lui peut lire le bucket privé.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: track, error: trackError } = await admin
    .from("tracks")
    .select("audio_path, audio_hq_path")
    .eq("id", trackId)
    .single();
  if (trackError || !track) return json({ error: "Titre introuvable" }, 404);

  const useHq = premium === true && !!track.audio_hq_path;
  const path = useHq ? track.audio_hq_path : track.audio_path;
  const ttl = mode === "offline" ? OFFLINE_TTL_SECONDS : STREAM_TTL_SECONDS;

  const { data: signed, error: signError } = await admin.storage
    .from("audio")
    .createSignedUrl(path, ttl);
  if (signError || !signed) return json({ error: "Fichier audio indisponible" }, 404);

  return json({
    url: signed.signedUrl,
    expires_in: ttl,
    quality: useHq ? "hq" : "standard",
    mode,
  });
});
