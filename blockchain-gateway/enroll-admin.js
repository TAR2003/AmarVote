const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');

async function enrollAdmin() {
    try {
        // Create a new file system based wallet for managing identities
        const walletPath = path.join(__dirname, 'wallets');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        
        // Check if admin identity already exists
        const adminExists = await wallet.get('Admin');
        if (adminExists) {
            console.log('Admin identity already exists in the wallet');
            return;
        }

        // Load connection profile
        const connectionProfile = JSON.parse(fs.readFileSync(path.join(__dirname, 'connection-profile.json'), 'utf8'));
        
        // Get CA info
        const caInfo = connectionProfile.certificateAuthorities['ca.org1.amarvote.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        // Enroll admin user
        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        
        await wallet.put('Admin', x509Identity);
        console.log('Successfully enrolled admin user and imported it into the wallet');

    } catch (error) {
        console.error(`Failed to enroll admin user: ${error}`);
        process.exit(1);
    }
}

enrollAdmin();
