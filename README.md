# Epistocracy Backend Web3


Backend Node.js che gestisce automaticamente:
- Monitoraggio depositi su Dodo Exchange (Polygon)
- Accrediti automatici sul wallet utenti
- Prelievi automatici verso wallet MetaMask


## Variabili Ambiente Richieste




DATABASE_URL=postgresql://... POLYGON_RPC_URL=https://polygon-rpc.com DEUR_TOKEN_ADDRESS=0xb0f517bf6cb24714b3b86f3ea8c237eb24f4d8cd DUSD_TOKEN_ADDRESS=0x284ffff6f55196694eca7bcb8e7a894c644355f8 DCNY_TOKEN_ADDRESS=0xc087c1ff94e139312d8b0327cc828341061698e0 PLATFORM_WALLET_ADDRESS=0x8ecd3463bea3eC99B3BBf81cd8502D84E5A60179 PLATFORM_WALLET_PRIVATE_KEY=your_private_key_here MIN_CONFIRMATIONS=12 MAX_DAILY_WITHDRAWAL=10000 NODE_ENV=production


## Deploy su Railway


1. Push su GitHub
2. Railway → New Project → Deploy from GitHub
3. Aggiungi tutte le variabili ambiente
4. Railway fa deploy automatico
5. Genera dominio pubblico


## Endpoints API


- `GET /health` - Health check
- `GET /api/deposits/:email/pending` - Get pending deposits
- `POST /api/deposits/mark-processed` - Mark deposits processed
- `POST /api/withdrawal/request` - Request withdrawal
