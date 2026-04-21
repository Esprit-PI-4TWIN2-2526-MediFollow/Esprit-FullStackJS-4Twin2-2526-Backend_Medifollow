const mongoose = require('mongoose');
require('dotenv').config();

async function testPrescriptionNotification() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_NAME,
    });

    console.log('✅ Connected to MongoDB\n');

    // Define schemas
    const Consultation = mongoose.model('Consultation', new mongoose.Schema({
      patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      type: String,
      status: String,
      scheduledAt: Date,
      reason: String,
    }, { timestamps: true }));

    const Prescription = mongoose.model('Prescription', new mongoose.Schema({
      consultation: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation' },
      patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      medications: [{
        name: String,
        dosage: String,
        frequency: String,
        duration: String,
        instructions: String,
      }],
      status: String,
      qrCode: String,
      issuedAt: Date,
      validUntil: Date,
      digitalSignature: String,
    }, { timestamps: true }));

    // Find or create a consultation
    let consultation = await Consultation.findOne({
      doctor: new mongoose.Types.ObjectId('699e63cdb7b28f9817f831b3'),
      patient: new mongoose.Types.ObjectId('69e3f6f9609f9c1631d2dc67'),
    }).sort({ createdAt: -1 });

    if (!consultation) {
      console.log('📋 Creating a test consultation...');
      consultation = await Consultation.create({
        patient: new mongoose.Types.ObjectId('69e3f6f9609f9c1631d2dc67'),
        doctor: new mongoose.Types.ObjectId('699e63cdb7b28f9817f831b3'),
        type: 'scheduled',
        status: 'completed',
        scheduledAt: new Date(),
        reason: 'Test consultation for prescription',
      });
      console.log('✅ Consultation created:', consultation._id);
    } else {
      console.log('✅ Using existing consultation:', consultation._id);
    }

    // Create a draft prescription
    console.log('\n💊 Creating draft prescription...');
    const qrCode = Math.random().toString(36).substring(2, 18).toUpperCase();
    
    const prescription = await Prescription.create({
      consultation: consultation._id,
      patient: consultation.patient,
      doctor: consultation.doctor,
      medications: [
        {
          name: 'Amoxicillin',
          dosage: '500mg',
          frequency: '3 times daily',
          duration: '7 days',
          instructions: 'Take with food',
        },
        {
          name: 'Ibuprofen',
          dosage: '400mg',
          frequency: 'As needed',
          duration: '5 days',
          instructions: 'Take after meals for pain relief',
        }
      ],
      status: 'draft',
      qrCode: qrCode,
    });

    console.log('✅ Draft prescription created:', prescription._id);
    console.log('📋 QR Code:', prescription.qrCode);
    console.log('💊 Medications:', prescription.medications.length);

    console.log('\n📝 To test the notification:');
    console.log('1. Login as doctor (nouris@gmail.com)');
    console.log('2. Go to: http://localhost:4200/telemedicine/prescriptions');
    console.log('3. Find the prescription and click "Issue Prescription"');
    console.log('4. Or use this API call:\n');
    console.log(`POST http://localhost:3000/prescriptions/${prescription._id}/issue`);
    console.log('Body: { "digitalSignature": "Dr. Nourr Bouslimi - Digital Signature" }');
    console.log('\n5. Check the notification bell for the prescription notification 🔔');
    console.log('   - Type: prescription (💊 icon)');
    console.log('   - Priority: low (green color)');
    console.log('   - Message: "Prescription issued for ahmed saidani"');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testPrescriptionNotification();
