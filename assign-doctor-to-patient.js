// Quick script to assign a doctor to a patient
const mongoose = require('mongoose');

// Use the same connection string from .env
const MONGODB_URI = 'mongodb+srv://syrinebh05_db_medifollow:d6bKsT2FICOZba2J@cluster0.gnk5ior.mongodb.net/db_medifollow?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI);

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users', strictPopulate: false });
const User = mongoose.model('User', UserSchema);

async function assignDoctor() {
  try {
    console.log('🔍 Finding all users...\n');

    // Find all users and populate role
    const users = await User.find({})
      .populate('role', 'name')
      .select('_id firstName lastName email role primaryDoctor')
      .limit(50);
    
    console.log(`Found ${users.length} users:\n`);
    users.forEach((user, index) => {
      const roleName = user.role?.name || 'No role';
      console.log(`${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Role: ${roleName}`);
      console.log(`   Primary Doctor: ${user.primaryDoctor || 'None'}\n`);
    });

    // Find first doctor - look for doctor-like emails or names
    const doctor = users.find(u => {
      const email = u.email.toLowerCase();
      const firstName = u.firstName.toLowerCase();
      const lastName = u.lastName.toLowerCase();
      
      return email.includes('doctor') || 
             email.includes('khalil') ||
             email.includes('fethi') ||
             firstName.includes('khalil') ||
             firstName.includes('fethi') ||
             firstName.includes('ahmed');
    });

    if (!doctor) {
      console.log('❌ No doctor found. Using first user as doctor.');
      return;
    }

    console.log(`✅ Using as doctor: ${doctor.firstName} ${doctor.lastName} (${doctor.email})\n`);

    // Find patients - look for patient-like emails
    const patient = users.find(u => {
      const email = u.email.toLowerCase();
      return email.includes('patient') || 
             email.includes('nour') ||
             email.includes('rayen') ||
             email.includes('test');
    });

    if (!patient) {
      console.log('❌ No patient found. Using second user as patient.');
      return;
    }

    console.log(`✅ Using as patient: ${patient.firstName} ${patient.lastName} (${patient.email})`);
    console.log(`   Current primaryDoctor: ${patient.primaryDoctor || 'None'}\n`);

    // Assign doctor to patient
    const doctorFullName = `Dr. ${doctor.firstName} ${doctor.lastName}`;
    
    await User.updateOne(
      { _id: patient._id },
      { $set: { primaryDoctor: doctorFullName } }
    );

    console.log(`✅ SUCCESS! Assigned ${doctorFullName} to patient ${patient.firstName} ${patient.lastName}`);
    console.log(`\n📋 Now when ${patient.firstName} completes a questionnaire, ${doctor.firstName} will receive a notification!`);
    console.log(`\nPatient ID: ${patient._id}`);
    console.log(`Doctor ID: ${doctor._id}`);
    console.log(`\n🧪 TEST IT: Login as ${patient.firstName}, complete a questionnaire, then check ${doctor.firstName}'s notifications!`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

assignDoctor();
