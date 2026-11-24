# Enlace n8n → Plataforma Porcicola Ops

Endpoint que recibe pedidos confirmados del bot WhatsApp (n8n) y los crea en la plataforma en estado **`capturado`**.

## URL

```
POST {BASE_URL}/api/enlace/pedidos
```

Ejemplos:

- Local: `http://localhost:8080/api/enlace/pedidos` (o el puerto de `vite dev`)
- Producción: `https://tu-dominio.com/api/enlace/pedidos`

## Autenticación

Header obligatorio (elige uno):

```
X-Enlace-Secret: porcicola-enlace-demo
```

o

```
Authorization: Bearer porcicola-enlace-demo
```

En demo el secreto por defecto es `porcicola-enlace-demo`. En producción define `ENLACE_API_KEY` en el servidor.

## Body (lo que manda n8n)

La plataforma acepta el **item crudo** del AI Agent (recomendado), el JSON de comanda ya parseado, `{ pedido, chatId }`, o un array (usa el primero).

### Formato crudo (como sale del bot)

```json
{
  "output": "{\"estado\":\"confirmado\",\"cliente\":{\"nombre\":\"Edier\",...},\"productos\":[...]}",
  "body": {
    "instanceData": {
      "wid": "573195658769@c.us"
    }
  }
}
```

El servidor parsea `output` y toma el WhatsApp id de `body.instanceData.wid` → `cliente_chat_id`.

Solo se aceptan pedidos con `estado: "confirmado"` (si el campo no viene, también se acepta).

## Respuesta 201

```json
{
  "ok": true,
  "pedido_id": "uuid",
  "codigo": "ORD-2001",
  "status": "capturado",
  "monto_estimado": 87500,
  "lineas": 1
}
```

## Nodo HTTP Request en n8n

1. Después del IF que valida `estado === confirmado`, agrega **HTTP Request**.
2. Method: `POST`
3. URL: `{{$env.PLATAFORMA_ENLACE_URL}}` → p.ej. `http://host.docker.internal:8080/api/enlace/pedidos`
4. Authentication: None (usa header custom)
5. Headers:
   - `Content-Type` = `application/json`
   - `X-Enlace-Secret` = `{{$env.ENLACE_API_KEY}}`
6. Body: manda el item completo del nodo anterior.

### Body más simple (recomendado)

Specify Body → **Using JSON** → expression:

```
={{ $json }}
```

Así se envía `output` + `body.instanceData.wid` sin parsear a mano. La plataforma lo entiende.

## GET de prueba

```bash
curl -s -H "X-Enlace-Secret: porcicola-enlace-demo" \
  http://localhost:8080/api/enlace/pedidos
```

```bash
curl -s -X POST http://localhost:8080/api/enlace/pedidos \
  -H "Content-Type: application/json" \
  -H "X-Enlace-Secret: porcicola-enlace-demo" \
  -d @- <<'EOF'
{
  "estado": "confirmado",
  "chatId": "573001112233@c.us",
  "cliente": { "nombre": "Prueba Enlace", "telefono": "3000000000" },
  "productos": [
    { "codigo": "PLU-201", "producto": "Lomo sin hueso", "cantidad": 1, "unidad": "KG" }
  ]
}
EOF
```

En modo demo el pedido aparece en la cola **Comercial** (se fusiona con el seed local).

## Mapeo a la plataforma

| Bot / n8n | Pedido plataforma |
|-----------|-------------------|
| `cliente.*` | `cliente_*` |
| `chatId` | `cliente_chat_id` |
| `productos[]` | `pedido_lineas` |
| `estado: confirmado` | `status: capturado` |
| — | `origen: bot` |
| prep / empaque / observaciones | texto en línea + `notas_comercial` |

Precios: si el producto no trae `precio_unitario`, se toma del catálogo PLU de la plataforma.
