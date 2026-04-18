# Module Télémédecine - API Documentation

## Vue d'ensemble
Ce module gère les consultations vidéo, les prescriptions électroniques et les documents médicaux.

## Endpoints

### Consultations

#### Créer une consultation
```
POST /consultations
Body: {
  "patientId": "string",
  "doctorId": "string",
  "type": "scheduled" | "urgent" | "follow-up",
  "scheduledAt": "2024-01-15T10:00:00Z",
  "reason": "string"
}
```

#### Lister les consultations
```
GET /consultations?status=pending&doctorId=xxx&patientId=xxx&startDate=xxx&endDate=xxx
```

#### Obtenir une consultation
```
GET /consultations/:id
```

#### Consultations d'un médecin
```
GET /consultations/doctor/:doctorId
GET /consultations/doctor/:doctorId/today
GET /consultations/doctor/:doctorId/upcoming?days=7
```

#### Consultations d'un patient
```
GET /consultations/patient/:patientId
```

#### Mettre à jour une consultation
```
PATCH /consultations/:id
Body: {
  "status": "in-progress" | "completed" | "cancelled",
  "notes": "string",
  "diagnosis": "string",
  "recommendations": "string"
}
```

#### Démarrer une consultation
```
POST /consultations/:id/start
```

#### Terminer une consultation
```
POST /consultations/:id/end
Body: {
  "notes": "string",
  "diagnosis": "string"
}
```

#### Annuler une consultation
```
POST /consultations/:id/cancel
```

#### Supprimer une consultation
```
DELETE /consultations/:id
```

---

### Prescriptions

#### Créer une prescription
```
POST /prescriptions
Body: {
  "consultationId": "string",
  "medications": [
    {
      "name": "Doliprane 1000mg",
      "dosage": "1000mg",
      "frequency": "3 fois par jour",
      "duration": "5 jours",
      "instructions": "À prendre pendant les repas"
    }
  ],
  "pharmacyNotes": "string"
}
```

#### Lister les prescriptions
```
GET /prescriptions?patientId=xxx&doctorId=xxx&consultationId=xxx&status=xxx
```

#### Obtenir une prescription
```
GET /prescriptions/:id
```

#### Obtenir par QR code
```
GET /prescriptions/qr/:qrCode
```

#### Prescriptions d'un patient
```
GET /prescriptions/patient/:patientId
```

#### Prescriptions d'une consultation
```
GET /prescriptions/consultation/:consultationId
```

#### Émettre une prescription (signer)
```
POST /prescriptions/:id/issue
Body: {
  "digitalSignature": "string"
}
```

#### Marquer comme envoyée
```
POST /prescriptions/:id/send
```

#### Marquer comme délivrée
```
POST /prescriptions/:id/dispense
```

#### Supprimer une prescription
```
DELETE /prescriptions/:id
```

---

### Documents Médicaux

#### Upload un document
```
POST /medical-documents/upload
Content-Type: multipart/form-data
Body: {
  "file": File,
  "patientId": "string",
  "consultationId": "string" (optionnel),
  "type": "lab-result" | "imaging" | "report" | "prescription" | "other",
  "title": "string",
  "description": "string",
  "examDate": "2024-01-15",
  "laboratory": "string",
  "radiologist": "string"
}
```

#### Lister les documents
```
GET /medical-documents?patientId=xxx&consultationId=xxx&type=xxx
```

#### Obtenir un document
```
GET /medical-documents/:id
```

#### Documents d'un patient
```
GET /medical-documents/patient/:patientId
```

#### Documents d'une consultation
```
GET /medical-documents/consultation/:consultationId
```

#### Partager un document
```
PATCH /medical-documents/:id/share
Body: {
  "userIds": ["userId1", "userId2"]
}
```

#### Retirer le partage
```
PATCH /medical-documents/:id/unshare
Body: {
  "userId": "string"
}
```

#### Supprimer un document
```
DELETE /medical-documents/:id
```

---

## Statuts

### Consultation
- `pending`: En attente
- `in-progress`: En cours
- `completed`: Terminée
- `cancelled`: Annulée
- `no-show`: Patient absent

### Prescription
- `draft`: Brouillon
- `issued`: Émise (signée)
- `sent`: Envoyée au patient
- `dispensed`: Délivrée en pharmacie

### Type de Document
- `lab-result`: Résultat d'analyse
- `imaging`: Imagerie médicale
- `report`: Rapport médical
- `prescription`: Prescription
- `other`: Autre

---

## Fonctionnalités Implémentées

### ✅ Backend Complet
- Schémas MongoDB (Consultation, Prescription, MedicalDocument, VideoSession)
- Services métier avec logique complète
- Controllers REST avec tous les endpoints
- DTOs de validation
- Intégration Cloudinary pour upload de documents
- Notifications email automatiques

### ✅ Notifications Email
- Confirmation de consultation programmée
- Rappel 30 minutes avant la consultation
- Résumé après consultation terminée
- Notification de prescription émise avec QR code
- Notification d'upload de document médical

### ✅ Gestion de Documents
- Upload sécurisé vers Cloudinary
- Support multi-formats (PDF, images, etc.)
- Métadonnées enrichies (date examen, laboratoire, radiologue)
- Partage de documents entre utilisateurs
- Suppression avec nettoyage Cloudinary

### ✅ Prescriptions Électroniques
- Génération de QR code unique
- Signature électronique
- Statuts (draft, issued, sent, dispensed)
- Validité de 3 mois
- Recherche par QR code pour pharmaciens

---

## Prochaines étapes

### 🔄 À Implémenter

1. **Intégration Vidéo**
   - Choisir un provider (Agora.io recommandé, Twilio Video, ou Jitsi)
   - Créer VideoSessionService
   - Générer tokens de session
   - Endpoints pour démarrer/rejoindre/terminer session

2. **Génération PDF**
   - Installer pdfmake ou puppeteer
   - Template de prescription PDF
   - Génération automatique lors de l'émission
   - Stockage sur Cloudinary

3. **Notifications SMS** (Twilio déjà configuré)
   - Rappels de consultation
   - Codes de vérification
   - Alertes urgentes

4. **Frontend Angular**
   - Composants de consultation
   - Interface de vidéo conférence
   - Visualiseur de documents
   - Formulaire de prescription
   - Tableau de bord médecin/patient

5. **Tests**
   - Tests unitaires des services
   - Tests d'intégration des endpoints
   - Tests E2E du flux complet

---

## Notes de sécurité

- Tous les endpoints nécessitent une authentification JWT
- Les documents sont stockés de manière sécurisée sur Cloudinary
- Les prescriptions ont une signature électronique unique
- Les QR codes sont générés de manière cryptographiquement sécurisée
