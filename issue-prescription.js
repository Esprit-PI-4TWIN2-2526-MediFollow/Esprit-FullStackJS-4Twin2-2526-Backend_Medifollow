const axios = require('axios');

const prescriptionId = process.argv[2] || '69e52eff618495b6dd538adc';

async function issuePrescription() {
  try {
    console.log(`💊 Issuing prescription: ${prescriptionId}\n`);

    const response = await axios.post(
      `http://localhost:3000/prescriptions/${prescriptionId}/issue`,
      {
        digitalSignature: 'Dr. Nourr Bouslimi - Digital Signature'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Prescription issued successfully!');
    console.log('📋 Status:', response.data.status);
    console.log('📅 Issued at:', new Date(response.data.issuedAt).toLocaleString());
    console.log('⏰ Valid until:', new Date(response.data.validUntil).toLocaleString());
    console.log('🔐 QR Code:', response.data.qrCode);
    console.log('\n🔔 Notification sent to doctor!');
    console.log('👉 Login as doctor (nouris@gmail.com) to see the notification');
    console.log('   - Check the bell icon in the header');
    console.log('   - Look for 💊 icon with green color (low priority)');
    console.log('   - Message: "Prescription issued for ahmed saidani"');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. Backend server is running');
    console.log('   2. Prescription ID is correct');
    console.log('   3. Prescription status is "draft" (not already issued)');
  }
}

issuePrescription();
