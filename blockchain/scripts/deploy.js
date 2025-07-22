const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('Starting blockchain deployment...');

// Wait for Ganache to be ready
function waitForGanache(retries = 30) {
    return new Promise((resolve, reject) => {
        const Web3 = require('web3');
        const web3 = new Web3(process.env.GANACHE_URL || 'http://ganache:8545');
        
        function checkConnection(attempt = 0) {
            web3.eth.getNodeInfo()
                .then(() => {
                    console.log('Ganache is ready!');
                    resolve();
                })
                .catch((error) => {
                    if (attempt < retries) {
                        console.log(`Waiting for Ganache... (${attempt + 1}/${retries})`);
                        setTimeout(() => checkConnection(attempt + 1), 2000);
                    } else {
                        reject(new Error('Ganache not ready after maximum retries'));
                    }
                });
        }
        checkConnection();
    });
}

async function deploy() {
    try {
        await waitForGanache();
        
        console.log('Compiling contracts...');
        const compile = spawn('npx', ['truffle', 'compile'], { 
            stdio: 'inherit',
            cwd: '/app'
        });
        
        await new Promise((resolve, reject) => {
            compile.on('close', (code) => {
                if (code === 0) {
                    console.log('Contracts compiled successfully!');
                    resolve();
                } else {
                    reject(new Error(`Compilation failed with code ${code}`));
                }
            });
        });
        
        console.log('Deploying contracts...');
        const migrate = spawn('npx', ['truffle', 'migrate', '--network', 'development'], { 
            stdio: 'inherit',
            cwd: '/app'
        });
        
        await new Promise((resolve, reject) => {
            migrate.on('close', (code) => {
                if (code === 0) {
                    console.log('Contracts deployed successfully!');
                    resolve();
                } else {
                    reject(new Error(`Migration failed with code ${code}`));
                }
            });
        });
        
        // Copy contract artifacts to shared volume
        const buildDir = '/app/build/contracts';
        const artifacts = fs.readdirSync(buildDir);
        
        artifacts.forEach(file => {
            if (file.endsWith('.json')) {
                const source = path.join(buildDir, file);
                const dest = path.join('/app/build', file);
                fs.copyFileSync(source, dest);
                console.log(`Copied ${file} to shared volume`);
            }
        });
        
        console.log('Deployment completed successfully!');
        
        // Keep the container running briefly to ensure artifacts are copied
        setTimeout(() => {
            process.exit(0);
        }, 5000);
        
    } catch (error) {
        console.error('Deployment failed:', error.message);
        process.exit(1);
    }
}

deploy();
