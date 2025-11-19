const { Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function main() {
    try {
        // Create wallet directory
        const walletPath = path.join(process.cwd(), 'wallet');
        if (!fs.existsSync(walletPath)) {
            fs.mkdirSync(walletPath, { recursive: true });
        }

        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check if admin already enrolled
        const identity = await wallet.get('admin');
        if (identity) {
            console.log('Admin identity already exists in wallet');
            // Verify the identity is still valid
            const certPath = '/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/signcerts/Admin@amarvote.com-cert.pem';
            if (fs.existsSync(certPath)) {
                const currentCert = fs.readFileSync(certPath, 'utf8');
                if (identity.credentials.certificate === currentCert) {
                    console.log('✓ Admin identity is valid and up-to-date');
                    return;
                } else {
                    console.log('⚠ Admin certificate changed, re-enrolling...');
                    await wallet.remove('admin');
                }
            }
        }

        // Wait for crypto materials to be available
        const certPath = '/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/signcerts/Admin@amarvote.com-cert.pem';
        const maxRetries = 30;
        let retries = 0;
        
        while (!fs.existsSync(certPath) && retries < maxRetries) {
            console.log(`Waiting for crypto materials... (${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            retries++;
        }

        if (!fs.existsSync(certPath)) {
            throw new Error('Crypto materials not found after waiting');
        }

        // Find the private key file
        const keystorePath = '/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/keystore';
        const keyFiles = fs.readdirSync(keystorePath);
        const privKeyFile = keyFiles.find(file => file.endsWith('_sk'));
        
        if (!privKeyFile) {
            throw new Error('Private key file not found in keystore');
        }

        console.log('Reading certificates...');
        const certificate = fs.readFileSync(certPath, 'utf8');
        const privateKey = fs.readFileSync(path.join(keystorePath, privKeyFile), 'utf8');

        // Verify certificate and key are valid
        if (!certificate.includes('BEGIN CERTIFICATE') || !privateKey.includes('BEGIN PRIVATE KEY')) {
            throw new Error('Invalid certificate or private key format');
        }

        // Create admin identity
        const x509Identity = {
            credentials: {
                certificate: certificate,
                privateKey: privateKey,
            },
            mspId: 'AmarVoteOrgMSP',
            type: 'X.509',
        };

        await wallet.put('admin', x509Identity);
        console.log('✓ Successfully enrolled admin and imported to wallet');
        console.log('✓ MSP ID: AmarVoteOrgMSP');
        console.log('✓ Certificate Subject: Admin@amarvote.com');
    } catch (error) {
        console.error(`Failed to enroll admin: ${error.message}`);
        console.error('Stack trace:', error.stack);
        // Don't exit with error, just log it
        console.log('Will retry on next startup...');
    }
}

main();
