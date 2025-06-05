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
        console.log('Credentials (Base64):', credentials.substring(0, 20) + '...');

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
        console.error('Message:', error.message);
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
            token: token.substring(0, 20) + '...' // Masquer le token complet
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Route pour initier un paiement - FORMAT EXACT DE LA DOCUMENTATION
router.post('/initiate', async (req, res) => {
    try {
        const { amount, customerMsisdn, description } = req.body;

        // Validation des données
        if (!amount || !customerMsisdn) {
            return res.status(400).json({
                success: false,
                error: 'Montant et numéro client requis'
            });
        }

        // Vérifier que les numéros de test sont utilisés
        const validTestNumbers = ['0343500003', '0343500004'];
        if (!validTestNumbers.includes(customerMsisdn)) {
            return res.status(400).json({
                success: false,
                error: 'Utilisez uniquement les numéros de test: 0343500003 ou 0343500004'
            });
        }

        const accessToken = await getMVolaToken();
        const correlationId = `${Date.now()}`;

        // FORMAT EXACT de l'exemple CURL de la documentation - CHAMPS VIDES COMME DANS LA DOC !
        const transactionData = {
            "amount": amount.toString(),
            "currency": "Ar",
            "descriptionText": description || "Paiement Demo MVola",
            "requestingOrganisationTransactionReference": "", // VIDE comme dans la doc !
            "requestDate": "", // VIDE comme dans la doc !
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
                    "value": process.env.PARTNER_MSISDN || "0343500003"
                }
            ],
            "metadata": [
                {
                    "key": "partnerName",
                    "value": process.env.PARTNER_NAME || "Demo Store"
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

        console.log('=== INITIATION PAIEMENT MVOLA ===');
        console.log('URL:', process.env.MVOLA_PAYMENT_URL);
        console.log('Partner MSISDN:', process.env.PARTNER_MSISDN);
        console.log('Partner Name:', process.env.PARTNER_NAME);
        console.log('Correlation ID:', correlationId);
        console.log('Customer MSISDN:', customerMsisdn);
        console.log('Amount:', amount);
        console.log('Transaction Data:', JSON.stringify(transactionData, null, 2));

        // Headers EXACTEMENT comme dans l'exemple CURL - MÊME ORDRE !
        const response = await axios.post(process.env.MVOLA_PAYMENT_URL, transactionData, {
            headers: {
                'Version': '1.0',
                'X-CorrelationID': correlationId,
                'UserLanguage': 'mg',
                'UserAccountIdentifier': `msisdn;${process.env.PARTNER_MSISDN || "0343500003"}`,
                'partnerName': process.env.PARTNER_NAME || "Demo Store",
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'Cache-Control': 'no-cache'
            },
            timeout: 30000
        });

        console.log('=== SUCCÈS MVOLA ===');
        console.log('Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));

        res.json({
            success: true,
            data: response.data,
            message: 'Transaction initiée avec succès',
            correlationId: correlationId
        });

    } catch (error) {
        console.error('=== ERREUR INITIATION PAIEMENT ===');
        console.error('Error Type:', error.constructor.name);
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Request URL:', error.config?.url);
        console.error('Request Headers:', JSON.stringify(error.config?.headers, null, 2));
        console.error('Request Data:', error.config?.data);
        console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Message:', error.message);
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Erreur lors de l\'initiation du paiement',
            details: error.response?.data || error.message,
            httpStatus: error.response?.status || 500
        });
    }
});

// Route pour vérifier le statut d'une transaction
router.get('/status/:serverCorrelationId', async (req, res) => {
    try {
        const { serverCorrelationId } = req.params;
        
        if (!serverCorrelationId) {
            return res.status(400).json({
                success: false,
                error: 'ID de correlation requis'
            });
        }

        const accessToken = await getMVolaToken();
        const correlationId = `STATUS_${Date.now()}`;

        console.log('=== VÉRIFICATION STATUT ===');
        console.log('Server Correlation ID:', serverCorrelationId);
        console.log('URL:', `${process.env.MVOLA_PAYMENT_URL}/status/${serverCorrelationId}`);

        const response = await axios.get(
            `${process.env.MVOLA_PAYMENT_URL}/status/${serverCorrelationId}`,
            {
                headers: {
                    'Version': '1.0',
                    'X-CorrelationID': correlationId,
                    'UserLanguage': 'mg',
                    'UserAccountIdentifier': `msisdn;${process.env.PARTNER_MSISDN || "0343500003"}`,
                    'partnerName': process.env.PARTNER_NAME || "Demo Store",
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'Cache-Control': 'no-cache'
                },
                timeout: 30000
            }
        );

        console.log('=== STATUT RÉCUPÉRÉ ===');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

        res.json({
            success: true,
            data: response.data,
            message: 'Statut récupéré avec succès'
        });

    } catch (error) {
        console.error('=== ERREUR VÉRIFICATION STATUT ===');
        console.error('Status:', error.response?.status);
        console.error('Response:', JSON.stringify(error.response?.data, null, 2));
        console.error('Message:', error.message);
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Erreur lors de la vérification du statut',
            details: error.response?.data || error.message
        });
    }
});

// Route pour récupérer les détails d'une transaction
router.get('/details/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params;
        
        if (!transactionId) {
            return res.status(400).json({
                success: false,
                error: 'ID de transaction requis'
            });
        }

        const accessToken = await getMVolaToken();
        const correlationId = `DETAILS_${Date.now()}`;

        const response = await axios.get(
            `${process.env.MVOLA_PAYMENT_URL}/${transactionId}`,
            {
                headers: {
                    'Version': '1.0',
                    'X-CorrelationID': correlationId,
                    'UserLanguage': 'mg',
                    'UserAccountIdentifier': `msisdn;${process.env.PARTNER_MSISDN || "0343500003"}`,
                    'partnerName': process.env.PARTNER_NAME || "Demo Store",
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'Cache-Control': 'no-cache'
                },
                timeout: 30000
            }
        );

        res.json({
            success: true,
            data: response.data,
            message: 'Détails récupérés avec succès'
        });

    } catch (error) {
        console.error('=== ERREUR RÉCUPÉRATION DÉTAILS ===');
        console.error('Status:', error.response?.status);
        console.error('Response:', JSON.stringify(error.response?.data, null, 2));
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Erreur lors de la récupération des détails',
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

// Route de test pour vérifier les variables d'environnement
router.get('/config', (req, res) => {
    res.json({
        success: true,
        config: {
            authUrl: process.env.MVOLA_AUTH_URL,
            paymentUrl: process.env.MVOLA_PAYMENT_URL,
            partnerName: process.env.PARTNER_NAME,
            partnerMsisdn: process.env.PARTNER_MSISDN,
            consumerKeyPresent: !!process.env.MVOLA_CONSUMER_KEY,
            consumerSecretPresent: !!process.env.MVOLA_CONSUMER_SECRET,
            nodeEnv: process.env.NODE_ENV
        }
    });
});

module.exports = router;
