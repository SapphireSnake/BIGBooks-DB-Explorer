export class DatabaseManager {
    constructor() {
        this.db = null;
        this.SQL = null;
    }

    async init() {
        console.log("DatabaseManager: Starting init sequence...");
        try {
            if (typeof window.initSqlJs !== 'function') {
                throw new Error("window.initSqlJs is not defined.");
            }

            const config = {
                locateFile: filename => `./js/sql-wasm.wasm`
            };

            this.SQL = await window.initSqlJs(config);
            console.log("DatabaseManager: SQL.js initialized.");

            const response = await fetch(`./project.sqlite?v=${Date.now()}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch project.sqlite: ${response.status} ${response.statusText}`);
            }

            const buf = await response.arrayBuffer();
            console.log(`DatabaseManager: Database fetched (${buf.byteLength} bytes).`);

            try {
                this.db = new this.SQL.Database(new Uint8Array(buf));
                console.log("DatabaseManager: Database opened.");
            } catch (dbErr) {
                console.error("DatabaseManager: Failed to open SQL database object:", dbErr);
                throw dbErr;
            }

            return true;

        } catch (err) {
            console.error("DatabaseManager Critical Error:", err);
            throw err;
        }
    }

    async loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const u8 = new Uint8Array(reader.result);
                    this.db = new this.SQL.Database(u8);
                    resolve(true);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    exec(sql) {
        if (!this.db) throw new Error("Database not loaded");
        return this.db.exec(sql);
    }

    getTables() {
        if (!this.db) return [];
        const res = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        if (res.length > 0) {
            return res[0].values.flat();
        }
        return [];
    }

    getSchema() {
        if (!this.db) return {};
        const tables = this.getTables();
        const schema = {};

        for (const table of tables) {
            // Get Columns
            const cols = this.db.exec(`PRAGMA table_info("${table}")`);
            const columns = cols.length > 0 ? cols[0].values.map(col => ({
                name: col[1],
                type: col[2],
                pk: col[5] // Capture Primary Key status
            })) : [];

            // Get Foreign Keys
            const fks = this.db.exec(`PRAGMA foreign_key_list("${table}")`);
            const foreignKeys = fks.length > 0 ? fks[0].values.map(fk => ({
                table: fk[2], // Target Table
                from: fk[3],  // Source Column
                to: fk[4]     // Target Column
            })) : [];

            schema[table] = {
                columns: columns,
                foreignKeys: foreignKeys
            };
        }
        return schema;
    }
}
