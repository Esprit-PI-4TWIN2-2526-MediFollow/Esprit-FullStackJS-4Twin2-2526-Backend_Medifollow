const mongoose = require('mongoose');
require('dotenv').config();

async function createTestConsultation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_NAME,
    });

    console.log('✅ Connected to MongoDB');

    const Consultation = mongoose.model('Consultation', new mongoose.Schema({
      patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      type: String,
      status: String,
      scheduledAt: Date,
      reason: String,
      videoProvider: String,
      videoRoomId: String,
    }, { timestamps: true }));

    // Calculate time 2 hours from now
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const consultation = await Consultation.create({
      patient: new mongoose.Types.ObjectId('69e3f6f9609f9c1631d2dc67'), // ahmed saidani
      doctor: new mongoose.Types.ObjectId('699e63cdb7b28f9817f831b3'), // nourr bouslimi
      type: 'scheduled',
      status: 'pending',
      scheduledAt: twoHoursFromNow,
      reason: 'Test consultation for reminder notification system',
      videoProvider: 'agora',
      videoRoomId: `test-room-${Date.now()}`,
    });

    console.log('\n✅ Test consultation created successfully!');
    console.log('📋 Consultation ID:', consultation._id);
    console.log('👨‍⚕️ Doctor: nourr bouslimi (699e63cdb7b28f9817f831b3)');
    console.log('👤 Patient: ahmed saidani (69e3f6f9609f9c1631d2dc67)');
    console.log('⏰ Scheduled for:', twoHoursFromNow.toLocaleString());
    console.log('📅 Status:', consultation.status);
    console.log('\n⏳ The cron job will send a notification in the next 10-minute cycle');
    console.log('🔔 Check the doctor dashboard for the notification');
    console.log('\n💡 Tip: Watch the backend logs for:');
    console.log('   🔍 Checking for upcoming consultations...');
    console.log('   📋 Found 1 upcoming consultation(s)');
    console.log('   ✅ Reminder sent for consultation...');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestConsultation();
