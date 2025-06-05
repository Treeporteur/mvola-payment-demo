const express = require('express');
const axios = require('axios');
const router = express.Router();

// Fonction pour obtenir le token d'authentification MVola
async function getMVolaToken() {
    try {
        const credentials = Buffer.from(
            `${process.env.MVOLA_CONSUMER_KEY}:${process.env.MVOLA_CONSUMER_SECRET}`
        ).toString('base64');

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

        return response.data.access_token;
    } catch (error) {
        console.error('Erreur authentification MVola:', error.response?.data || error.message);
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

// Route pour initier un paiement
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

        // Obtenir le token d'authentification
        const accessToken = await getMVolaToken();

        // Préparer les données de la transaction (format exact de la documentation)
        const transactionData = {
            amount: amount.toString(),
            currency: "Ar",
            descriptionText: description || "Paiement Demo MVola",
            requestingOrganisationTransactionReference: "",
            requestDate: "",
            originalTransactionReference: "",
            debitParty: [
                {
                    key: "msisdn",
                    value: customerMsisdn
                }
            ],
            creditParty: [
                {
                    key: "msisdn", 
                    value: process.env.PARTNER_MSISDN
                }
            ],
            metadata: [
                {
                    key: "partnerName",
                    value: process.env.PARTNER_NAME
                },
                {
                    key: "fc",
                    value: "USD"
                },
                {
                    key: "amountFc", 
                    value: "1"
                }
            ]
        };

        console.log('Données envoyées à MVola:', JSON.stringify(transactionData, null, 2));

        // Appel à l'API MVola
        const response = await axios.post(process.env.MVOLA_PAYMENT_URL, transactionData, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Version': '1.0',
                'X-CorrelationID': `CORR_${Date.now()}`,
                'UserLanguage': 'FR',
                'UserAccountIdentifier': `msisdn;${process.env.PARTNER_MSISDN}`,
                'partnerName': process.env.PARTNER_NAME,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        console.log('Réponse MVola:', response.data);

        res.json({
            success: true,
            data: response.data,
            message: 'Transaction initiée avec succès'
        });

    } catch (error) {
        console.error('Erreur initiation paiement:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'initiation du paiement',
            details: error.response?.data || error.message
        });
    }
});

// Route pour vérifier le statut d'une transaction
router.get('/status/:serverCorrelationId', async (req, res) => {
    try {
        const { serverCorrelationId } = req.params;
        const accessToken = await getMVolaToken();

        const response = await axios.get(
            `${process.env.MVOLA_PAYMENT_URL}/status/${serverCorrelationId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Version': '1.0',
                    'X-CorrelationID': `STATUS_${Date.now()}`,
                    'UserLanguage': 'FR',
                    'UserAccountIdentifier': `msisdn;${process.env.PARTNER_MSISDN}`,
                    'partnerName': process.env.PARTNER_NAME,
                    'Cache-Control': 'no-cache'
                }
            }
        );

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('Erreur vérification statut:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la vérification du statut'
        });
    }
});

module.exports = router;
