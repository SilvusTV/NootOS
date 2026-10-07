# 🐧 NootOS — NOOT NOOOOT

Votre petit monde à deux sur Discord : films, séries, jeux, idées de dates et souvenirs. NootOS prolonge BobbyBot avec un carnet partagé et un compagnon IA qui peut y lire et enregistrer ce que vous lui demandez.

## Démarrer

1. Installez Node.js **22.12 ou supérieur**, puis lancez `npm ci`.
2. Copiez `.env.example` vers `.env` (`Copy-Item .env.example .env` dans PowerShell).
3. Renseignez `DISCORD_TOKEN` et, de préférence, `GUILD_ID`, l’identifiant de NOOT NOOOOT. Gardez vos clés dans ce fichier local.
4. Dans le [portail Discord](https://discord.com/developers/applications), activez **Message Content Intent** et **Server Members Intent** dans l’onglet Bot (la base utilise ces intents).
5. Invitez NootOS avec les scopes `bot` et `applications.commands`. Permissions du bot : **Voir les salons**, **Envoyer des messages**, **Intégrer des liens**, **Joindre des fichiers**, **Lire l’historique des messages** et **Gérer les salons** pour l’installation.
6. Lancez `npm run build`, puis `npm start` (ou `npm run dev`).
7. Dans Discord, lancez `/installer`, puis `/aide`.

`/installer` crée une catégorie NOOT NOOOOT avec les salons nootos, films, series, jeux, musique, videos, dates, idees et souvenirs. Une nouvelle exécution réutilise les salons présents et conserve les salons déjà configurés. Les deux membres peuvent utiliser les commandes sans rôle administrateur ; NootOS a besoin de ses propres permissions Discord.

Avec `GUILD_ID`, les commandes sont publiées directement sur votre serveur et les interactions ailleurs sont refusées. Sans cette variable, elles sont globales et leur apparition peut prendre du temps. Donnez le nom **NootOS** à l’application dans le portail Discord : `DISCORD_BOT_NAME` modifie seulement les logs. Le programme doit rester lancé pour que NootOS réponde.

## Le carnet

| Commande | Usage |
| --- | --- |
| `/carnet ajouter type recherche` | Chercher une œuvre par nom ou lien via TMDB, Steam ou YouTube, choisir le résultat puis confirmer l’ajout et la publication. Les dates et idées sont ajoutées librement. |
| `/carnet config type salon` | Choisir le salon où publier les nouvelles fiches d’une catégorie. |
| `/carnet voter id` | Ajouter ou retirer un vote sur une œuvre trouvée par la recherche. |
| `/carnet delete id` | Après confirmation, supprimer une fiche, tous ses avis et votes et les messages publiés dont l’emplacement est connu. |
| `/carnet liste` | Filtrer par catégorie, statut ou titre ; 15 fiches par page. |
| `/carnet fiche id` | Lire les détails et les huit derniers avis individuels. |
| `/carnet avis id note retour date` | Garder votre note sur 5, votre ressenti et sa date. Tous les champs après l’identifiant sont facultatifs. |
| `/carnet statut id valeur` | Passer une fiche de « À faire » à « En cours » ou « Terminé ». |
| `/carnet hasard` | Piocher une envie avec un filtre de catégorie facultatif. |
| `/carnet export` | Télécharger toutes vos fiches et tous vos avis en JSON. |
| `/noot message texte vocal` | Parler à NootOS ou joindre un fichier audio. |
| `/noot oublier` | Effacer votre mémoire de conversation dans le salon actuel. |

Toutes les commandes utilisent maintenant les identifiants du carnet, par exemple #12. Les anciennes commandes `/reco`, `/recos`, `/recoconfig`, `/supprimerreco` et `/upvotereco` ne sont plus publiées. Les données BobbyBot sont conservées et reprises dans `/carnet liste`.

Exemples : `/carnet ajouter type:Film recherche:Dune`, `/carnet ajouter type:Jeu recherche:https://store.steampowered.com/app/620/`, ou `/carnet ajouter type:Sortie recherche:Pique-nique details:Au lac, budget 20 €`. L’option `lien` prend la priorité sur le nom pour rechercher une œuvre. `libre:true` permet de conserver manuellement une œuvre hors catalogue, sans appeler les services de recherche. L’ajout libre publie immédiatement une fiche ; la recherche propose un aperçu et demande confirmation. Le salon configuré est utilisé, sinon la fiche est publiée dans le salon de la commande. Une publication libre qui échoue laisse la fiche enregistrée et le signale explicitement.

Les fiches recherchées conservent l’affiche, l’année, le lien et les autres métadonnées disponibles. Les détails personnels sont conservés lors de la sélection et de la confirmation. Une œuvre déjà enregistrée par son identifiant externe n’est pas ajoutée à nouveau. Les ajouts libres sont indépendants et ne bénéficient pas de cette détection par identifiant externe.

Chacun garde sa propre note, éventuellement décimale (4,5/5). Un avis du même auteur, pour la même fiche et la même date, corrige l’entrée existante ; une nouvelle date crée un nouveau souvenir. Sans note, elle reste vide. Sans date, on utilise aujourd’hui en Europe/Paris (modifiable avec `NOOT_TIMEZONE`). Un avis ne change pas automatiquement le statut commun, car chacun peut voir l’œuvre à son rythme.

Les anciennes recos sont copiées dans le carnet au démarrage, puis à chaque consultation. L’import est répétable et préserve les originaux. Supprimer une ancienne reco ne supprime pas son souvenir dans le carnet. Les commandes de maintenance et de modération héritées du kernel ne sont plus chargées dans NootOS.

`/carnet delete` peut être utilisé par chacun de vous, avec un bouton de confirmation valable cinq minutes et réservé à la personne qui lance la commande. La suppression retire aussi la reco source pour empêcher sa réimportation. Si un message est déjà supprimé, la suppression du carnet continue ; si Discord refuse l’accès ou la suppression, la fiche et ses avis restent conservés pour réessayer. Les messages des anciennes fiches libres, publiés avant le suivi de leur emplacement, peuvent nécessiter une suppression manuelle. Les nouveaux messages libres sont désormais suivis automatiquement.

## Discuter et envoyer des vocaux

Ajoutez `OPENAI_API_KEY` dans `.env`, puis redémarrez. Le carnet manuel fonctionne sans OpenAI. Modèles configurables :

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
NOOT_TIMEZONE=Europe/Paris
```

Dans le salon nootos, écrivez naturellement ou envoyez un message vocal. Vous pouvez aussi mentionner le bot ailleurs ou utiliser `/noot message` :

- « Ajoute une balade au bord du lac dans nos idées de dates, budget 20 euros. »
- « J’ai vu Dune hier, 8/10. Magnifique, mais un peu long. Enregistre mon avis. »
- « Propose une série courte et légère selon nos envies et nos avis. »
- « Passe la fiche #12 en terminé. »

Les fichiers OGG, MP3, WAV, M4A, WEBM, MP4, MPEG et MPGA joints directement à Discord sont acceptés, jusqu’à 24 Mo. Ce sont des **messages vocaux ou fichiers audio envoyés**, pas une écoute de salon vocal en direct. Leur transcription passe par les mêmes actions que le texte.

NootOS cherche dans les fiches et avis pour personnaliser ses suggestions. Il peut ajouter une fiche, enregistrer votre propre avis ou changer un statut commun. Son accès à la base passe par des fonctions limitées et validées ; aucun SQL libre ni suppression. Il est guidé pour demander une précision si le titre est ambigu. L’interprétation IA peut se tromper : consultez les fiches et corrigez vos avis avec `/carnet avis`.

NootOS n’a pas de recherche Internet dans sa conversation IA : vérifiez les adresses, tarifs, horaires et disponibilités des sorties suggérées. La recherche de `/carnet ajouter` utilise `TMDB_API_TOKEN` pour films/séries, `YOUTUBE_API_KEY` pour vidéos/musique ; Steam fonctionne sans clé dans ce projet.

Les messages adressés à NootOS, les vocaux transcrits et les résultats du carnet consultés sont transmis à OpenAI. Responses utilise `store: false`. Les six derniers échanges sont conservés localement par personne et par salon. `/noot oublier` efface cette mémoire locale, pas les fiches ni les avis. L’API a sa propre facturation : vérifiez le crédit et le budget du projet associé à votre clé. Documentation : [actions par fonctions](https://developers.openai.com/api/docs/guides/function-calling), [transcription audio](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create).

## Visuels

- [Icône NootOS](assets/branding/nootos-avatar.png) : pingouin en pâte à modeler tenant un écran glacé avec un cœur.
- [Bannière NOOT NOOOOT](assets/branding/noot-noooot-banner.png) : deux pingouins pour une soirée film sur la banquise.
- [Prompts et génération](assets/branding/PROMPTS.md).

Importez l’icône dans le portail Discord pour le bot, ou comme icône du serveur. La bannière peut servir de visuel d’accueil ; l’option de bannière native dépend des fonctionnalités de votre serveur. Les images ne sont pas téléversées automatiquement.

## Données et vérification

SQLite conserve les données dans `DB_LOCATION` (par défaut `DB/bot.db`). Les tables NootOS sont ajoutées sans supprimer les tables BobbyBot. Pour une sauvegarde complète, arrêtez le bot puis copiez la base. `/carnet export` fournit toutes les fiches et tous les avis, sans la mémoire de conversation. La base et `.env` sont ignorés par Git. Aucun écran web ni hébergement automatique n’est inclus.

```powershell
npm test
npm run build
npm start
```

Les tests utilisent une base temporaire et des réponses OpenAI simulées : avis individuels, corrections, persistance, import, export, mémoire, actions IA et pièces jointes vocales. Une validation réelle Discord/OpenAI nécessite vos clés.

## Crédit

NootOS est adapté du kernel et de BobbyBot créés par **Silvus_tv / Silvus**. La licence ISC et le fichier LICENSE sont conservés.
