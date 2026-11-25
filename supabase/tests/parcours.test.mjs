// Tests de bout en bout du backend SAMMEERE JIME sur un Supabase LOCAL.
//   cd supabase/tests && npm install
//   npx supabase start && npx supabase db reset
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm test
// Ne jamais lancer contre la base de production : le test crée des comptes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(ANON && SERVICE, "SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont requis");
assert.ok(/127\.0\.0\.1|localhost/.test(URL), "Ce test ne tourne que sur un Supabase local");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const server = createClient(URL, SERVICE, opts);
const anon = createClient(URL, ANON, opts);
const run = Date.now().toString(36);

async function newUser(label, displayName) {
  const email = `${label}-${run}@test.local`;
  const password = "MotDePasse-Test-123";
  const { data, error } = await server.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: displayName },
  });
  assert.ifError(error);
  const client = createClient(URL, ANON, opts);
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(e2);
  return { id: data.user.id, client };
}

const ok = ({ data, error }) => { assert.ifError(error); return data; };
const fails = ({ error }, msg) => assert.ok(error, msg ?? "une erreur était attendue");

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const inDays = (n) => iso(new Date(today.getTime() + n * 86400000));
const mp3 = new Blob([new Uint8Array(2048)], { type: "audio/mpeg" });

const ctx = {};

test("inscription : profil créé automatiquement avec le rôle auditeur", async () => {
  ctx.admin = await newUser("admin", "Admin");
  ctx.artistUser = await newUser("artiste", "Baaba");
  ctx.fan = await newUser("fan", "Aïssatou");
  ctx.fan2 = await newUser("fan2", "Mamadou");

  const p = ok(await ctx.fan.client.from("profiles").select("*").eq("id", ctx.fan.id).single());
  assert.equal(p.role, "listener");
  assert.equal(p.display_name, "Aïssatou");

  // Premier admin : attribué côté serveur (tableau de bord Supabase / clé service).
  ok(await server.from("profiles").update({ role: "admin" }).eq("id", ctx.admin.id));
});

test("un utilisateur ne peut pas se donner un rôle", async () => {
  fails(await ctx.fan.client.from("profiles").update({ role: "admin" }).eq("id", ctx.fan.id));
  ok(await ctx.fan.client.from("profiles").update({ bio: "J'aime le rap Pulaar" }).eq("id", ctx.fan.id));
  const p = ok(await ctx.fan.client.from("profiles").select("role,bio").eq("id", ctx.fan.id).single());
  assert.equal(p.role, "listener");
  assert.equal(p.bio, "J'aime le rap Pulaar");
});

test("candidature artiste puis validation par un admin", async () => {
  const c = ctx.artistUser.client;
  fails(await c.from("artists").insert({ owner_id: ctx.artistUser.id, stage_name: "Baaba", slug: `baaba-${run}`, status: "approved" }),
    "un artiste ne peut pas s'auto-valider");
  const a = ok(await c.from("artists").insert({
    owner_id: ctx.artistUser.id, stage_name: "Baaba Pulaar", slug: `baaba-${run}`,
    bio: "Rappeur du Fouta", social_links: { instagram: "https://instagram.com/baaba" }, genres: ["rap pulaar"],
  }).select().single());
  assert.equal(a.status, "pending");
  ctx.artistId = a.id;

  // Pas encore validé : pas d'album possible, invisible du public.
  fails(await c.from("albums").insert({ artist_id: a.id, title: "Trop tôt" }));
  assert.equal(ok(await anon.from("artists").select("id").eq("id", a.id)).length, 0);

  ok(await ctx.admin.client.from("artists").update({ status: "approved" }).eq("id", a.id));
  const p = ok(await c.from("profiles").select("role").eq("id", ctx.artistUser.id).single());
  assert.equal(p.role, "artist");
  assert.equal(ok(await anon.from("artists").select("id").eq("id", a.id)).length, 1);
});

test("dépôt des fichiers audio : seul l'artiste écrit dans son dossier", async () => {
  const path = `${ctx.artistId}/single-${run}.mp3`;
  ok(await ctx.artistUser.client.storage.from("audio").upload(path, mp3));
  fails(await ctx.fan.client.storage.from("audio").upload(`${ctx.artistId}/pirate-${run}.mp3`, mp3));
  ctx.audioPath = path;
  for (const name of ["album", "payant", "precommande"]) {
    ok(await ctx.artistUser.client.storage.from("audio").upload(`${ctx.artistId}/${name}-${run}.mp3`, mp3));
  }
});

test("catalogue : brouillon, soumission, validation admin", async () => {
  const c = ctx.artistUser.client;
  const A = ctx.artistId;

  const free = ok(await c.from("albums").insert({ artist_id: A, title: "Fouta Blues", genre: "rap pulaar", release_date: inDays(-10) }).select().single());
  const paid = ok(await c.from("albums").insert({ artist_id: A, title: "Album Payant", access_mode: "purchase", price_xof: 5000, release_date: inDays(-1) }).select().single());
  const pre = ok(await c.from("albums").insert({ artist_id: A, title: "Bientôt", access_mode: "purchase", price_xof: 4000, preorder_enabled: true, preorder_price_xof: 3000, release_date: inDays(30) }).select().single());
  Object.assign(ctx, { freeAlbum: free.id, paidAlbum: paid.id, preAlbum: pre.id });

  const mk = (album_id, title, file) => c.from("tracks").insert({
    artist_id: A, album_id, title, duration_seconds: 180, genre: "rap pulaar",
    audio_path: `${A}/${file}-${run}.mp3`, status: "pending",
  }).select().single();
  ctx.freeTrack = ok(await mk(free.id, "Jam Tan", "album")).id;
  ctx.paidTrack = ok(await mk(paid.id, "Titre payant", "payant")).id;
  ctx.preTrack = ok(await mk(pre.id, "Avant-première", "precommande")).id;

  fails(await c.from("tracks").update({ status: "approved" }).eq("id", ctx.freeTrack), "l'artiste ne valide pas lui-même");
  assert.equal(ok(await anon.from("tracks").select("id").eq("id", ctx.freeTrack)).length, 0, "invisible avant validation");

  for (const id of [free.id, paid.id, pre.id]) ok(await ctx.admin.client.from("albums").update({ status: "approved" }).eq("id", id));
  for (const id of [ctx.freeTrack, ctx.paidTrack, ctx.preTrack]) ok(await ctx.admin.client.from("tracks").update({ status: "approved" }).eq("id", id));

  const t = ok(await anon.from("tracks").select("id, reviewed_by").eq("id", ctx.freeTrack).single());
  assert.equal(t.reviewed_by, ctx.admin.id);

  // Un autre compte ne peut pas modifier le catalogue de l'artiste.
  const r = await ctx.fan.client.from("tracks").update({ title: "Piraté" }).eq("id", ctx.freeTrack).select();
  assert.equal(r.data?.length ?? 0, 0);
});

test("pas de téléchargement libre : l'auditeur n'accède pas au bucket audio", async () => {
  fails(await ctx.fan.client.storage.from("audio").download(`${ctx.artistId}/album-${run}.mp3`));
  fails(await ctx.fan.client.storage.from("audio").createSignedUrl(`${ctx.artistId}/album-${run}.mp3`, 60));
  fails(await anon.storage.from("audio").download(`${ctx.artistId}/album-${run}.mp3`));
});

test("droits d'écoute selon le mode d'accès", async () => {
  const can = async (u, id) => ok(await u.client.rpc("can_stream_track", { p_track_id: id }));
  assert.equal(await can(ctx.fan, ctx.freeTrack), true);
  assert.equal(await can(ctx.fan, ctx.paidTrack), false);
  assert.equal(await can(ctx.fan, ctx.preTrack), false);
  assert.equal(await can(ctx.artistUser, ctx.preTrack), true);
  assert.equal(ok(await anon.rpc("can_stream_track", { p_track_id: ctx.freeTrack })), false);
});

test("écoutes : seules les écoutes réelles comptent", async () => {
  const rec = (s) => ctx.fan.client.rpc("record_stream", { p_track_id: ctx.freeTrack, p_seconds_played: s, p_source: "album" });
  assert.equal(ok(await rec(10)), false, "moins de 30 s");
  assert.equal(ok(await rec(45)), true);
  assert.equal(ok(await rec(45)), false, "rejouée trop vite");
  assert.equal(ok(await ctx.fan2.client.rpc("record_stream", { p_track_id: ctx.freeTrack, p_seconds_played: 180 })), true);
  fails(await ctx.fan.client.rpc("record_stream", { p_track_id: ctx.paidTrack, p_seconds_played: 60 }), "titre non acheté");
  fails(await ctx.fan.client.from("streams").insert({ user_id: ctx.fan.id, track_id: ctx.freeTrack, artist_id: ctx.artistId, seconds_played: 999, counted: true }));

  const hist = ok(await ctx.fan.client.from("streams").select("id"));
  assert.equal(hist.length, 3, "chacun ne voit que son historique");
});

test("achat d'album : prix fixé en base, paiement confirmé par le serveur, 85/15", async () => {
  fails(await ctx.fan.client.from("orders").insert({ user_id: ctx.fan.id, kind: "album_purchase", album_id: ctx.paidAlbum, amount_xof: 1, provider: "wave" }));
  const order = ok(await ctx.fan.client.rpc("create_order", { p_kind: "album_purchase", p_provider: "wave", p_album_id: ctx.paidAlbum }));
  assert.equal(order.amount_xof, 5000);
  assert.equal(order.status, "pending");

  fails(await ctx.fan.client.rpc("confirm_order_payment", { p_order_id: order.id, p_provider_reference: "x", p_amount_xof: 5000 }),
    "un client ne peut pas confirmer son propre paiement");
  fails(await server.rpc("confirm_order_payment", { p_order_id: order.id, p_provider_reference: `wave-${run}`, p_amount_xof: 100 }),
    "montant incorrect refusé");

  const paid = ok(await server.rpc("confirm_order_payment", { p_order_id: order.id, p_provider_reference: `wave-${run}`, p_amount_xof: 5000 }));
  assert.equal(paid.status, "paid");
  ok(await server.rpc("confirm_order_payment", { p_order_id: order.id, p_provider_reference: `wave-${run}`, p_amount_xof: 5000 })); // idempotent

  assert.equal(ok(await ctx.fan.client.rpc("can_stream_track", { p_track_id: ctx.paidTrack })), true);
  assert.equal(ok(await ctx.fan.client.rpc("can_download_offline", { p_track_id: ctx.paidTrack })), true);
  assert.equal(ok(await ctx.fan.client.rpc("can_download_offline", { p_track_id: ctx.freeTrack })), false, "hors ligne gratuit non autorisé");

  const ledger = ok(await ctx.artistUser.client.from("revenue_ledger").select("*").eq("order_id", order.id));
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].artist_share_xof, 4250);
  assert.equal(ledger[0].platform_share_xof, 750);
  assert.equal(ok(await ctx.fan.client.from("revenue_ledger").select("id")).length, 0, "un auditeur ne voit pas les revenus");

  fails(await ctx.fan.client.rpc("create_order", { p_kind: "album_purchase", p_provider: "wave", p_album_id: ctx.paidAlbum }), "déjà acheté");
});

test("précommande : écoute avant la sortie officielle", async () => {
  fails(await ctx.fan2.client.rpc("create_order", { p_kind: "album_purchase", p_provider: "orange_money", p_album_id: ctx.preAlbum }), "pas encore sorti");
  const o = ok(await ctx.fan2.client.rpc("create_order", { p_kind: "album_preorder", p_provider: "orange_money", p_album_id: ctx.preAlbum }));
  assert.equal(o.amount_xof, 3000);
  ok(await server.rpc("confirm_order_payment", { p_order_id: o.id, p_provider_reference: `om-${run}`, p_amount_xof: 3000 }));
  assert.equal(ok(await ctx.fan2.client.rpc("can_stream_track", { p_track_id: ctx.preTrack })), true);
  assert.equal(ok(await ctx.fan.client.rpc("can_stream_track", { p_track_id: ctx.preTrack })), false);
});

test("Premium : abonnement de 30 jours et cagnotte artistes", async () => {
  const o = ok(await ctx.fan.client.rpc("create_order", { p_kind: "premium_monthly", p_provider: "wave" }));
  assert.equal(o.amount_xof, 2000);
  assert.equal(ok(await ctx.fan.client.rpc("is_premium")), false);
  ok(await server.rpc("confirm_order_payment", { p_order_id: o.id, p_provider_reference: `wave-p-${run}`, p_amount_xof: 2000 }));
  assert.equal(ok(await ctx.fan.client.rpc("is_premium")), true);
  assert.equal(ok(await ctx.fan.client.rpc("can_download_offline", { p_track_id: ctx.freeTrack })), true);
});

test("classements calculés sur les écoutes et ventes réelles", async () => {
  const top = ok(await anon.rpc("chart_top_tracks", { p_days: 7, p_limit: 10 }));
  const row = top.find((r) => r.track_id === ctx.freeTrack);
  assert.ok(row, "le titre écouté apparaît");
  assert.equal(Number(row.plays), 2);
  assert.equal(Number(row.listeners), 2);

  const artists = ok(await anon.rpc("chart_top_artists", { p_days: 7 }));
  assert.ok(artists.some((r) => r.artist_id === ctx.artistId));

  const sold = ok(await anon.rpc("chart_top_selling_albums", {}));
  assert.ok(sold.some((r) => r.album_id === ctx.paidAlbum && Number(r.sales) === 1));
  ok(await anon.rpc("chart_rising_artists", {}));
  ok(await anon.rpc("chart_trending_tracks", { p_min_plays: 1 }));

  const stats = ok(await anon.rpc("get_artist_public_stats", { p_artist_id: ctx.artistId }))[0];
  assert.equal(Number(stats.total_plays), 2);
});

test("tableau de bord artiste et retraits", async () => {
  const c = ctx.artistUser.client;
  const d = ok(await c.rpc("get_artist_dashboard", {}))[0];
  assert.equal(Number(d.earned_xof), 4250 + 2550);
  assert.equal(Number(d.albums_sold), 1);
  assert.equal(Number(d.preorders), 1);
  fails(await ctx.fan.client.rpc("get_artist_dashboard", { p_artist_id: ctx.artistId }), "revenus privés");

  fails(await c.rpc("request_withdrawal", { p_amount_xof: 5000 }), "numéro de retrait manquant");
  ok(await c.from("artist_payout_accounts").insert({ artist_id: ctx.artistId, provider: "wave", phone: "+221770000000", holder_name: "Baaba" }));
  fails(await c.rpc("request_withdrawal", { p_amount_xof: 100000 }), "solde insuffisant");
  const w = ok(await c.rpc("request_withdrawal", { p_amount_xof: 5000 }));
  assert.equal(w.status, "requested");
  const d2 = ok(await c.rpc("get_artist_dashboard", {}))[0];
  assert.equal(Number(d2.available_xof), 6800 - 5000);

  fails(await c.from("withdrawals").update({ status: "paid" }).eq("id", w.id).select().single(), "l'artiste ne valide pas son retrait");
  const done = ok(await ctx.admin.client.from("withdrawals").update({ status: "paid", provider_reference: "wave-out-1" }).eq("id", w.id).select().single());
  assert.equal(done.processed_by, ctx.admin.id);
});

test("administration : statistiques réservées aux admins", async () => {
  fails(await ctx.fan.client.rpc("admin_platform_stats"));
  const s = ok(await ctx.admin.client.rpc("admin_platform_stats"))[0];
  assert.ok(Number(s.users) >= 4);
  assert.ok(Number(s.platform_commission_xof) >= 750 + 450 + 300);
});

test("bibliothèque : favoris, playlists, abonnements, recherche, recommandations", async () => {
  const c = ctx.fan.client;
  ok(await c.from("follows").insert({ user_id: ctx.fan.id, artist_id: ctx.artistId }));
  ok(await c.from("favorite_tracks").insert({ user_id: ctx.fan.id, track_id: ctx.freeTrack }));
  fails(await c.from("favorite_tracks").insert({ user_id: ctx.fan2.id, track_id: ctx.freeTrack }), "pas pour un autre compte");

  const pl = ok(await c.from("playlists").insert({ owner_id: ctx.fan.id, title: "Mes sons Pulaar" }).select().single());
  ok(await c.from("playlist_tracks").insert({ playlist_id: pl.id, track_id: ctx.freeTrack, position: 1 }));
  assert.equal(ok(await ctx.fan2.client.from("playlists").select("id").eq("id", pl.id)).length, 0, "playlist privée");
  fails(await ctx.fan2.client.from("playlist_tracks").insert({ playlist_id: pl.id, track_id: ctx.paidTrack }));

  const res = ok(await anon.rpc("search_catalog", { p_query: "fouta" }));
  assert.ok(res.some((r) => r.kind === "album" && r.id === ctx.freeAlbum));
  const res2 = ok(await anon.rpc("search_catalog", { p_query: "avant-premiere" }));
  assert.ok(res2.some((r) => r.id === ctx.preTrack), "recherche insensible aux accents");

  const reco = ok(await c.rpc("recommend_tracks", { p_limit: 10 }));
  assert.ok(reco.length > 0);

  const radios = ok(await anon.from("radio_stations").select("slug"));
  assert.equal(radios.length, 6);
});
