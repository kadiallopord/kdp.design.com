# SAMMEERE JIME

**Écoutez • Regardez • Découvrez**

Application mobile (Android / iOS) de streaming musical et culturel consacrée à la musique africaine, en particulier la musique et le rap Pulaar. Construite avec Expo (SDK 58), React Native et Expo Router.

## Ce que contient la version 0.1

| Écran | Fonctionnel aujourd'hui |
| --- | --- |
| **Accueil** | Bannière « sortie exclusive », recherche, recommandations personnalisées, nouveautés, albums populaires, artistes recommandés, clips récents, tendances, sorties exclusives |
| **Musique** | Tous les titres, albums, playlists (créer, renommer, supprimer, ajouter / retirer des titres), favoris |
| **Radio** | 6 stations (Sammeere Jime, Rap Pulaar, Sénégal, Afrique, Afrobeat, Musique traditionnelle), émission en cours et grille du jour |
| **Vidéos** | Clips, exclusivités, interviews, événements, avec lecteur vidéo (plein écran, image dans l'image) |
| **Classements** | Top 10 titres, Top 10 artistes, artistes en progression, albums les plus vendus, tendances de la semaine |
| **Profil** | Statistiques d'écoute, écoutés récemment, artistes suivis |
| **Lecteur** | Lecture / pause, suivant / précédent, barre de progression, aléatoire, répétition, file d'attente, mini‑lecteur permanent, **écoute en arrière-plan** et contrôles sur l'écran verrouillé |
| **Album / Artiste** | Pages détaillées, bouton Suivre, biographie, réseaux sociaux, prix et précommande |

Favoris, playlists, abonnements et historique d'écoute sont **enregistrés sur l'appareil** (AsyncStorage) et survivent à la fermeture de l'app.

## Suppositions (à valider)

1. **Catalogue fictif.** Les artistes, albums et titres sont inventés pour la démonstration. Les sons sont des échantillons libres (SoundHelix) et les vidéos des clips de test Google. Ils seront remplacés par les vrais contenus.
2. **Radios.** Les flux pointent vers des fichiers de test. Il faut les vraies URL de diffusion (Icecast/Shoutcast) de chaque station.
3. **Classements.** Calculés à partir des écoutes de démonstration + des écoutes réelles faites sur l'appareil. Les vrais chiffres globaux viendront du serveur.
4. **Pochettes générées** (dégradé + initiales) en attendant les vraies images.
5. **Pas encore de compte ni de paiement.** Connexion, Premium, hors ligne, achats Wave / Orange Money, espace artiste et administration sont prévus pour les étapes suivantes (boutons visibles mais désactivés).
6. **Identifiant de l'app** : `com.sammeerejime.app` (modifiable avant publication sur les stores).
7. **Prix d'exemple** en FCFA, répartition 85 % artiste / 15 % plateforme affichée.

## Lancer l'application

```bash
npm install
npx expo start        # puis scanner le QR code
```

L'écoute en arrière-plan et les contrôles de l'écran verrouillé nécessitent un **build de développement** (pas Expo Go) :

```bash
npx expo run:android   # ou run:ios
# ou dans le cloud : npx eas-cli@latest build --profile development
```

Vérifications : `npx tsc --noEmit`.

## Organisation du code

```
src/
  app/                 écrans (Expo Router)
    (tabs)/            Accueil, Musique, Radio, Vidéos, Classements, Profil
    lecteur.tsx        lecteur plein écran
    album/ artiste/ playlist/ video/ ajouter/ recherche.tsx
  components/          éléments d'interface réutilisables
  data/                catalogue de démonstration, classements, recommandations
  state/               lecteur audio et bibliothèque (favoris, playlists…)
  theme/               couleurs noir / or / blanc
```

## Prochaines étapes proposées

1. Backend (Supabase ou équivalent) : comptes, base de données, stockage des fichiers audio et vidéo.
2. Paiements Wave et Orange Money, achats, précommandes, Premium.
3. Mode hors ligne chiffré (sans téléchargement libre des fichiers).
4. Espace artiste (dépôt de titres, revenus 85 / 15, retraits) et tableau de bord administrateur.
5. Communauté et notifications.
