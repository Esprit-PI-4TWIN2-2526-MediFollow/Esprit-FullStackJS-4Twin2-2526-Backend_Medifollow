import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { User } from './users/users.schema';
import { Role } from './role/schemas/role.schema';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const roleModel = app.get<Model<Role>>(getModelToken(Role.name));

  try {
    // Create SUPERADMIN role if it doesn't exist
    let superAdminRole = await roleModel.findOne({ name: 'SUPERADMIN' });
    if (!superAdminRole) {
      superAdminRole = await roleModel.create({ name: 'SUPERADMIN' });
      console.log('✅ SUPERADMIN role created');
    } else {
      console.log('ℹ️  SUPERADMIN role already exists');
    }

    // Check if super admin user already exists
    const existingAdmin = await userModel.findOne({ email: 'admin@medifollow.com' });
    if (existingAdmin) {
      console.log('ℹ️  Super admin user already exists');
      await app.close();
      return;
    }

    // Create super admin user
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    const superAdmin = await userModel.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@medifollow.com',
      password: hashedPassword,
      role: superAdminRole._id,
      actif: true,
      mustChangePassword: false,
      createdAt: new Date(),
    });

    console.log('✅ Super admin user created successfully!');
    console.log('📧 Email: admin@medifollow.com');
    console.log('🔑 Password: Admin@123');
    console.log('⚠️  Please change the password after first login!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await app.close();
  }
}

seed();
