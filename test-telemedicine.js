const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
let token = '';
let patientId = '';
let doctorId = '';
let consultationId = '';
let prescriptionId = '';
let documentId = '';

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 1. Login
async function login() {
  try {
    logInfo('1. Connexion...');
    const response = await axios.post(`${BASE_URL}/api/signin`, {
      email: 'fethi@gmail.com',
      password: 'Fethi@123',
    });
    
    token = response.data.accessToken;
    logSuccess(`Token obtenu: ${token.substring(0, 20)}...`);
    return true;
  } catch (error) {
    logError(`Erreur de connexion: ${error.response?.data?.message || error.message}`);
    logWarning('Assurez-vous que le compte fethi@gmail.com existe avec le mot de passe Fethi@123');
    return false;
  }
}

// 2. Obtenir les utilisateurs
async function getUsers() {
  try {
    logInfo('2. Récupération des utilisateurs...');
    const response = await axios.get(`${BASE_URL}/api/users/all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const users = response.data;
    const patient = users.find(u => u.role === 'patient');
    const doctor = users.find(u => u.role === 'doctor' || u.role === 'DOCTOR');
    
    if (!patient) {
      logError('Aucun patient trouvé dans la base de données');
      return false;
    }
    
    if (!doctor) {
      logError('Aucun médecin trouvé dans la base de données');
      return false;
    }
    
    patientId = patient._id;
    doctorId = doctor._id;
    
    logSuccess(`Patient trouvé: ${patient.firstName} ${patient.lastName} (${patientId})`);
    logSuccess(`Médecin trouvé: ${doctor.firstName} ${doctor.lastName} (${doctorId})`);
    return true;
  } catch (error) {
    logError(`Erreur récupération utilisateurs: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// 3. Créer une consultation
async function createConsultation() {
  try {
    logInfo('3. Création d\'une consultation...');
    
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 2); // Dans 2 jours
    
    const response = await axios.post(
      `${BASE_URL}/consultations`,
      {
        patientId,
        doctorId,
        type: 'scheduled',
        scheduledAt: scheduledDate.toISOString(),
        reason: 'Test de consultation - Suivi médical',
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    
    consultationId = response.data._id;
    logSuccess(`Consultation créée: ${consultationId}`);
    logInfo(`  - Type: ${response.data.type}`);
    logInfo(`  - Status: ${response.data.status}`);
    logInfo(`  - Date: ${new Date(response.data.scheduledAt).toLocaleString('fr-FR')}`);
    logInfo(`  - Email de confirmation envoyé au patient`);
    return true;
  } catch (error) {
    logError(`Erreur création consultation: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// 4. Lister les consultations
async function listConsultations() {
  try {
    logInfo('4. Liste des consultations...');
    const response = await axios.get(`${BASE_URL}/consultations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    logSuccess(`${response.data.length} consultation(s) trouvée(s)`);
    return true;
  } catch (error) {
    logError(`Erreur liste consultations: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// 5. Démarrer la consultation
async function startConsultation() {
  try {
    logInfo('5. Démarrage de la consultation...');
    const response = await axios.post(
      `${BASE_URL}/consultations/${consultationId}/start`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    
    logSuccess(`Consultation démarrée`);
    logInfo(`  - Status: ${response.data.status}`);
    logInfo(`  - Heure de début: ${new Date(response.data.startedAt).toLocaleTimeString('fr-FR')}`);
    return true;
  } catch (error) {
    logError(`Erreur démarrage consultation: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// 6. Créer une prescription
async function createPrescription() {
  try {
    logInfo('6. Création d\'une prescription...');
    const response = await axios.post(
      `${BASE_URL}/prescriptions`,
      {
        consultationId,
        medications: [
          {
            name: 'Doliprane 1000mg',
            dosage: '1000mg',
            frequency: '3 fois par jour',
            duration: '5 jours',
            instructions: 'À prendre pendant les repas',
          },
          {
            name: 'Ibuprofène 400mg',
            dosage: '400mg',
            frequency: '2 fois par jour',
            duration: '3 jours',
            instructions: 'En cas de douleur',
          },
        ],
        pharmacyNotes: 'Délivrer en une seule fois',
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    
    prescriptionId = response.data._id;
    logSuccess(`Prescription créée: ${prescriptionId}`);
    logInfo(`  - Status: ${response.data.status}`);
    logInfo(`  - QR Code: ${response.data.qrCode}`);
    logInfo(`  - Médicaments: ${response.data.medications.length}`);
    return true;
  } catch (error) {
    logError(`Erreur création prescription: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// 7. Émettre la prescription
async function issuePrescription() {
  try {
    logInfo('7. Émission de la prescription...');
    const response = await axios.post(
      `${BASE_URL}/prescriptions/${prescriptionId}/issue`,
      {
        digitalSignature: 'DOCTOR_SIGNATURE_HASH_' + Date.now(),
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    
    logSuccess(`Prescription émise`);
    logInfo(`  - Status: ${response.data.status}`);
    logInfo(`  - Date d'émission: ${new Date(response.data.issuedAt).toLocaleString('fr-FR')}`);
    logInfo(`  - Valide jusqu'au: ${new Date(response.data.validUntil).toLocaleString('fr-FR')}`);
    logInfo(`  - Email envoyé au patient avec QR code`);
    return true;
  } catch (error) {
    logError(`Erreur émission prescription: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// 8. Créer un fichier de test
function createTestFile() {
  const testFilePath = path.join(__dirname, 'test-document.txt');
  const content = `Document de test médical
Date: ${new Date().toLocaleString('fr-FR')}
Patient ID: ${patientId}
Type: Résultat d'analyse

Ce document est généré automatiquement pour tester l'upload de documents médicaux.
`;
  fs.writeFileSync(testFilePath, content);
  return testFilePath;
}

// 9. Upload un document
async function uploadDocument() {
  try {
    logInfo('8. Upload d\'un document médical...');
    
    const testFilePath = createTestFile();
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('patientId', patientId);
    form.append('consultationId', consultationId);
    form.append('type', 'lab-result');
    form.append('title', 'Test - Analyse de sang');
    form.append('description', 'Document de test automatique');
    form.append('examDate', new Date().toISOString().split('T')[0]);
    form.append('laboratory', 'Laboratoire de Test');
    
    const response = await axios.post(
      `${BASE_URL}/medical-documents/upload`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    documentId = response.data._id;
    logSuccess(`Document uploadé: ${documentId}`);
    logInfo(`  - Titre: ${response.data.title}`);
    logInfo(`  - Type: ${response.data.type}`);
    logInfo(`  - Taille: ${(response.data.fileSize / 1024).toFixed(2)} KB`);
    logInfo(`  - URL Cloudinary: ${response.data.fileUrl}`);
    logInfo(`  - Email envoyé au patient`);
    
    // Nettoyer le fichier de test
    fs.unlinkSync(testFilePath);
    
    return true;
  } catch (error) {
    logError(`Erreur upload document: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// 10. Terminer la consultation
async function endConsultation() {
  try {
    logInfo('9. Fin de la consultation...');
    const response = await axios.post(
      `${BASE_URL}/consultations/${consultationId}/end`,
      {
        notes: 'Patient en bonne santé générale. Grippe saisonnière diagnostiquée.',
        diagnosis: 'Grippe saisonnière',
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    
    logSuccess(`Consultation terminée`);
    logInfo(`  - Status: ${response.data.status}`);
    logInfo(`  - Durée: ${response.data.duration} minutes`);
    logInfo(`  - Diagnostic: ${response.data.diagnosis}`);
    logInfo(`  - Email de résumé envoyé au patient`);
    return true;
  } catch (error) {
    logError(`Erreur fin consultation: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// 11. Résumé final
async function displaySummary() {
  log('\n' + '='.repeat(60), 'blue');
  log('RÉSUMÉ DES TESTS', 'blue');
  log('='.repeat(60), 'blue');
  
  logInfo(`\nConsultation ID: ${consultationId}`);
  logInfo(`Prescription ID: ${prescriptionId}`);
  logInfo(`Document ID: ${documentId}`);
  
  log('\n📧 Emails envoyés:', 'yellow');
  log('  1. Confirmation de consultation programmée');
  log('  2. Prescription émise avec QR code');
  log('  3. Document médical uploadé');
  log('  4. Résumé de consultation terminée');
  
  log('\n🔗 URLs à vérifier:', 'yellow');
  log(`  - Cloudinary: https://cloudinary.com (dossier medical-documents)`);
  log(`  - MongoDB: Collection consultations, prescriptions, medicaldocuments`);
  log(`  - Email: Vérifier la boîte mail du patient`);
  
  log('\n✅ Tous les tests sont terminés avec succès!', 'green');
  log('='.repeat(60) + '\n', 'blue');
}

// Fonction principale
async function runTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('TEST AUTOMATIQUE - MODULE TÉLÉMÉDECINE', 'blue');
  log('='.repeat(60) + '\n', 'blue');
  
  const steps = [
    login,
    getUsers,
    createConsultation,
    listConsultations,
    startConsultation,
    createPrescription,
    issuePrescription,
    uploadDocument,
    endConsultation,
    displaySummary,
  ];
  
  for (const step of steps) {
    const success = await step();
    if (!success) {
      logError('\n❌ Test échoué. Arrêt des tests.');
      process.exit(1);
    }
    await sleep(500); // Pause entre chaque étape
  }
}

// Lancer les tests
runTests().catch(error => {
  logError(`\nErreur fatale: ${error.message}`);
  process.exit(1);
});
