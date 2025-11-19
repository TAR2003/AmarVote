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
            console.log('✓ Admin identity already exists in wallet');
            return;
        }

        // Define paths
        const certPath = '/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/signcerts/Admin@amarvote.com-cert.pem';
        const keyPath = '/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/keystore/priv_sk';

        // Check if crypto materials exist
        if (!fs.existsSync(certPath)) {
            throw new Error(`Certificate not found at: ${certPath}`);
        }
        if (!fs.existsSync(keyPath)) {
            throw new Error(`Private key not found at: ${keyPath}`);
        }

        console.log('✓ Crypto materials found');
        console.log(`  Certificate: ${certPath}`);
        console.log(`  Private Key: ${keyPath}`);

        // Read certificate and key
        const certificate = fs.readFileSync(certPath, 'utf8');
        const privateKey = fs.readFileSync(keyPath, 'utf8');

        console.log('✓ Successfully read crypto materials');
        console.log(`  Certificate length: ${certificate.length}`);
        console.log(`  Private key length: ${privateKey.length}`);

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
        console.log(`  MSP ID: ${x509Identity.mspId}`);
        console.log(`  Type: ${x509Identity.type}`);
        
        // Verify the identity was stored
        const verifyIdentity = await wallet.get('admin');
        if (verifyIdentity) {
            console.log('✓ Verified admin identity in wallet');
        } else {
            throw new Error('Failed to verify admin identity after storing');
        }

    } catch (error) {
        console.error(`✗ Failed to enroll admin: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        process.exit(1);
    }
}

main();
