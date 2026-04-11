import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './users/users.schema';
import { Role } from './role/schemas/role.schema';

async function makeSuperAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const roleModel = app.get<Model<Role>>(getModelToken(Role.name));

  try {
    const email = 'lion@gmail.com';

    // Find or create ADMIN role
    let adminRole = await roleModel.findOne({ name: 'ADMIN' });
    if (!adminRole) {
      adminRole = await roleModel.create({ name: 'ADMIN' });
      console.log('✅ ADMIN role created');
    }

    // Find the user
    const user = await userModel.findOne({ email });

    if (!user) {
      console.log(`❌ User with email ${email} not found`);
      await app.close();
      return;
    }

    console.log(`\n👤 Found user: ${user.firstName} ${user.lastName}`);
    console.log(`📧 Email: ${email}`);
    
    // Get current role
    let currentRole = 'N/A';
    if (user.role) {
      if (typeof user.role === 'string') {
        currentRole = user.role;
      } else if (typeof user.role === 'object' && 'name' in user.role) {
        currentRole = user.role.name;
      } else {
        const populatedUser = await userModel.findById(user._id).populate('role').exec();
        if (populatedUser?.role && typeof populatedUser.role === 'object' && 'name' in populatedUser.role) {
          currentRole = populatedUser.role.name;
        }
      }
    }

    console.log(`🎭 Current Role: ${currentRole}`);
    console.log(`\n🔄 Updating role to ADMIN...`);

    // Update user role
    user.role = adminRole._id as any;
    user.actif = true;
    user.mustChangePassword = false;
    await user.save();

    console.log(`\n✅ User role updated successfully!`);
    console.log(`📧 Email: ${email}`);
    console.log(`🎭 New Role: ADMIN`);
    console.log(`✅ Active: Yes`);
    console.log(`\n🎉 ${user.firstName} ${user.lastName} is now an ADMIN!\n`);

  } catch (error) {
    console.error('❌ Error updating user role:', error);
  } finally {
    await app.close();
  }
}

makeSuperAdmin();
