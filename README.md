# Heures Pro — V39

Version PWA mobile pour le suivi des heures et de la rémunération.

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

## Installation
1. Remplacer les fichiers du dépôt GitHub Pages par les 7 fichiers de cette archive.
2. Recharger l’application. Si une ancienne version reste affichée, fermer l’onglet/PWA puis la rouvrir.

V46: correction du chevauchement heures/net dans les cartes mensuelles annuelles, avec mise en page mobile une carte par ligne.


V46 : calcul salaire refait selon la formule fournie : base 13,78 €/h, 13e mois 1,84 €/h sur heures normales, équipe 14,50 €/j + 0,47 €/j, habillage 3,50 €/j, nuit 13,78 €/h + 1,93 €/h, majoration nuit 6,89 €/h + 0,91 €/h. Panier 7,50 €/j ajouté directement au net et exclu du brut. Les jours équipe et panier sont modifiables par mois.
