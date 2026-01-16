import Alpine from './alpine.js';
import { DatabaseManager } from './database.js';
import { LocalAI } from './ai.js';

console.log("App.js: Module loaded!");

const createDbApp = () => ({
    dbManager: new DatabaseManager(),
    ai: new LocalAI(),

    dbLoaded: false,
    tables: [],
    sqlQuery: 'SELECT * FROM Author LIMIT 5;',
    nlQuery: '',
    results: [],
    columns: [],
    error: null,
    loading: false,
    lastExecutionTime: null,

    // Database Management
    availableDbs: [
        { id: 'default', name: 'BigBooks (Default)' }
    ],
    selectedDbId: 'default',
    uploadedFiles: {}, // Cache for uploaded file buffers

    // UI State
    currentTab: 'data',
    mermaidHtml: '',

    async init() {
        try {
            console.log("App: Initializing...");
            await this.dbManager.init();
            this.dbLoaded = true;
            this.refreshApp();
            console.log("App: Initialized successfully.");
        } catch (err) {
            console.error("App Init Error:", err);
            this.error = err.message;
        }
    },

    async switchDatabase() {
        console.log("App: Switching database to", this.selectedDbId);
        this.loading = true;
        try {
            if (this.selectedDbId === 'default') {
                await this.dbManager.init(); // Re-fetch default
            } else {
                const file = this.uploadedFiles[this.selectedDbId];
                if (file) {
                    await this.dbManager.loadFromFile(file);
                } else {
                    throw new Error("File not found in cache");
                }
            }
            this.refreshApp();
        } catch (err) {
            this.error = "Failed to switch database.";
            console.error(err);
        } finally {
            this.loading = false;
        }
    },

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.loading = true;
        this.error = null;

        try {
            // Store file in cache
            const newId = `db_${Date.now()}`;
            this.uploadedFiles[newId] = file;

            // Add to dropdown
            this.availableDbs.push({
                id: newId,
                name: file.name
            });

            // Select and load it
            this.selectedDbId = newId;
            await this.dbManager.loadFromFile(file);

            this.refreshApp();
        } catch (err) {
            console.error(err);
            this.error = "Failed to open database file.";
        } finally {
            this.loading = false;
            // Reset input
            event.target.value = '';
        }
    },

    refreshApp() {
        // Refresh Tables
        this.tables = this.dbManager.getTables();

        // Refresh AI Schema
        const schema = this.dbManager.getSchema();
        this.ai.setSchema(schema);

        // Generate Diagram
        this.generateMermaid(schema);

        // Reset Query
        this.sqlQuery = '';
        this.results = [];
        this.columns = [];

        // Try to select the first table found
        if (this.tables.length > 0) {
            this.quickSelect(this.tables[0]);
        }
    },

    async generateMermaid(schema) {
        let def = "erDiagram\n";

        // Add Tables and Columns
        for (const [tableName, data] of Object.entries(schema)) {
            def += `    "${tableName}" {\n`;
            data.columns.forEach(col => {
                const type = col.type || 'TEXT';
                const key = col.pk ? 'PK' : '';
                def += `        ${type} ${col.name} ${key}\n`;
            });
            def += `    }\n`;
        }

        // Add Relationships
        for (const [tableName, data] of Object.entries(schema)) {
            data.foreignKeys.forEach(fk => {
                // "Table" }|..|| "Target" : "fk"
                def += `    "${tableName}" }|..|| "${fk.table}" : "${fk.from}"\n`;
            });
        }

        try {
            const { svg } = await mermaid.render('graphDiv', def);
            this.mermaidHtml = svg;
        } catch (e) {
            console.error("Mermaid Render Error:", e);
            this.mermaidHtml = '<div class="text-red-400 p-4">Failed to render schema diagram.</div>';
        }
    },

    quickSelect(table) {
        // Try to find a primary key or just use the first column
        const schema = this.dbManager.getSchema();
        const firstCol = schema[table]?.columns[0]?.name || 'rowid';

        this.sqlQuery = `SELECT * FROM "${table}"\nORDER BY ${firstCol} DESC\nLIMIT 50;`;
        this.runQuery();
        this.currentTab = 'data'; // Switch back to data view
    },

    processNLQuery() {
        if (!this.nlQuery.trim()) return;

        try {
            const generatedSql = this.ai.translate(this.nlQuery);
            this.sqlQuery = generatedSql;
            this.runQuery();
        } catch (err) {
            this.error = "AI could not understand the query.";
        }
    },

    runQuery() {
        this.error = null;
        this.loading = true;
        const start = performance.now();

        try {
            const res = this.dbManager.exec(this.sqlQuery);
            const end = performance.now();
            this.lastExecutionTime = (end - start).toFixed(2);

            if (res.length > 0) {
                this.columns = res[0].columns;
                this.results = res[0].values;
            } else {
                this.columns = [];
                this.results = [];
            }
        } catch (err) {
            this.error = err.message;
            this.results = [];
        } finally {
            this.loading = false;
        }
    }
});

Alpine.data('dbApp', createDbApp);
Alpine.start();
