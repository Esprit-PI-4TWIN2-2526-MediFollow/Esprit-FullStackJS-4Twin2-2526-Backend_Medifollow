const https = require('https');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'face-models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir);
}

const models = [
  'ssdMobilenetv1Model-weights_manifest.json',
  'ssdMobilenetv1Model-shard1',
  'faceLandmark68Net-weights_manifest.json',
  'faceLandmark68Net-shard1',
  'faceRecognitionNet-weights_manifest.json',
  'faceRecognitionNet-shard1',
  'faceRecognitionNet-shard2',
];

const baseUrl = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${path.basename(dest)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function downloadModels() {
  console.log('Downloading face recognition models...');
  for (const model of models) {
    const url = baseUrl + model;
    const dest = path.join(modelsDir, model);
    try {
      await downloadFile(url, dest);
    } catch (error) {
      console.error(`Error downloading ${model}:`, error.message);
    }
  }
  console.log('All models downloaded!');
}

downloadModels();
