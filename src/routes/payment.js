const express = require('express');
const axios = require('axios');
const router = express.Router();

// Fonction pour obtenir le token d'authentification MVola
async function getMVolaToken() {
    try {
        const credentials = Buffer.from(
            `${process.env.MVOLA_CONSUMER_KEY}:${process.env.MVOLA_CONSUMER_SECRET}`
        ).toString('base64');

        console.log('=== AUTHENTIFICATION MVOLA ===');
        console.log('URL:', process.env.MVOLA_AUTH_URL);
        console.log('Consumer Key:', process.env.MVOLA_CONSUMER_KEY);

        const response = await axios.post(process.env.MVOLA_AUTH_URL, 
            'grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE',
            {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cache-Control': 'no-cache'
                }
            }
        );

        console.log('Token obtenu avec succès');
        return response.data.access_token;
    } catch (error) {
        console.error('=== ERREUR AUTHENTIFICATION ===');
        console.error('Status:', error.response?.status);
        console.error('Response:', error.response?.data);
        throw new Error('Impossible d\'obtenir le token MVola');
    }
}

// Route pour obtenir un token (test)
router.get('/token', async (req, res) => {
    try {
        const token = await getMVolaToken();
        res.json({ 
            success: true, 
            message: 'Token obtenu avec succès',
            token: token.substring(0, 20) + '...'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Route pour initier un paiement - REPRODUCTION EXACTE DU CURL DE LA DOCUMENTATION
router.post('/initiate', async (req, res) => {
    try {
        const { amount, customerMsisdn, description } = req.body;

        if (!amount || !customerMsisdn) {
            return res.status(400).json({
                success: false,
                error: 'Montant et numéro client requis'
            });
        }

        // Valider les numéros de test
        const validTestNumbers = ['0343500003', '0343500004'];
        if (!validTestNumbers.includes(customerMsisdn)) {
            return res.status(400).json({
                success: false,
                error: 'Utilisez uniquement: 0343500003 ou 0343500004'
            });
        }

        const accessToken = await getMVolaToken();
        const correlationId = `${Date.now()}`;

        // DONNÉES EXACTEMENT comme dans l'exemple CURL - MÊME ORDRE !
        const transactionData = {
            "amount": amount.toString(),
            "currency": "Ar",
            "descriptionText": description || "Paiement Demo MVola",
            "requestingOrganisationTransactionReference": "",
            "requestDate": "",
            "originalTransactionReference": "",
            "debitParty": [
                {
                    "key": "msisdn",
                    "value": customerMsisdn
                }
            ],
            "creditParty": [
                {
                    "key": "msisdn",
                    "value": "0343500003" // HARDCODED comme dans la doc de test
                }
            ],
            "metadata": [
                {
                    "key": "partnerName",
                    "value": "Demo Store" // HARDCODED pour les tests
                },
                {
                    "key": "fc", 
                    "value": "USD"
                },
                {
                    "key": "amountFc",
                    "value": "1"
                }
            ]
        };

        console.log('=== REQUÊTE MVOLA EXACTE ===');
        console.log('URL avec slash final:', `${process.env.MVOLA_PAYMENT_URL}/`);
        console.log('Correlation ID:', correlationId);
        console.log('Customer MSISDN:', customerMsisdn);
        console.log('Credit Party (Marchand):', "0343500003");
        console.log('Amount:', amount);
        console.log('Transaction Data EXACTE:', JSON.stringify(transactionData, null, 2));

        // URL AVEC SLASH FINAL comme dans la documentation !
        const url = `${process.env.MVOLA_PAYMENT_URL}/`;

        // HEADERS dans l'ordre EXACT de l'exemple CURL !
        const headers = {
            'Version': '1.0',
            'X-CorrelationID': correlationId,
            'UserLanguage': 'mg',
            'UserAccountIdentifier': 'msisdn;0343500003', // HARDCODED pour test
            'partnerName': 'Demo Store', // HARDCODED pour test
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'Cache-Control': 'no-cache'
        };

        console.log('=== HEADERS EXACTS ===');
        console.log(JSON.stringify(headers, null, 2));

        const response = await axios.post(url, transactionData, {
            headers: headers,
            timeout: 30000
        });

        console.log('=== SUCCÈS MVOLA ===');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));

        res.json({
            success: true,
            data: response.data,
            message: 'Transaction initiée avec succès !',
            correlationId: correlationId
        });

    } catch (error) {
        console.error('=== ERREUR DÉTAILLÉE MVOLA ===');
        console.error('URL utilisée:', `${process.env.MVOLA_PAYMENT_URL}/`);
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Request Headers:', JSON.stringify(error.config?.headers, null, 2));
        console.error('Request Data:', JSON.stringify(JSON.parse(error.config?.data || '{}'), null, 2));
        console.error('Response Headers:', error.response?.headers);
        console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Error Message:', error.message);
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Erreur lors de l\'initiation du paiement',
            details: error.response?.data || error.message,
            httpStatus: error.response?.status || 500,
            requestUrl: `${process.env.MVOLA_PAYMENT_URL}/`,
            correlationId: `${Date.now()}`
        });
    }
});

// Route pour vérifier le statut d'une transaction
router.get('/status/:serverCorrelationId', async (req, res) => {
    try {
        const { serverCorrelationId } = req.params;
        const accessToken = await getMVolaToken();
        const correlationId = `STATUS_${Date.now()}`;

        console.log('=== VÉRIFICATION STATUT ===');
        console.log('Server Correlation ID:', serverCorrelationId);

        // URL avec slash final pour status aussi
        const url = `${process.env.MVOLA_PAYMENT_URL}/status/${serverCorrelationId}`;
        console.log('Status URL:', url);

        const response = await axios.get(url, {
            headers: {
                'Version': '1.0',
                'X-CorrelationID': correlationId,
                'UserLanguage': 'mg',
                'UserAccountIdentifier': 'msisdn;0343500003',
                'partnerName': 'Demo Store',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'Cache-Control': 'no-cache'
            },
            timeout: 30000
        });

        console.log('=== STATUT RÉCUPÉRÉ ===');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

        res.json({
            success: true,
            data: response.data,
            message: 'Statut récupéré avec succès'
        });

    } catch (error) {
        console.error('=== ERREUR STATUT ===');
        console.error('Status:', error.response?.status);
        console.error('Response:', JSON.stringify(error.response?.data, null, 2));
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Erreur lors de la vérification du statut',
            details: error.response?.data || error.message
        });
    }
});

// Route callback pour MVola
router.put('/callback', (req, res) => {
    console.log('=== CALLBACK MVOLA REÇU ===');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    res.status(200).json({ 
        status: 'received',
        timestamp: new Date().toISOString()
    });
});

// Route de test pour vérifier la configuration
router.get('/config', (req, res) => {
    res.json({
        success: true,
        config: {
            authUrl: process.env.MVOLA_AUTH_URL,
            paymentUrl: process.env.MVOLA_PAYMENT_URL,
            paymentUrlWithSlash: `${process.env.MVOLA_PAYMENT_URL}/`,
            partnerName: process.env.PARTNER_NAME,
            partnerMsisdn: process.env.PARTNER_MSISDN,
            consumerKeyPresent: !!process.env.MVOLA_CONSUMER_KEY,
            consumerSecretPresent: !!process.env.MVOLA_CONSUMER_SECRET,
            nodeEnv: process.env.NODE_ENV
        }
    });
});

// Route de test direct avec l'API MVola pour debug
router.post('/debug-direct', async (req, res) => {
    try {
        const accessToken = await getMVolaToken();
        
        // Test avec les données exactes de la documentation
        const testData = {
            "amount": "1000",
            "currency": "Ar",
            "descriptionText": "Test debug direct",
            "requestingOrganisationTransactionReference": "",
            "requestDate": "",
            "originalTransactionReference": "",
            "debitParty": [{"key": "msisdn", "value": "0343500004"}],
            "creditParty": [{"key": "msisdn", "value": "0343500003"}],
            "metadata": [
                {"key": "partnerName", "value": "Demo Store"},
                {"key": "fc", "value": "USD"},
                {"key": "amountFc", "value": "1"}
            ]
        };

        console.log('=== TEST DEBUG DIRECT ===');
        console.log('Data:', JSON.stringify(testData, null, 2));

        const response = await axios.post(`${process.env.MVOLA_PAYMENT_URL}/`, testData, {
            headers: {
                'Version': '1.0',
                'X-CorrelationID': `DEBUG_${Date.now()}`,
                'UserLanguage': 'mg',
                'UserAccountIdentifier': 'msisdn;0343500003',
                'partnerName': 'Demo Store',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'Cache-Control': 'no-cache'
            }
        });

        res.json({
            success: true,
            data: response.data,
            message: 'Test debug réussi !'
        });

    } catch (error) {
        console.error('=== ERREUR TEST DEBUG ===');
        console.error('Response:', JSON.stringify(error.response?.data, null, 2));
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Erreur test debug',
            details: error.response?.data || error.message
        });
    }
});

module.exports = router;
