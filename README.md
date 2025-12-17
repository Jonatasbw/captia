# Captia - HubSpot Meeting Summarizer

## 🚀 Deploy Rápido

### 1. Fazer upload no GitHub
- Extraia este ZIP
- Crie repositório novo no GitHub
- Faça upload de todos os arquivos

### 2. Deploy na Vercel
- Conecte o repositório na Vercel
- Configure as 4 variáveis de ambiente
- Deploy automático

### 3. Variáveis necessárias
```
HUBSPOT_CLIENT_ID=seu-client-id
HUBSPOT_CLIENT_SECRET=seu-client-secret
REDIRECT_URI=https://seu-projeto.vercel.app/api/oauth
NODE_ENV=production
```

### 4. Configurar no HubSpot
- Adicionar Redirect URL no app
- Adicionar scopes: oauth, crm.objects.contacts.write

### 5. Testar
```
https://seu-projeto.vercel.app/api/oauth?code=teste
```

✅ Pronto para usar! 
