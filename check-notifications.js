const mongoose = require('mongoose');
require('dotenv').config();

const DOCTOR_ID = '699e63cdb7b28f9817f831b3';

async function checkNotifications() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    // Find all notifications for this doctor
    console.log(`🔍 Searching for notifications for doctor ID: ${DOCTOR_ID}\n`);
    const notifications = await notificationsCollection.find({
      recipientId: new mongoose.Types.ObjectId(DOCTOR_ID)
    }).toArray();

    console.log(`📊 Found ${notifications.length} notification(s):\n`);
    
    notifications.forEach((notif, index) => {
      console.log(`Notification #${index + 1}:`);
      console.log(`  - ID: ${notif._id}`);
      console.log(`  - Type: ${notif.type}`);
      console.log(`  - Title: ${notif.title}`);
      console.log(`  - Message: ${notif.message}`);
      console.log(`  - Priority: ${notif.priority}`);
      console.log(`  - Is Read: ${notif.isRead}`);
      console.log(`  - Created At: ${notif.createdAt}`);
      console.log(`  - Patient ID: ${notif.patientId}`);
      console.log(`  - Action URL: ${notif.actionUrl}`);
      console.log('');
    });

    if (notifications.length === 0) {
      console.log('⚠️  No notifications found! The notification might not have been created.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

checkNotifications();
