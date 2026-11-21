# porcicola-Bot

Bot de WhatsApp para una carnicería de cerdo. Recibe mensajes vía **Green-API**, los procesa con un **AI Agent** en **n8n** (OpenAI) y responde al cliente por WhatsApp.

> **Versión en este commit: v3** (`workflows/wappBotPorcicola.json`)
>
> Esta versión **funciona como vendedor virtual**, pero tiene un **bug crítico de mensajes infinitos**.

---

## Qué hace el workflow (v3)

Flujo:

```
Webhook Green-API
  → Edit Fields (normaliza chatId, nombre, texto)
  → AI Agent (vendedor + catálogo PLU + memoria)
  → Edit Fields1 (prepara output + chatId)
  → HTTP Request (envía respuesta a Green-API / WhatsApp)
```

### Nodos

| Nodo | Función |
|------|---------|
| **Webhook Green-API** | Recibe POST de Green-API en `/wapp-bot-porcicola` |
| **Edit Fields** | Extrae `textMessage`, `chatId`, `senderName`, `idInstance` |
| **AI Agent** | Atiende como vendedor: saludo, pedido, cantidades, empaque, datos del cliente, confirmación |
| **OpenAI Chat Model** | Modelo LLM (`gpt-5-mini`) |
| **Simple Memory** | Memoria por conversación (clave = `wid` / chat) |
| **Edit Fields1** | Une la respuesta del agente con el `chatId` |
| **HTTP Request** | `sendMessage` de Green-API hacia el cliente |

### Capacidades del agente (prompt)

- Catálogo de cortes de cerdo (PLU-201 … PLU-212) con precios de referencia
- Conversión de unidades (LB/GR → KG)
- Instrucciones de preparación (sin hueso, tasajeado, etc.) y distribución en bolsas
- Recolección de datos: nombre, cédula, teléfono, dirección, barrio, ciudad, fecha de entrega
- Resumen y confirmación antes de “cerrar” el pedido
- Formato JSON interno pensado para una comanda virtual

---

## Error crítico de la v3: loop de mensajes infinitos

### Síntoma

Si el cliente escribe algo tan simple como **"hola"**, el bot puede **empezar a mandar mensajes sin parar**.

### Por qué pasa

1. **No hay filtro de tipo de webhook.** Green-API puede notificar no solo mensajes entrantes (`incomingMessageReceived`), sino también eventos de mensajes salientes, estados, acks, etc. La v3 procesa **todo** lo que llega al webhook.
2. **Eco del propio bot.** Cuando el bot responde con `sendMessage`, Green-API puede volver a notificar ese mensaje. El workflow lo trata como si fuera del cliente → el agente responde otra vez → nuevo envío → nuevo eco → **loop infinito**.
3. **Sin deduplicación.** No se guarda `idMessage`; reintentos o notificaciones repetidas se procesan otra vez.
4. **Saludos disparan respuestas largas.** El prompt empuja a un flujo comercial completo; un “hola” puede generar respuestas densas que, sumadas al eco, agravan el loop.
5. **Riesgo de JSON en el chat.** Si el agente “confirma” y pega el JSON de comanda al cliente, ese texto también puede realimentar el ciclo.

### Qué sí funciona en v3 (cuando no entra en loop)

- Conversación con memoria por chat
- Identificación de productos del catálogo
- Toma de pedido con preparación/empaque/datos
- Envío de respuesta por Green-API

---

## Cómo importar en n8n

1. En n8n: **Workflows → Import from File**
2. Selecciona `workflows/wappBotPorcicola.json`
3. Configura credenciales de **OpenAI**
4. Sustituye la URL de Green-API:
   ```
   https://{{GREENAPI_ID_INSTANCE}}.api.greenapi.com/waInstance{{GREENAPI_ID_INSTANCE}}/sendMessage/{{GREENAPI_API_TOKEN}}
   ```
5. Copia la URL de producción del **Webhook** y pégala en Green-API (Webhook URL)
6. Activa el workflow

> **Importante:** no dejes activos dos workflows apuntando al mismo webhook de Green-API; eso también multiplica respuestas.

---

## Seguridad

Los tokens reales de Green-API **no** van en este repositorio. Usa placeholders o variables de entorno / credenciales de n8n.

---

## Estado del proyecto

| Versión | Archivo | Estado |
|---------|---------|--------|
| **v3** (este commit) | `workflows/wappBotPorcicola.json` | Funcional como bot de ventas, **con bug de loop infinito** |
| **v4** (siguiente commit) | — | Corrige el loop con filtro de mensajes, anti-duplicado y salida segura |

---

## Requisitos

- n8n (con nodos LangChain / AI Agent)
- Cuenta OpenAI
- Instancia Green-API (WhatsApp)
