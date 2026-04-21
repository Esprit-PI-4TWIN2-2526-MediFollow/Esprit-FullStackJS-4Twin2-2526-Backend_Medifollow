const mongoose = require('mongoose');
require('dotenv').config();

const PATIENT_EMAIL = 'asaidani782@gmail.com';
const PATIENT_ID = '69e3f6f9609f9c1631d2dc67';

async function clearPatientData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get collections
    const db = mongoose.connection.db;
    const questionnaireResponsesCollection = db.collection('questionnaireresponses');
    const notificationsCollection = db.collection('notifications');

    // Delete questionnaire responses for this patient
    console.log(`\n🗑️  Deleting questionnaire responses for patient ${PATIENT_EMAIL}...`);
    const responseResult = await questionnaireResponsesCollection.deleteMany({
      patientId: new mongoose.Types.ObjectId(PATIENT_ID)
    });
    console.log(`✅ Deleted ${responseResult.deletedCount} questionnaire response(s)`);

    // Delete notifications related to this patient
    console.log(`\n🗑️  Deleting notifications for patient ${PATIENT_EMAIL}...`);
    const notificationResult = await notificationsCollection.deleteMany({
      patientId: new mongoose.Types.ObjectId(PATIENT_ID)
    });
    console.log(`✅ Deleted ${notificationResult.deletedCount} notification(s)`);

    console.log('\n✨ Patient data cleared successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Questionnaire responses deleted: ${responseResult.deletedCount}`);
    console.log(`   - Notifications deleted: ${notificationResult.deletedCount}`);
    console.log('\n🎯 You can now test submitting a new questionnaire!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

clearPatientData();
