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
            return;
        }

        // Read MSP config
        const mspConfigPath = '/shared/crypto-config/peerOrganizations/amarvote.com/msp/config.yaml';
        let mspConfig = undefined;
        if (fs.existsSync(mspConfigPath)) {
            mspConfig = fs.readFileSync(mspConfigPath, 'utf8');
        }

        // Create admin identity
        const x509Identity = {
            credentials: {
                certificate: fs.readFileSync('/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/signcerts/Admin@amarvote.com-cert.pem', 'utf8'),
                privateKey: fs.readFileSync('/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/keystore/priv_sk', 'utf8'),
            },
            mspId: 'AmarVoteOrgMSP',
            type: 'X.509',
        };

        await wallet.put('admin', x509Identity);
        console.log('✓ Successfully enrolled admin and imported to wallet');
    } catch (error) {
        console.error(`Failed to enroll admin: ${error}`);
        // Don't exit with error, just log it
        console.log('Will retry on next startup...');
    }
}

main();
