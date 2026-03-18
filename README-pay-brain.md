# PAY BRAIN — Moule vierge officiel DIGIY PAY

Ce fichier sert de cerveau financier simple pour le cockpit PAY.

Le but n’est pas de faire de la comptabilité compliquée.
Le but est de protéger la base du professionnel, éviter les erreurs financières, et aider à décider au bon moment.

---

## Fichiers du pack

- `pay-brain.template.json` → moule vierge officiel
- `pay-brain.demo.json` → exemple pédagogique
- `pay-brain.json` → fichier réellement utilisé par le cockpit

Pour créer un nouvel abo :
1. copier `pay-brain.template.json`
2. renommer en `pay-brain.json`
3. remplir progressivement les champs utiles

---

## Structure générale

### 1. currency
Devise utilisée par le cockpit.

Exemple :
```json
"currency": "XOF"
