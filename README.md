# MON ARGENT by DIGIY ♾️ — README PAY HUD

## Vision

MON ARGENT by DIGIY est le cockpit financier transversal de DIGIYLYFE.

PAY n’est **ni une banque**, ni un **wallet custodial**, ni une **monnaie électronique**.

PAY sert à :

- lire les entrées
- lire les dépenses pro
- lire l’épargne
- lire le net
- voir les modules qui poussent le business
- voir les canaux utilisés
- aider le professionnel à décider vite et proprement

## Doctrine simple

### 1. L’argent reste chez le pro
Le client paie directement le professionnel.  
DIGIY ne garde pas les fonds.

### 2. PAY éclaire
PAY organise la lecture financière.  
Il ne “capture” pas l’argent, il montre le mouvement.

### 3. Le net d’abord
La lecture prioritaire n’est pas le décor.  
La lecture prioritaire est :

- net pro
- épargne
- disponible pro
- reste après perso visible

### 4. Lecture HUD
Le front PAY doit toujours tendre vers une lecture **2 secondes** :

- voir vite
- comprendre vite
- agir vite

### 5. Zéro démo si le rail réel existe
Le module doit lire les vraies données du rail PAY existant.  
Pas de données fictives si le backend réel est posé.

---

## Pages du module

### `index.html`
Rôle :
- page d’entrée publique
- présentation claire de la doctrine PAY
- orientation rapide vers PIN / cockpit / saisie

Objectif :
- faire comprendre PAY en quelques secondes
- préparer la logique HUD

---

### `pin.html`
Rôle :
- entrée protégée du pro
- vérification du PIN PAY
- ouverture de session terrain

Objectif :
- téléphone + PIN = accès rapide
- zéro confusion
- redirection propre vers cockpit ou saisie

Rail utilisé :
- `digiy_verify_pin`
- `session.js`

---

### `cockpit.html`
Rôle :
- lecture réelle du cockpit PAY
- vision financière synthétique
- lecture du business

Lecture prioritaire :
- net pro
- épargne du mois
- disponible pro
- reste après perso visible
- modules qui poussent le business
- canaux visibles

Rail utilisé :
- `digiy_pay_get_cockpit_by_slug`
- `digiy_pay_movements`
- `session.js`

---

### `admin.html`
Rôle :
- saisie manuelle des mouvements PAY
- lecture rapide de l’historique
- alimentation du cockpit

Types de mouvements :
- entrée
- sortie
- épargne

Rail utilisé :
- table `digiy_pay_movements`
- `session.js`

---

## Structure mentale PAY HUD

Le module doit toujours être pensé comme un **cockpit de décision**, pas comme un simple formulaire.

### Ce qu’on veut voir d’abord
- combien entre
- combien sort
- combien est protégé
- combien reste
- quel module pousse
- quel canal domine

### Ce qu’on veut éviter
- bruit visuel
- jargon inutile
- logique administrative froide
- navigation confuse
- démo parasite

---

## Langage front recommandé

Toujours privilégier un langage :

- simple
- direct
- terrain
- lisible vite
- utile au pro

Exemples d’axe :
- “Vois vite”
- “Comprends vite”
- “Agis juste”
- “Le net d’abord”
- “Le pro reste maître”
- “PAY éclaire”

Éviter :
- discours trop technique
- promesses floues
- style bancaire froid
- complexité inutile

---

## Calculs de lecture métier

### Net pro
```text
entrées pro - dépenses pro
Disponible pro
net pro - épargne du mois
Reste après perso visible
disponible pro - dépenses perso visibles
Poids de l’épargne
épargne du mois / entrées du mois
Session

Le module PAY fonctionne avec une session locale légère via session.js.

Éléments clés :

slug

phone

module = PAY

Règles :

si URL contient slug / phone, on les reprend

si session absente, retour vers pin.html

après validation PIN, sauvegarde session

après chargement cockpit ou admin, réappliquer URL propre

Backend déjà posé

Le front ne doit pas réinventer le backend si le rail existe déjà.

Rails connus

digiy_verify_pin

digiy_pay_get_cockpit_by_slug

table digiy_pay_movements

Doctrine

ne pas refaire le SQL sans bug réel prouvé

priorité au FRONT si le backend existe déjà

zéro mélange entre ancien rail et nouveau rail

Navigation croisée minimale

Toutes les pages PAY doivent garder une navigation cohérente.

Minimum attendu :

retour accueil

entrée PIN

cockpit

saisie

quitter session

Aucune page ne doit être isolée.

Règles UX PAY HUD
Règle 1

Toujours montrer d’abord l’essentiel.

Règle 2

Une action importante doit être visible sans chercher.

Règle 3

Le professionnel doit comprendre la page en quelques secondes.

Règle 4

Le formulaire doit rester simple, même si le backend est riche.

Règle 5

Le cockpit doit parler résultat, pas administration.

Identité publique

Nom public :
MON ARGENT by DIGIY

Signature possible :
MON ARGENT ELECTRONIQUE BY DIGIY
à utiliser seulement si pertinent côté façade, sans glisser vers une promesse de conservation des fonds.

Résumé frère-bâtisseur

PAY = cockpit financier terrain.
PAY = lecture utile.
PAY = décision rapide.
PAY ≠ banque.
PAY ≠ wallet custodial.
PAY = une couche de visibilité, d’orchestration et de pilotage pour les pros DIGIYLYFE.

Continuité de travail

Quand on retouche PAY :

garder le rail réel

garder la logique HUD

garder la lecture 2 secondes

garder la cohérence visuelle entre :

index.html

pin.html

cockpit.html

admin.html

ne jamais revenir à une page froide ou purement administrative

Formule courte à retenir

L’argent reste chez le pro.
PAY apporte la vue.
## Canal réel — voix, cash, dettes et imprévus

PAY ne doit pas seulement lire les mouvements déjà visibles.
PAY doit aussi permettre au professionnel de signaler rapidement les gestes du réel qui ne laissent pas toujours de trace numérique.

Exemples :
- course encaissée en espèces
- dépense carburant cash
- remboursement de dette
- facture à régler plus tard
- argent mis de côté
- médicament, hospitalisation ou urgence famille

Doctrine :
Le téléphone capte le réel.
PAY garde la mémoire.
DIGIY éclaire.
L’humain décide.

Intentions vocales prioritaires :
1. J’ai encaissé
2. J’ai dépensé
3. J’ai remboursé
4. Je mets de côté
5. Facture à régler
6. Imprévu / urgence

Règle de sécurité :
La voix ne valide jamais seule.
Elle prépare un brouillon.
Le professionnel confirme avant inscription.
