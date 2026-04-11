import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './users/users.schema';

async function listUsers() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userModel = app.get<Model<User>>(getModelToken(User.name));

  try {
    // First, try to get users without populating role to avoid cast errors
    const users = await userModel.find().lean().exec();

    if (users.length === 0) {
      console.log('📭 No users found in the database');
      await app.close();
      return;
    }

    console.log(`\n👥 Found ${users.length} user(s) in the database:\n`);
    console.log('═'.repeat(100));

    for (let index = 0; index < users.length; index++) {
      const user = users[index];
      let roleName = 'N/A';

      // Handle role - it could be ObjectId, string, or object
      if (user.role) {
        if (typeof user.role === 'string') {
          roleName = user.role;
        } else if (typeof user.role === 'object' && 'name' in user.role) {
          roleName = user.role.name;
        } else {
          // Try to populate if it's an ObjectId
          try {
            const populatedUser = await userModel.findById(user._id).populate('role').exec();
            if (populatedUser?.role && typeof populatedUser.role === 'object' && 'name' in populatedUser.role) {
              roleName = populatedUser.role.name;
            }
          } catch (err) {
            roleName = String(user.role);
          }
        }
      }

      console.log(`\n${index + 1}. User Details:`);
      console.log('─'.repeat(100));
      console.log(`   📧 Email:           ${user.email}`);
      console.log(`   👤 Name:            ${user.firstName || 'N/A'} ${user.lastName || 'N/A'}`);
      console.log(`   🎭 Role:            ${roleName}`);
      console.log(`   ✅ Active:          ${user.actif ? 'Yes' : 'No'}`);
      console.log(`   🔑 Must Change Pwd: ${user.mustChangePassword ? 'Yes' : 'No'}`);
      console.log(`   📞 Phone:           ${user.phoneNumber || 'N/A'}`);
      console.log(`   📍 Address:         ${user.address || 'N/A'}`);
      console.log(`   🎂 Date of Birth:   ${user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'N/A'}`);
      console.log(`   ⚧  Gender:          ${user.sexe || 'N/A'}`);
      
      if (user.specialization) {
        console.log(`   🏥 Specialization:  ${user.specialization}`);
      }
      if (user.diploma) {
        console.log(`   🎓 Diploma:         ${user.diploma}`);
      }
      if (user.grade) {
        console.log(`   📊 Grade:           ${user.grade}`);
      }
      if (user.yearsOfExperience) {
        console.log(`   📅 Experience:      ${user.yearsOfExperience} years`);
      }
      if (user.assignedDepartment) {
        console.log(`   🏢 Department:      ${user.assignedDepartment}`);
      }
      if (user.auditScope) {
        console.log(`   🔍 Audit Scope:     ${user.auditScope}`);
      }
      if (user.primaryDoctor) {
        console.log(`   👨‍⚕️ Primary Doctor: ${user.primaryDoctor}`);
      }
      
      console.log(`   🆔 User ID:         ${user._id}`);
      console.log(`   📅 Created:         ${new Date(user.createdAt).toLocaleString()}`);
      if (user.updatedAt) {
        console.log(`   🔄 Updated:         ${new Date(user.updatedAt).toLocaleString()}`);
      }
    }

    console.log('\n' + '═'.repeat(100));
    console.log(`\n✅ Total users: ${users.length}\n`);

  } catch (error) {
    console.error('❌ Error fetching users:', error);
  } finally {
    await app.close();
  }
}

listUsers();
