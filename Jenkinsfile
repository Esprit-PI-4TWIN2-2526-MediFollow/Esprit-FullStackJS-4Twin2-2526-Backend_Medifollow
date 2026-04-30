pipeline {
    agent any

    tools {
        nodejs 'nodejs'
    }

    stages {

        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/Esprit-PI-4TWIN2-2526-MediFollow/Esprit-FullStackJS-4Twin2-2526-Backend_Medifollow.git'
            }
        }

        stage('Install') {
            steps {
                sh 'npm install'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Test & Coverage') {
            steps {
                sh 'npm run test:cov'
            }
        }

        stage('SonarQube') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    script {
                        def scannerHome = tool 'sonar-scanner'
                        sh """
                        ${scannerHome}/bin/sonar-scanner \
                        -Dsonar.projectKey=MediFollow-Backend \
                        -Dsonar.sources=. \
                        -Dsonar.exclusions=node_modules/**,dist/**,coverage/** \
                        -Dsonar.tests=src \
                        -Dsonar.test.inclusions=**/*.spec.ts \
                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                        """
                    }
                }
            }
        }

        stage('Trigger CD Pipeline') {
    steps {
        build job: 'Medifollow-Backend_CD',
              wait: false,
              parameters: [
                  string(name: 'DOCKER_IMAGE_TAG', value: "${BUILD_NUMBER}")
              ]
    }
}

    }
}