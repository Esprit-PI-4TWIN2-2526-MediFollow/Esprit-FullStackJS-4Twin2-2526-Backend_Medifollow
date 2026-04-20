// Test script to check questionnaire notifications
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/medifollow', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const NotificationSchema = new mongoose.Schema({}, { strict: false, collection: 'notifications' });
const Notification = mongoose.model('Notification', NotificationSchema);

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', UserSchema);

async function checkNotifications() {
  try {
    console.log('🔍 Checking notifications...\n');

    // Get all notifications
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(10);
    console.log(`📬 Total notifications: ${notifications.length}\n`);

    if (notifications.length > 0) {
      console.log('Recent notifications:');
      notifications.forEach((notif, index) => {
        console.log(`\n${index + 1}. ${notif.type} - ${notif.title}`);
        console.log(`   Recipient: ${notif.recipientId}`);
        console.log(`   Patient: ${notif.patientId}`);
        console.log(`   Created: ${notif.createdAt}`);
        console.log(`   Read: ${notif.isRead}`);
      });
    } else {
      console.log('❌ No notifications found in database');
    }

    // Check for doctors
    console.log('\n\n🔍 Checking doctors in database...\n');
    const doctors = await User.find({ 
      $or: [
        { role: 'DOCTOR' },
        { roles: { $in: ['DOCTOR'] } }
      ]
    }).select('_id firstName lastName email role roles');

    console.log(`👨‍⚕️ Found ${doctors.length} doctors:`);
    doctors.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.firstName} ${doc.lastName} (${doc.email})`);
      console.log(`   ID: ${doc._id}`);
      console.log(`   Role: ${doc.role || doc.roles}`);
    });

    // Check for patients with primaryDoctor
    console.log('\n\n🔍 Checking patients with primaryDoctor...\n');
    const patients = await User.find({ 
      primaryDoctor: { $exists: true, $ne: null }
    }).select('_id firstName lastName email primaryDoctor').limit(5);

    console.log(`🤒 Found ${patients.length} patients with primaryDoctor:`);
    patients.forEach((patient, index) => {
      console.log(`${index + 1}. ${patient.firstName} ${patient.lastName}`);
      console.log(`   Primary Doctor: ${patient.primaryDoctor}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Done');
  }
}

checkNotifications();
