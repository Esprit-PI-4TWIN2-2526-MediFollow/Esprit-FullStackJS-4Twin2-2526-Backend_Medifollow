import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { User } from './users/users.schema';

async function changePassword() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userModel = app.get<Model<User>>(getModelToken(User.name));

  try {
    const email = 'fethi@gmail.com';
    const newPassword = 'Fethi@123';

    const user = await userModel.findOne({ email });

    if (!user) {
      console.log(`❌ User with email ${email} not found`);
      await app.close();
      return;
    }

    console.log(`\n👤 Found user: ${user.firstName} ${user.lastName}`);
    console.log(`📧 Email: ${email}`);
    console.log(`\n🔄 Updating password...`);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.mustChangePassword = false;
    await user.save();

    console.log(`\n✅ Password updated successfully!`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 New Password: ${newPassword}`);
    console.log(`\n⚠️  Please share this password securely with the user!\n`);

  } catch (error) {
    console.error('❌ Error changing password:', error);
  } finally {
    await app.close();
  }
}

changePassword();
