# Visites privées — Cloudflare Stream

Les vidéos sont hébergées sur **Cloudflare Stream**. Les IDs se renseignent dans un seul fichier :

**`src/data/privateVisits.ts`** → objet `CLOUDFLARE_STREAM_IDS`

## Format à envoyer

Pour chaque visite, indiquez la commune (ou la clé) et l’UID Stream :

```
maisonSainteFoy → Sainte-Foy-lès-Lyon
appartementTassin → Tassin-la-Demi-Lune
villaEcully → Écully
maisonFrancheville → Francheville
proprieteCraponne → Craponne
appartementOullins → Oullins
```

L’UID se trouve dans Cloudflare → **Stream** → votre vidéo → **Video ID**.

## Fichiers locaux

Les anciens `.mov` / `.mp4` dans ce dossier ne sont **plus utilisés** par le site. Vous pouvez les supprimer pour alléger le dépôt et le déploiement Vercel.
