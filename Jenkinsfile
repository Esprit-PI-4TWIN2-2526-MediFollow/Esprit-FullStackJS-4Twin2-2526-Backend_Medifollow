pipeline {
    agent any
    tools {
    nodejs 'nodejs'
    }

    environment {
        SONAR_TOKEN = credentials('sonar-token')
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
                -Dsonar.sources=src \
                -Dsonar.host.url=http://localhost:9000 \
                -Dsonar.login=$SONAR_TOKEN \
                -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                """
            }
        }
    }
        }

        stage('Deploy to Kubernetes') {
    steps {
        sh '''
        export KUBECONFIG=$HOME/.kube/config
        kubectl apply -f deployment.yaml
        kubectl apply -f service.yaml
        kubectl rollout restart deployment medifollow-backend
        '''
    }
}
stage('Test Kubernetes') {
    steps {
        sh 'kubectl get nodes'
    }
}

        
    }
}