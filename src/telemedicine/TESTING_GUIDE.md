# Guide de Test - Module Télémédecine

## Prérequis

1. ✅ Backend en cours d'exécution sur `http://localhost:3000`
2. ✅ MongoDB connecté
3. ✅ Compte utilisateur avec rôle DOCTOR et PATIENT
4. ✅ Token JWT valide

---

## Méthode 1 : Test avec Postman (Recommandé)

### Étape 1 : Importer la collection

1. Ouvrir Postman
2. Cliquer sur "Import"
3. Sélectionner le fichier : `Backend_Medifollow/src/telemedicine/Telemedicine_API.postman_collection.json`
4. La collection "Medifollow - Télémédecine API" apparaît

### Étape 2 : Configurer les variables

1. Cliquer sur la collection
2. Onglet "Variables"
3. Définir :
   - `baseUrl` : `http://localhost:3000`
   - `token` : Votre JWT token (voir ci-dessous pour l'obtenir)

### Étape 3 : Obtenir un token JWT

**Option A : Via Postman**
```
POST http://localhost:3000/api/signin
Body (JSON):
{
  "email": "fethi@gmail.com",
  "password": "Fethi@123"
}

Réponse : Copier le "access_token"
```

**Option B : Via curl**
```bash
curl -X POST http://localhost:3000/api/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"fethi@gmail.com","password":"Fethi@123"}'
```

### Étape 4 : Obtenir les IDs nécessaires

**Lister les utilisateurs pour obtenir patientId et doctorId :**
```bash
npm run list-users
```

Ou via API :
```
GET http://localhost:3000/users
Authorization: Bearer YOUR_TOKEN
```

---

## Méthode 2 : Test avec curl (Ligne de commande)

### 1. Obtenir un token
```bash
curl -X POST http://localhost:3000/api/signin \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"fethi@gmail.com\",\"password\":\"Fethi@123\"}"
```

Sauvegarder le token dans une variable :
```bash
TOKEN="votre_token_ici"
```

### 2. Créer une consultation
```bash
curl -X POST http://localhost:3000/consultations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"patientId\": \"PATIENT_ID\",
    \"doctorId\": \"DOCTOR_ID\",
    \"type\": \"scheduled\",
    \"scheduledAt\": \"2026-04-10T10:00:00Z\",
    \"reason\": \"Consultation de suivi\"
  }"
```

### 3. Lister les consultations
```bash
curl -X GET "http://localhost:3000/consultations?status=pending" \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Créer une prescription
```bash
curl -X POST http://localhost:3000/prescriptions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"consultationId\": \"CONSULTATION_ID\",
    \"medications\": [
      {
        \"name\": \"Doliprane 1000mg\",
        \"dosage\": \"1000mg\",
        \"frequency\": \"3 fois par jour\",
        \"duration\": \"5 jours\",
        \"instructions\": \"À prendre pendant les repas\"
      }
    ]
  }"
```

### 5. Upload un document
```bash
curl -X POST http://localhost:3000/medical-documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "patientId=PATIENT_ID" \
  -F "type=lab-result" \
  -F "title=Analyse de sang" \
  -F "description=Bilan sanguin complet"
```

---

## Méthode 3 : Script de test automatique

J'ai créé un script Node.js pour tester automatiquement tous les endpoints.

### Utilisation :
```bash
cd Backend_Medifollow
npm run test:telemedicine
```

Le script va :
1. Se connecter avec un compte
2. Créer une consultation
3. Démarrer la consultation
4. Créer une prescription
5. Émettre la prescription
6. Upload un document
7. Terminer la consultation
8. Afficher tous les résultats

---

## Méthode 4 : Test via l'interface Swagger (À venir)

Si vous voulez ajouter Swagger pour une documentation interactive :

```bash
npm install @nestjs/swagger swagger-ui-express
```

Puis accéder à : `http://localhost:3000/api`

---

## Scénarios de Test Complets

### Scénario 1 : Consultation Simple

1. **Créer consultation** → Vérifier email de confirmation
2. **Lister consultations du médecin** → Voir la nouvelle consultation
3. **Démarrer consultation** → Status passe à "in-progress"
4. **Terminer consultation** → Status passe à "completed", email envoyé

### Scénario 2 : Consultation avec Prescription

1. **Créer consultation**
2. **Démarrer consultation**
3. **Créer prescription** (status: draft)
4. **Émettre prescription** → QR code généré, email envoyé
5. **Rechercher par QR code** → Retrouver la prescription
6. **Terminer consultation**

### Scénario 3 : Gestion de Documents

1. **Upload document** → Vérifier Cloudinary, email envoyé
2. **Lister documents du patient**
3. **Partager document** avec un médecin
4. **Consulter document partagé**
5. **Supprimer document** → Vérifier suppression Cloudinary

### Scénario 4 : Workflow Complet

1. **Patient** : Upload documents médicaux avant consultation
2. **Médecin** : Consulte les documents
3. **Médecin** : Crée et démarre la consultation
4. **Médecin** : Crée une prescription pendant la consultation
5. **Médecin** : Émet la prescription (signature)
6. **Médecin** : Termine la consultation avec notes
7. **Patient** : Reçoit email avec résumé et prescription
8. **Pharmacien** : Scanne le QR code pour délivrer

---

## Vérifications Importantes

### ✅ Emails
Vérifier que les emails sont envoyés à :
- Création de consultation
- Prescription émise
- Document uploadé
- Consultation terminée

**Note** : Les emails utilisent Gmail. Vérifier les spams si non reçus.

### ✅ Cloudinary
1. Se connecter à Cloudinary : https://cloudinary.com
2. Aller dans "Media Library"
3. Vérifier le dossier "medical-documents"
4. Les fichiers uploadés doivent apparaître

### ✅ MongoDB
Vérifier les collections :
- `consultations`
- `prescriptions`
- `medicaldocuments`

```bash
# Via MongoDB Compass ou CLI
use db_medifollow
db.consultations.find().pretty()
db.prescriptions.find().pretty()
db.medicaldocuments.find().pretty()
```

---

## Résolution de Problèmes

### Erreur : "Invalid patient or doctor ID"
→ Vérifier que les IDs sont des ObjectIds MongoDB valides (24 caractères hexadécimaux)

### Erreur : "Unauthorized"
→ Le token JWT a expiré ou est invalide. Se reconnecter.

### Erreur : "Consultation not found"
→ Vérifier que la consultation existe avec l'ID correct

### Emails non reçus
→ Vérifier :
1. `.env` : MAIL_USER et MAIL_PASS corrects
2. Gmail : Autoriser les applications moins sécurisées
3. Vérifier les spams

### Upload échoue
→ Vérifier :
1. `.env` : Credentials Cloudinary corrects
2. Taille du fichier < 10MB
3. Format supporté (PDF, JPG, PNG, etc.)

---

## Commandes Utiles

```bash
# Lister tous les utilisateurs
npm run list-users

# Créer un compte admin
npm run seed

# Changer un mot de passe
npm run change-password

# Voir les logs du backend
# (dans un autre terminal)
npm run start:dev

# Rebuild après modifications
npm run build

# Vérifier la compilation
npm run build
```

---

## Prochaines Étapes

Une fois les tests backend validés :

1. **Intégrer la vidéo** (Agora.io, Twilio, ou Jitsi)
2. **Générer des PDFs** pour les prescriptions
3. **Créer le frontend Angular** pour l'interface utilisateur
4. **Ajouter des tests unitaires** avec Jest
5. **Déployer en production**

---

**Besoin d'aide ?** Consultez :
- `README.md` : Documentation API complète
- `IMPLEMENTATION_STATUS.md` : État d'avancement
- Logs backend : Erreurs détaillées dans la console
