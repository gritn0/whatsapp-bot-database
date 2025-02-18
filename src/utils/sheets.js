const { google } = require('googleapis');

class GoogleSheetsUtil {
    constructor(credentials, spreadsheetId, sheetName) {
        this.spreadsheetId = spreadsheetId;
        this.sheetName = sheetName;
        this.auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    }

    async getRowByName(name) {
        try {
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: this.sheetName,
            });
            const rows = res.data.values;
            if (!rows || rows.length < 2) return null;

            for (let i = 1; i < rows.length; i++) {
                if (rows[i][0].toLowerCase() === name.toLowerCase()) {
                    return rows[i];
                }
            }
            return null;
        } catch (error) {
            console.error('Error fetching data from Google Sheets:', error);
            throw error;
        }
    }
}

module.exports = GoogleSheetsUtil;