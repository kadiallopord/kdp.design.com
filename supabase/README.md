# SAMMEERE JIME — backend Supabase (première version)

Base de données, règles d'accès et stockage pour l'application SAMMEERE JIME.
Tout est en SQL versionné dans `migrations/`, testé de bout en bout sur un
Supabase local (`tests/parcours.test.mjs`, 15 scénarios).

## Contenu

| Fichier | Rôle |
|---|---|
| `migrations/…100000_comptes_et_roles.sql` | Profils créés à l'inscription, rôles auditeur / artiste / admin, paramètres de la plateforme |
| `migrations/…100100_catalogue.sql` | Artistes, albums, titres, vidéos, radios (6 stations), abonnements aux artistes, favoris, playlists, recherche |
| `migrations/…100200_ventes_et_revenus.sql` | Commandes, achats, précommandes, Premium, registre 85/15, retraits artistes |
| `migrations/…100300_ecoutes_classements.sql` | Droits d'écoute, journal des écoutes, classements, statistiques, recommandations, répartition Premium |
| `migrations/…100400_stockage_medias.sql` | Buckets `audio` et `videos` privés, `images` public |
| `functions/stream-url/` | Edge Function qui délivre une URL d'écoute temporaire après vérification des droits |
| `tests/` | Tests de bout en bout (Node + supabase-js) |

## Rôles

- **Auditeur** (`listener`) : rôle par défaut à l'inscription.
- **Artiste** (`artist`) : un auditeur dépose sa fiche artiste (statut « pending ») ; dès qu'un admin la valide, le compte devient artiste et peut proposer titres, albums et vidéos.
- **Admin** (`admin`) : valide les contenus, gère utilisateurs, radios, retraits, paramètres. Personne ne peut se donner un rôle lui-même. Le premier admin se nomme dans l'éditeur SQL Supabase :
  `update public.profiles set role = 'admin' where id = '<uuid du compte>';`

## Validation des contenus

Artistes, albums, titres et vidéos passent par `draft → pending → approved | rejected`.
Seul un admin peut mettre `approved` ou `rejected` (vérifié en base, pas seulement dans l'app).
Le public ne voit que le contenu validé.

## Écoute et « pas de téléchargement libre »

- Les fichiers audio sont dans un bucket **privé**. Un auditeur ne peut ni les lister, ni les télécharger, ni créer de lien.
- Le lecteur appelle `POST /functions/v1/stream-url { track_id }`. La fonction vérifie `can_stream_track()` puis renvoie une URL signée valable 10 minutes (qualité améliorée pour les Premium).
- `mode: "offline"` : réservé aux Premium et aux acheteurs (`can_download_offline()`). L'app doit garder le fichier chiffré dans son stockage interne.
- Qui peut écouter (`access_mode` de l'album, sinon du titre) :
  - `free` : tout compte connecté ;
  - `premium` : abonnés Premium et acheteurs ;
  - `purchase` : acheteurs seulement.
  - Avant la date de sortie : seulement ceux qui ont précommandé.

## Classements (statistiques réelles)

Chaque lecture appelle `record_stream(track_id, secondes_écoutées, source)`. Une écoute compte si
elle dure au moins 30 s, n'est pas rejouée plus vite que la durée du titre, ne vient pas de
l'artiste lui-même, et dans la limite de 20 par jour, par auditeur et par titre.

Fonctions publiques : `chart_top_tracks`, `chart_top_artists`, `chart_rising_artists`,
`chart_trending_tracks`, `chart_top_selling_albums`, `get_artist_public_stats`, `search_catalog`.
Pour l'auditeur connecté : `recommend_tracks`.

## Argent : achats, précommandes, Premium, 85/15

1. L'app appelle `create_order(kind, provider, album_id)` : **le prix est lu en base**, jamais envoyé par l'app.
2. L'app redirige vers Wave ou Orange Money *(intégration à faire, voir plus bas)*.
3. Le webhook du fournisseur appelle `confirm_order_payment(order_id, référence, montant)` avec la clé `service_role`. La fonction vérifie le montant, accorde l'accès permanent (ou 30 jours de Premium) et écrit le partage dans `revenue_ledger` : 85 % artiste, 15 % SAMMEERE JIME. Elle est idempotente.
4. Premium : 85 % des abonnements vont dans une cagnotte, répartie chaque mois entre artistes au prorata des écoutes Premium (`distribute_premium_pool(mois)`).
5. Retraits : l'artiste enregistre son numéro Wave / Orange Money, puis `request_withdrawal(montant)` (vérifie le solde). Un admin passe le retrait à `paid` ou `rejected`.

Tableau de bord artiste : `get_artist_dashboard()`. Tableau de bord admin : `admin_platform_stats()`.

## Suppositions à valider

1. **Écoute gratuite par défaut** : un album en mode `free` s'écoute par tout compte connecté (avec publicité pour les non-Premium). L'artiste peut choisir `premium` ou `purchase`.
2. **Prix Premium : 2 000 FCFA / mois**, retrait minimum 5 000 FCFA. Modifiables dans `platform_settings`.
3. **Le hors ligne** est réservé aux Premium et aux acheteurs.
4. **Les revenus et l'historique des ventes** d'un artiste sont privés (artiste + admins). Le nombre d'écoutes et d'abonnés est public.
5. **Les abonnés Premium** ne financent pas les ventes d'albums : un Premium paie quand même un album en mode `purchase`.
6. **Pour un titre déjà validé**, une modification par l'artiste ne repasse pas en validation (à durcir si besoin).
7. Les montants sont en **XOF entiers**. L'arrondi du partage 85/15 se fait en faveur de la plateforme (au franc près).

## Pas encore fait (prochaines étapes)

- Edge Functions de paiement **Wave** et **Orange Money** (création de session + webhook signé qui appelle `confirm_order_payment`). Il faut les comptes marchands.
- Annonces, actualités des artistes et notifications push (espace communauté).
- Diffusion audio en HLS chiffré pour durcir la protection contre la copie.
- L'Edge Function `stream-url` est écrite mais n'a pas pu être lancée ici : l'image d'exécution n'était pas téléchargeable depuis l'environnement de test. À tester au premier déploiement.

## Lancer en local

```bash
npx supabase start            # nécessite Docker
npx supabase db reset         # applique les migrations
cd supabase/tests && npm install
eval $(npx supabase status -o env | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|API_URL)=')
SUPABASE_URL=$API_URL SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY npm test
```

## Déployer sur un projet Supabase

```bash
npx supabase link --project-ref <ref-du-projet>
npx supabase db push
npx supabase functions deploy stream-url
```

Dans le tableau de bord Supabase : activer la connexion par e-mail et, si souhaité, par téléphone (SMS) pour le Sénégal.
