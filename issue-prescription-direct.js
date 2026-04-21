const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

async function issuePrescriptionDirect() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_NAME,
    });

    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.model('User', new mongoose.Schema({
      firstName: String,
      lastName: String,
      email: String,
    }));

    const Prescription = mongoose.model('Prescription', new mongoose.Schema({
      consultation: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation' },
      patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      medications: Array,
      status: String,
      qrCode: String,
      issuedAt: Date,
      validUntil: Date,
      digitalSignature: String,
    }, { timestamps: true }));

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

    // Find the draft prescription
    const prescription = await Prescription.findOne({ status: 'draft' })
      .populate('patient', 'firstName lastName')
      .populate('doctor', 'firstName lastName')
      .sort({ createdAt: -1 });

    if (!prescription) {
      console.log('❌ No draft prescription found. Run test-prescription-notification.js first.');
      await mongoose.disconnect();
      return;
    }

    console.log('💊 Found draft prescription:', prescription._id);
    console.log('👤 Patient:', prescription.patient.firstName, prescription.patient.lastName);
    console.log('👨‍⚕️ Doctor:', prescription.doctor.firstName, prescription.doctor.lastName);

    // Issue the prescription
    const now = new Date();
    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + 3);

    prescription.status = 'issued';
    prescription.issuedAt = now;
    prescription.validUntil = validUntil;
    prescription.digitalSignature = 'Dr. Nourr Bouslimi - Digital Signature';
    await prescription.save();

    console.log('\n✅ Prescription issued!');
    console.log('📅 Issued at:', now.toLocaleString());
    console.log('⏰ Valid until:', validUntil.toLocaleString());

    // Create notification for patient (not doctor!)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const notification = await Notification.create({
      recipientId: prescription.patient._id,
      type: 'prescription',
      priority: 'medium',
      title: 'Prescription Ready',
      message: `Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName} has issued your prescription`,
      data: {
        prescriptionId: prescription._id.toString(),
        qrCode: prescription.qrCode,
        medicationsCount: prescription.medications.length,
        validUntil: validUntil.toISOString(),
        doctorName: `${prescription.doctor.firstName} ${prescription.doctor.lastName}`,
      },
      patientId: prescription.patient._id,
      actionUrl: `/telemedicine/prescriptions/${prescription._id}`,
      isRead: false,
      expiresAt: expiresAt,
    });

    console.log('\n🔔 Notification created!');
    console.log('📬 Notification ID:', notification._id);
    console.log('👤 Recipient (Patient):', prescription.patient._id);
    console.log('💊 Type: prescription');
    console.log('🎨 Priority: medium (yellow color)');
    console.log('📝 Message:', notification.message);

    console.log('\n✅ SUCCESS! Now check the patient dashboard:');
    console.log('1. Login as patient: asaidani782@gmail.com');
    console.log('2. Look at the notification bell 🔔');
    console.log('3. You should see a notification with:');
    console.log('   - 💊 icon (prescription)');
    console.log('   - Yellow color (medium priority)');
    console.log('   - Message: "Dr. nourr bouslimi has issued your prescription"');
    console.log('4. Click it to view prescription details');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

issuePrescriptionDirect();
