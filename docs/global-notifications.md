# Notificacoes Globais

O FinScope agora suporta notificacoes globais no sino da plataforma e, opcionalmente, disparo por email para usuarios ativos.

## Variaveis de ambiente

Configure no `.env`:

```env
BROADCAST_ADMIN_TOKEN=defina-um-token-forte
APP_URL=https://app.finscope.com.br
MAIL_HOST=smtp.titan.email
MAIL_PORT=465
MAIL_USER=seu-remetente@seudominio.com
MAIL_PASS=sua-senha
MAIL_FROM=FinScope <contato@finscope.com.br>
BROADCAST_EMAIL_FROM=FinScope <contato@finscope.com.br>
```

`BROADCAST_ADMIN_TOKEN` protege os endpoints administrativos de broadcast.
`APP_URL` e usada para transformar rotas internas como `/dashboard` em links absolutos no e-mail.

## Endpoint de criacao

`POST /api/admin/broadcast-notifications`

Headers:

```http
x-broadcast-token: SEU_TOKEN
Content-Type: application/json
```

Payload base:

```json
{
  "title": "Nova funcao no FinScope",
  "message": "Agora voce pode acompanhar metas, limites e lembretes em um so lugar.",
  "kind": "global_update",
  "bucket": "updates",
  "route": "/ai",
  "ctaLabel": "Abrir novidade",
  "startsAt": "2026-03-17T18:00:00.000Z",
  "expiresAt": "2026-03-24T23:59:59.000Z",
  "sendEmail": false
}
```

Valores aceitos:

- `kind`: `global_update` | `global_promotion` | `global_alert`
- `bucket`: `general` | `updates` | `promotions`

## Exemplos

### PowerShell

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-broadcast-token" = "SEU_TOKEN"
}

$body = @{
  title = "Novo resumo mensal"
  message = "O resumo mensal agora chega com cards e graficos mais legiveis no WhatsApp e no painel."
  kind = "global_update"
  bucket = "updates"
  route = "/dashboard"
  ctaLabel = "Ver painel"
  sendEmail = $false
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:5000/api/admin/broadcast-notifications" `
  -Headers $headers `
  -Body $body
```

### curl

Atualizacao de produto:

```bash
curl -X POST http://localhost:5000/api/admin/broadcast-notifications \
  -H "Content-Type: application/json" \
  -H "x-broadcast-token: SEU_TOKEN" \
  -d '{
    "title": "Novo resumo mensal",
    "message": "O resumo mensal agora chega com cards e graficos mais legiveis no WhatsApp e no painel.",
    "kind": "global_update",
    "bucket": "updates",
    "route": "/dashboard",
    "ctaLabel": "Ver painel"
  }'
```

Promocao com email:

```bash
curl -X POST http://localhost:5000/api/admin/broadcast-notifications \
  -H "Content-Type: application/json" \
  -H "x-broadcast-token: SEU_TOKEN" \
  -d '{
    "title": "Upgrade Premium com condicao especial",
    "message": "Assine o Premium esta semana e libere automacoes, relatorios e controle PJ completo.",
    "kind": "global_promotion",
    "bucket": "promotions",
    "route": "/settings",
    "ctaLabel": "Ver planos",
    "sendEmail": true,
    "emailSubject": "Condicao especial para upgrade Premium"
  }'
```

Alerta critico:

```bash
curl -X POST http://localhost:5000/api/admin/broadcast-notifications \
  -H "Content-Type: application/json" \
  -H "x-broadcast-token: SEU_TOKEN" \
  -d '{
    "title": "Manutencao programada",
    "message": "Hoje, entre 23h e 23h30, o painel pode oscilar durante uma atualizacao.",
    "kind": "global_alert",
    "bucket": "general",
    "ctaLabel": "Entendido"
  }'
```

## Listagem

`GET /api/admin/broadcast-notifications`

Header:

```http
x-broadcast-token: SEU_TOKEN
```

Esse endpoint retorna as ultimas notificacoes globais cadastradas.
