const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/medifollow';

const NotificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String,
    required: true,
    enum: ['symptom', 'consultation', 'upcoming-consultation', 'questionnaire', 'prescription', 'appointment']
  },
  priority: { 
    type: String,
    required: true,
    enum: ['critical', 'high', 'medium', 'low']
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: mongoose.Schema.Types.Mixed,
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isRead: { type: Boolean, default: false },
  readAt: Date,
  actionUrl: String,
  expiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}, { timestamps: true });

const Notification = mongoose.model('Notification', NotificationSchema);

async function checkAppointmentNotifications() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Patient ID: 69e3f6f9609f9c1631d2dc67 (ahmed saidani)
    const patientId = '69e3f6f9609f9c1631d2dc67';

    console.log('\n📋 Checking appointment notifications for patient:', patientId);
    
    const notifications = await Notification.find({
      recipientId: new mongoose.Types.ObjectId(patientId),
      type: 'appointment'
    }).sort({ createdAt: -1 }).limit(5);

    console.log(`\n📬 Found ${notifications.length} appointment notification(s):\n`);
    
    notifications.forEach((notif, index) => {
      console.log(`${index + 1}. ${notif.title}`);
      console.log(`   Message: ${notif.message}`);
      console.log(`   Priority: ${notif.priority}`);
      console.log(`   Read: ${notif.isRead ? '✅' : '❌'}`);
      console.log(`   Created: ${notif.createdAt}`);
      console.log(`   Action URL: ${notif.actionUrl}`);
      if (notif.data) {
        console.log(`   Data:`, JSON.stringify(notif.data, null, 2));
      }
      console.log('');
    });

    // Check all notifications for patient
    const allNotifications = await Notification.find({
      recipientId: new mongoose.Types.ObjectId(patientId)
    }).sort({ createdAt: -1 });

    console.log(`\n📊 Total notifications for patient: ${allNotifications.length}`);
    console.log('Breakdown by type:');
    const typeCount = {};
    allNotifications.forEach(n => {
      typeCount[n.type] = (typeCount[n.type] || 0) + 1;
    });
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkAppointmentNotifications();
