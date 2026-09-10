# Heures Pro — V45

Version PWA mobile pour le suivi des heures et de la rémunération.

## V45
- Correction du chevauchement heures/net dans les cartes mensuelles annuelles, avec mise en page mobile une carte par ligne.
- Vue annuelle filtrée sur les mois réellement travaillés (les mois vides n'apparaissent plus dans le graphique et les cartes).
- Audit complet du code du 10 septembre 2026 (voir « Corrections » ci-dessous).

## V39
- Audit et nettoyage de l’historique annuel.
- Vue annuelle complète de janvier à décembre.
- Navigation année précédente / suivante, avec blocage des années futures.
- Graphique mensuel des heures travaillées.
- Totaux annuels : heures, brut, net estimé, nuit et jours travaillés.
- Détail mensuel : heures, brut et net.
- Historique quotidien conservé avec ouverture/modification et suppression.
- Boutons d’action de l’historique alignés à l’extrémité droite.
- Service worker et cache V39.
- Données existantes conservées via la clé de stockage historique.

## Corrections (audit du 10 septembre 2026)
- `index.html` chargeait `app.js?v=43` alors que le service worker mettait en cache `app.js?v=45` : ces deux URL étant différentes, l'app ne se remettait jamais vraiment à jour hors connexion. Aligné sur `v=45`.
- Couleur de la barre de statut (`theme-color`) incohérente avec le fond réel de l'app (`#0a0710` au lieu de `#08090d`). Corrigée.
- Règle CSS `.calday.sel` dupliquée à l'identique. Supprimée.
- Les styles des cartes mensuelles annuelles (`.annualMonthCards`, `.annualMonthCard`…) étaient redéfinis dans trois blocs `<style>` différents qui se recouvraient (restes de patches V41/V44). Fusionnés en une seule définition — aucun changement visuel, juste un code plus clair et plus léger.
- `parseHM()` avait un paramètre (`allowLongHour`) sans aucun effet réel : les deux branches faisaient exactement le même test. Nettoyé.
- Petit calcul redondant dans les réglages : l'IFM et les congés payés du mois en cours étaient recalculés deux fois de suite. Calculé une seule fois.
- Vérification complète : syntaxe, cohérence des appels de fonctions, calcul du salaire, heures de nuit (y compris horaires à cheval sur minuit), heures supplémentaires, ajout/modification/copie de journée, primes, intérim/CET — tout a été rejoué en simulation sans erreur.

## Installation
1. Remplacer les fichiers du dépôt GitHub Pages par les 7 fichiers de cette archive.
2. Recharger l’application. Si une ancienne version reste affichée, fermer l’onglet/PWA puis la rouvrir.

V45: correction du chevauchement heures/net dans les cartes mensuelles annuelles, avec mise en page mobile une carte par ligne.
