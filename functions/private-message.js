const { google } = require('googleapis');

// Helper: find row by name (ignores case)
async function getRowByName(sheets, spreadsheetId, sheetName, name) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: sheetName,
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) return null;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toLowerCase() === name.toLowerCase()) {
      return rows[i];
    }
  }
  return null;
}

exports.handler = async function(context, event, callback) {
  const twiml = new Twilio.twiml.MessagingResponse();
  const incomingMsg = event.Body || '';

  // Split command and name (e.g., "/casa john")
  const parts = incomingMsg.trim().split(/\s+/);
  if (parts.length < 2) {
    twiml.message('Escribiste mal, boludito. Usa "/casa [nombre]" o "/cbu [nombre]".');
    return callback(null, twiml);
  }

  try {
    // Reconstruct the private key from parts
    const privateKey = [
      context.GOOGLE_PRIVATE_KEY_1,
      context.GOOGLE_PRIVATE_KEY_2,
      context.GOOGLE_PRIVATE_KEY_3,
      context.GOOGLE_PRIVATE_KEY_4,
      context.GOOGLE_PRIVATE_KEY_5,
      context.GOOGLE_PRIVATE_KEY_6,
      context.GOOGLE_PRIVATE_KEY_7,
      context.GOOGLE_PRIVATE_KEY_8,
      context.GOOGLE_PRIVATE_KEY_9,
      context.GOOGLE_PRIVATE_KEY_10,
      context.GOOGLE_PRIVATE_KEY_11,
      context.GOOGLE_PRIVATE_KEY_12,
      context.GOOGLE_PRIVATE_KEY_13
    ].join('');

    // Create credentials object
    const credentials = {
      type: "service_account",
      project_id: "dotted-clover-385118",
      private_key_id: context.GOOGLE_PRIVATE_KEY_ID,
      private_key: privateKey.replace(/\\n/g, '\n'),
      client_email: context.GOOGLE_CLIENT_EMAIL,
      client_id: context.GOOGLE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: context.GOOGLE_CLIENT_X509_CERT_URL,
      universe_domain: "googleapis.com"
    };

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const command = parts[0].toLowerCase();
    const name = parts.slice(1).join(' ');

    const row = await getRowByName(
      sheets, 
      context.SPREADSHEET_ID,
      context.SHEET_NAME,
      name
    );

    if (!row) {
      twiml.message('Ese nombre no existe en la lista, capo.');
    } else if (command === '/casa') {
      twiml.message(`${row[1]}`);
    } else if (command === '/cbu') {
      twiml.message(`${row[2]}`);
    } else {
      twiml.message('A ver si aprendes a escribir');
    }
  } catch (err) {
    // Log detailed error information
    console.error('Error detalles:', {
      message: err.message,
      stack: err.stack,
      context: {
        hasSpreadsheetId: !!context.SPREADSHEET_ID,
        hasSheetName: !!context.SHEET_NAME,
        hasPrivateKeyParts: {
          part1: !!context.GOOGLE_PRIVATE_KEY_1,
          part2: !!context.GOOGLE_PRIVATE_KEY_2,
          part3: !!context.GOOGLE_PRIVATE_KEY_3
        }
      }
    });
    twiml.message('Error procesando, gian no sabe programar.' + (err.message || 'Error desconocido xd'));
  }

  callback(null, twiml);
};
