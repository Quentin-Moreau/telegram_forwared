const env = require('dotenv').config();
const { Pool } = require('pg');

class Storage {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
    }

    async setItem(key, value) {
        const client = await this.pool.connect();
        return client.query(`SELECT * FROM config_store`)
        .catch(err => {
            console.log('Creating the config_store database');
            return client.query(`CREATE TABLE config_store (
                key varchar,
                value varchar
            )`);
        })
        .finally(_ => client.query(`INSERT INTO config_store (key, value) VALUES ('${key}', '${value}')`))
        .finally(_ => client.release());
    }

    async getItem(key) {
        const client = await this.pool.connect();
        return client.query(`SELECT * FROM config_store WHERE key='${key}' LIMIT 1`)
        .then(res => res.rowCount === 1 ? res.rows[0].value : null)
        .catch(_ => null)
        .finally(_ => client.release());
    }
}

const storage = new Storage();

module.exports = {
    storage
};