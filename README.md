# MON ARGENT by DIGIY ♾️

Cockpit financier transversal de l’écosystème DIGIYLYFE.

## Doctrine

MON ARGENT by DIGIY n’est pas une banque.
MON ARGENT by DIGIY n’est pas une monnaie électronique.
MON ARGENT by DIGIY ne garde pas les fonds.

Le rôle de PAY est de **piloter**, **organiser** et **rendre visible** les flux financiers utiles du professionnel.

Le paiement reste direct au professionnel.

---

## Structure des fichiers

### `index.html`
Vitrine publique de PAY.

But :
- présenter la doctrine
- expliquer la promesse
- diriger vers l’entrée PIN, le cockpit ou la saisie

Ce fichier n’est **pas** un cockpit.
Ce fichier n’est **pas** un admin.

---

### `pin.html`
Entrée protégée du professionnel.

But :
- demander téléphone + PIN
- vérifier l’accès PAY
- retrouver le slug réel du module PAY
- ouvrir la session
- rediriger vers `cockpit.html`

Ce fichier ne doit pas contenir de logique cockpit complète.

---

### `cockpit.html`
Vrai cockpit PAY.

But :
- lire les vraies données du backbone PAY
- afficher :
  - entrées
  - dépenses pro
  - net
  - épargne
  - répartition par module
  - répartition par canal
- ne rien inventer en local
- ne pas écrire directement les mouvements

Le cockpit doit lire le rail réel :

- `public.digiy_pay_get_cockpit_by_slug(p_slug)`

---

### `admin.html`
Page de saisie manuelle.

But :
- ajouter des mouvements
- piloter la partie opérationnelle manuelle PAY
- rester séparée du cockpit

Ne pas mélanger `admin.html` avec `cockpit.html`.

---

## Source de vérité

Le cockpit PAY doit rester branché au backbone réel DIGIY.

Rail principal attendu :
- `digiy_pay_get_cockpit_by_slug`

Session attendue :
- `slug`
- `phone`
- `module = PAY`

Stockage session front :
- `digiy_pay_session`
- éventuellement `digiy_session`

---

## Règle d’or

Ne plus refaire un faux cockpit local branché seulement sur une table front.

Le bon découpage est :

- `index.html` = vitrine
- `pin.html` = entrée sécurisée
- `cockpit.html` = lecture réelle
- `admin.html` = saisie manuelle

---

## Flux normal

1. Le pro arrive sur `index.html`
2. Il ouvre `pin.html`
3. Son PIN PAY est vérifié
4. Le slug PAY réel est récupéré
5. La session est enregistrée
6. Redirection vers `cockpit.html`
7. Le cockpit lit les vraies données via RPC

---

## Positionnement public

Signature :
**MON ARGENT by DIGIY**
ou
**MON ARGENT PRO — Cockpit DIGIY**

Promesse :
- lecture claire
- paiement direct
- 0% commission
- pilotage utile terrain

---

## Important

Si un fichier mélange :
- vitrine
- PIN
- cockpit
- admin

alors on retombe dans la confusion.

La couture propre du module PAY repose sur la séparation claire des rôles.
