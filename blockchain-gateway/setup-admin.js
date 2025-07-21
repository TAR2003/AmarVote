const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function setupAdminIdentity() {
    try {
        console.log('🔧 Setting up admin identity...');
        
        // Create wallet directory using container paths
        const walletPath = '/app/wallets';
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        
        // Check if admin identity already exists (try both 'admin' and 'Admin')
        let adminExists = await wallet.get('admin');
        if (!adminExists) {
            adminExists = await wallet.get('Admin');
        }
        
        if (adminExists) {
            console.log('✅ Admin identity already exists in the wallet');
            return;
        }

        // Path to crypto materials using local writable directory
        const cryptoPath = '/app/crypto-local';
        const adminCertPath = path.join(cryptoPath, 'peerOrganizations', 'org1.amarvote.com', 'users', 'Admin@org1.amarvote.com', 'msp', 'signcerts');
        const adminKeyPath = path.join(cryptoPath, 'peerOrganizations', 'org1.amarvote.com', 'users', 'Admin@org1.amarvote.com', 'msp', 'keystore');

        console.log('📂 Checking crypto materials...');
        console.log('Certificate path:', adminCertPath);
        console.log('Key path:', adminKeyPath);

        // Check if crypto materials exist
        if (!fs.existsSync(adminCertPath) || !fs.existsSync(adminKeyPath)) {
            console.error('❌ Admin crypto materials not found');
            console.log('Expected cert path:', adminCertPath);
            console.log('Expected key path:', adminKeyPath);
            
            // List available files for debugging
            if (fs.existsSync(cryptoPath)) {
                console.log('Available files in crypto path:', fs.readdirSync(cryptoPath, { recursive: true }));
            }
            return;
        }

        // Read certificate
        console.log('📜 Reading certificate...');
        const certFiles = fs.readdirSync(adminCertPath);
        console.log('Certificate files found:', certFiles);
        const certFile = certFiles.find(file => file.endsWith('.pem'));
        if (!certFile) {
            console.error('❌ Admin certificate file not found');
            return;
        }
        const certificate = fs.readFileSync(path.join(adminCertPath, certFile), 'utf8');
        console.log('✅ Certificate loaded, length:', certificate.length);

        // Read private key
        console.log('🔑 Reading private key...');
        const keyFiles = fs.readdirSync(adminKeyPath);
        console.log('Key files found:', keyFiles);
        const keyFile = keyFiles.find(file => file.endsWith('_sk') || file === 'priv_sk');
        if (!keyFile) {
            console.error('❌ Admin private key file not found');
            console.log('Available key files:', keyFiles);
            return;
        }
        const privateKey = fs.readFileSync(path.join(adminKeyPath, keyFile), 'utf8');
        console.log('✅ Private key loaded, length:', privateKey.length);

        // Create identity
        const x509Identity = {
            credentials: {
                certificate: certificate,
                privateKey: privateKey,
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        
        // Store as lowercase 'admin' for consistency with server.js
        await wallet.put('admin', x509Identity);
        console.log('✅ Successfully created admin identity in wallet');

        // Verify the identity was stored
        const storedIdentity = await wallet.get('admin');
        if (storedIdentity) {
            console.log('✅ Verification: Admin identity found in wallet');
        } else {
            console.log('❌ Verification: Admin identity not found in wallet');
        }

    } catch (error) {
        console.error(`❌ Failed to setup admin identity: ${error.message}`);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

setupAdminIdentity();
