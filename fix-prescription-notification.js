const mongoose = require('mongoose');
require('dotenv').config();

async function fixPrescriptionNotification() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_NAME,
    });

    console.log('✅ Connected to MongoDB\n');

    const Notification = mongoose.model('Notification', new mongoose.Schema({
      recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      type: String,
      priority: String,
      title: String,
      message: String,
      data: Object,
      patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      actionUrl: String,
      isRead: { type: Boolean, default: false },
      expiresAt: Date,
    }, { timestamps: true }));

    // Delete the old notification sent to doctor
    const deletedCount = await Notification.deleteMany({
      type: 'prescription',
      recipientId: new mongoose.Types.ObjectId('699e63cdb7b28f9817f831b3'), // doctor ID
    });

    console.log(`🗑️  Deleted ${deletedCount.deletedCount} old prescription notification(s) for doctor\n`);

    // Create new notification for patient
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const notification = await Notification.create({
      recipientId: new mongoose.Types.ObjectId('69e3f6f9609f9c1631d2dc67'), // patient ID
      type: 'prescription',
      priority: 'medium',
      title: 'Prescription Ready',
      message: 'Dr. nourr bouslimi has issued your prescription',
      data: {
        prescriptionId: '69e52eff618495b6dd538adc',
        qrCode: 'SS6YYO9LQMO',
        medicationsCount: 2,
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        doctorName: 'nourr bouslimi',
      },
      patientId: new mongoose.Types.ObjectId('69e3f6f9609f9c1631d2dc67'),
      actionUrl: '/telemedicine/prescriptions/69e52eff618495b6dd538adc',
      isRead: false,
      expiresAt: expiresAt,
    });

    console.log('✅ New notification created for patient!');
    console.log('📬 Notification ID:', notification._id);
    console.log('👤 Recipient: ahmed saidani (patient)');
    console.log('💊 Type: prescription');
    console.log('🎨 Priority: medium (yellow color)');
    console.log('📝 Message:', notification.message);

    console.log('\n✅ FIXED! Now test:');
    console.log('1. Login as PATIENT: asaidani782@gmail.com');
    console.log('2. Check the notification bell 🔔');
    console.log('3. You should see:');
    console.log('   - 💊 icon (prescription)');
    console.log('   - Yellow color (medium priority)');
    console.log('   - Message: "Dr. nourr bouslimi has issued your prescription"');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixPrescriptionNotification();
