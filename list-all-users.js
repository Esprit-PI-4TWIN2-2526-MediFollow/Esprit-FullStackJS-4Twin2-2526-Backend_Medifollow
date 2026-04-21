// Simple script to list all users with their roles
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://syrinebh05_db_medifollow:d6bKsT2FICOZba2J@cluster0.gnk5ior.mongodb.net/db_medifollow?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI);

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users', strictPopulate: false });
const User = mongoose.model('User', UserSchema);

const RoleSchema = new mongoose.Schema({}, { strict: false, collection: 'roles' });
const Role = mongoose.model('Role', RoleSchema);

async function listUsers() {
  try {
    console.log('🔍 Fetching all users and roles...\n');

    // Get all roles first
    const roles = await Role.find({});
    const roleMap = {};
    roles.forEach(role => {
      roleMap[role._id.toString()] = role.name;
    });

    console.log('📋 Available Roles:');
    roles.forEach((role, index) => {
      console.log(`${index + 1}. ${role.name} (ID: ${role._id})`);
    });
    console.log('\n' + '='.repeat(80) + '\n');

    // Get all users
    const users = await User.find({}).select('_id firstName lastName email role primaryDoctor');
    
    console.log(`👥 Found ${users.length} users:\n`);

    users.forEach((user, index) => {
      // The role field is an ObjectId, convert to string to look up
      const roleId = user.role ? user.role.toString() : null;
      const roleName = roleId ? (roleMap[roleId] || `Unknown (${roleId})`) : 'No Role';
      
      console.log(`${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Role ID: ${user.role || 'null'}`);
      console.log(`   Role Name: ${roleName}`);
      console.log(`   Primary Doctor: ${user.primaryDoctor || 'None'}`);
      console.log('');
    });

    // Group by role
    console.log('\n' + '='.repeat(80));
    console.log('📊 Users by Role:\n');
    
    const usersByRole = {};
    users.forEach(user => {
      const roleId = user.role ? user.role.toString() : null;
      const roleName = roleId ? (roleMap[roleId] || 'Unknown Role') : 'No Role';
      if (!usersByRole[roleName]) {
        usersByRole[roleName] = [];
      }
      usersByRole[roleName].push(user);
    });

    Object.keys(usersByRole).forEach(roleName => {
      console.log(`\n${roleName} (${usersByRole[roleName].length}):`);
      usersByRole[roleName].forEach(user => {
        console.log(`  - ${user.firstName} ${user.lastName} (${user.email})`);
      });
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Done');
  }
}

listUsers();
