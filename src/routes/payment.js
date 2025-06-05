// Format EXACT de l'exemple CURL de la documentation
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
    ]
};
