import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { UsersService } from './src/users/users.service';
import * as bcrypt from 'bcryptjs';

async function setupAccounts() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  const accounts = [
    // Médecins
    { email: 'doctor_fethi@gmail.com', password: 'Doctor@123', role: 'doctor' },
    { email: 'khalil_doctor@gmail.com', password: 'Doctor@123', role: 'doctor' },
    { email: 'nouraaa@gmail.com', password: 'Doctor@123', role: 'doctor' },
    
    // Patients
    { email: 'karouii@gmail.com', password: 'Patient@123', role: 'patient' },
    { email: 'patient_rayen@gmail.com', password: 'Patient@123', role: 'patient' },
    { email: 'nour_patient@gmail.com', password: 'Patient@123', role: 'patient' },
    { email: 'dhia@gmail.com', password: 'Patient@123', role: 'patient' },
    { email: 'wala@gmail.com', password: 'Patient@123', role: 'patient' },
  ];

  console.log('\n🔧 Configuration des comptes télémédecine...\n');

  for (const account of accounts) {
    try {
      const user = await usersService.findByEmail(account.email);
      
      if (!user) {
        console.log(`❌ ${account.email} - Compte non trouvé`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(account.password, 10);
      user.password = hashedPassword;
      user.actif = true;
      user.mustChangePassword = false;
      await user.save();

      console.log(`✅ ${account.email} - Mot de passe: ${account.password}`);
    } catch (error) {
      console.log(`❌ ${account.email} - Erreur: ${error.message}`);
    }
  }

  console.log('\n✅ Configuration terminée!\n');
  console.log('📋 Résumé des comptes:');
  console.log('');
  console.log('👨‍⚕️ MÉDECINS:');
  console.log('  - doctor_fethi@gmail.com / Doctor@123');
  console.log('  - khalil_doctor@gmail.com / Doctor@123');
  console.log('  - nouraaa@gmail.com / Doctor@123');
  console.log('');
  console.log('🏥 PATIENTS:');
  console.log('  - karouii@gmail.com / Patient@123');
  console.log('  - patient_rayen@gmail.com / Patient@123');
  console.log('  - nour_patient@gmail.com / Patient@123');
  console.log('  - dhia@gmail.com / Patient@123');
  console.log('  - wala@gmail.com / Patient@123');
  console.log('');
  console.log('🚀 Vous pouvez maintenant tester le module télémédecine!');
  console.log('   URL: http://localhost:4200/telemedicine');
  console.log('');

  await app.close();
  process.exit(0);
}

setupAccounts().catch((error) => {
  console.error('Erreur:', error);
  process.exit(1);
});
