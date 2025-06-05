// Route pour initier un paiement
router.post('/initiate', async (req, res) => {
    try {
        const { amount, customerMsisdn, description } = req.body;

        if (!amount || !customerMsisdn) {
            return res.status(400).json({
                success: false,
                error: 'Montant et numéro client requis'
            });
        }

        const accessToken = await getMVolaToken();

        // Générer IDs uniques et date au bon format
        const correlationId = `CORR_${Date.now()}`;
        const transactionRef = `DEMO_${Date.now()}`;
        const requestDate = new Date().toISOString();

        // Format EXACT selon les tests qui marchent
        const transactionData = {
            "amount": amount.toString(),
            "currency": "Ar",
            "descriptionText": description || "Paiement Demo MVola",
            "requestDate": requestDate,
            "debitParty": [
                {
                    "key": "msisdn",
                    "value": customerMsisdn
                }
            ],
            "creditParty": [
                {
                    "key": "msisdn",
                    "value": process.env.PARTNER_MSISDN
                }
            ],
            "metadata": [
                {
                    "key": "partnerName",
                    "value": process.env.PARTNER_NAME
                },
                {
                    "key": "fc",
                    "value": "USD"
                },
                {
                    "key": "amountFc",
                    "value": "1"
                }
            ],
            "requestingOrganisationTransactionReference": transactionRef,
            "originalTransactionReference": ""
        };

        console.log('=== REQUÊTE MVOLA ===');
        console.log('URL:', process.env.MVOLA_PAYMENT_URL);
        console.log('Correlation ID:', correlationId);
        console.log('Transaction Ref:', transactionRef);
        console.log('Data:', JSON.stringify(transactionData, null, 2));

        // Headers dans l'ordre exact de la documentation + casse correcte
        const response = await axios.post(process.env.MVOLA_PAYMENT_URL, transactionData, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Version': '1.0',
                'X-CorrelationID': correlationId,
                'UserLanguage': 'FR',
                'UserAccountIdentifier': `msisdn;${process.env.PARTNER_MSISDN}`,
                'partnerName': process.env.PARTNER_NAME,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        console.log('=== RÉPONSE MVOLA SUCCESS ===');
        console.log('Status:', response.status);
        console.log('Data:', response.data);

        res.json({
            success: true,
            data: response.data,
            message: 'Transaction initiée avec succès'
        });

    } catch (error) {
        console.error('=== ERREUR MVOLA DÉTAILLÉE ===');
        console.error('URL:', process.env.MVOLA_PAYMENT_URL);
        console.error('Status Code:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Headers Response:', error.response?.headers);
        console.error('Réponse complète:', JSON.stringify(error.response?.data, null, 2));
        console.error('Message:', error.message);
        console.error('Config:', error.config);
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Erreur lors de l\'initiation du paiement',
            details: error.response?.data || error.message,
            httpStatus: error.response?.status
        });
    }
});
