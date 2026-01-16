export class LocalAI {
    constructor() {
        this.schema = {};
    }

    setSchema(schema) {
        this.schema = schema;
    }

    translate(nlQuery) {
        const q = nlQuery.toLowerCase().trim();
        const tables = Object.keys(this.schema);

        // Fuzzy match table name
        const findTable = (word) => {
            if (!word) return null;
            // Direct match
            let match = tables.find(t => t.toLowerCase() === word);
            if (match) return match;
            // Basic singularization
            if (word.endsWith('s')) {
                const singular = word.slice(0, -1);
                match = tables.find(t => t.toLowerCase() === singular);
                if (match) return match;
            }
            return null;
        };

        // 0. Help command
        if (q === 'help' || q.includes('what can you do')) {
            return `SELECT 'Try asking: "Show all books", "Count authors", "Newest orders", or "Find Rowling in Author"' as "Help";`;
        }

        // 1. Identify Tables
        const words = q.split(/\s+/);
        let primaryTable = null;

        for (const word of words) {
            const t = findTable(word);
            if (t) {
                primaryTable = t;
                break;
            }
        }

        // Helper: Parse Limit
        const parseLimit = (str) => {
            if (str.includes("no limit") || str.includes("unlimited")) return "";
            const match = str.match(/limit\s+(\d+)/);
            if (match) return ` LIMIT ${match[1]}`;
            return " LIMIT 20"; // Default
        };

        // Helper: Parse Sort
        const parseSort = (str, table) => {
            let sortCol = null;
            let direction = "ASC";

            // Check direction
            if (str.includes("desc") || str.includes("descending") || str.includes("reverse")) direction = "DESC";

            // Check specific column sort
            const sortMatch = str.match(/sort by\s+(\w+)/);
            if (sortMatch) {
                const colName = this.findColumnByName(table, [sortMatch[1]]);
                if (colName) sortCol = colName;
            }

            // Check "alphabetic"
            if (!sortCol && (str.includes("alphabetic") || str.includes("alphabetical") || str.includes("a-z"))) {
                sortCol = this.findColumnByType(table, ['TEXT', 'VARCHAR'], ['title', 'name', 'lastname']);
                // Only default to ASC if not already DESC
                if (!str.includes("desc") && !str.includes("descending") && !str.includes("reverse")) {
                    direction = "ASC";
                }
            }
            if (!sortCol && str.includes("z-a")) {
                sortCol = this.findColumnByType(table, ['TEXT', 'VARCHAR'], ['title', 'name', 'lastname']);
                direction = "DESC";
            }

            return sortCol ? ` ORDER BY ${sortCol} ${direction}` : "";
        };

        // --- High Priority: Specific Filters ---

        // 2. Numeric Filtering
        const numberMatch = q.match(/(under|less than|below|over|more than|above|cheaper than)\s+(\d+)/);
        if (numberMatch && primaryTable) {
            const operator = ['under', 'less than', 'below', 'cheaper than'].includes(numberMatch[1]) ? '<' : '>';
            const value = numberMatch[2];

            // Find a numeric column
            const numCol = this.findColumnByType(primaryTable, ['INTEGER', 'REAL', 'NUMERIC', 'FLOAT'], ['price', 'cost', 'amount', 'quantity', 'total']);

            if (numCol) {
                const limitClause = parseLimit(q);
                const sortClause = parseSort(q, primaryTable); // Allow sorting filtered results
                // Default sort if none specified
                const finalSort = sortClause || ` ORDER BY ${numCol} ${operator === '>' ? 'DESC' : 'ASC'}`;
                return `SELECT * FROM "${primaryTable}" WHERE ${numCol} ${operator} ${value}${finalSort}${limitClause};`;
            }
        }

        // 3. "Find" pattern
        if (q.includes("find")) {
            let targetTable = primaryTable;
            let cleanTerm = q;

            // Infer table if missing
            if (!targetTable) {
                cleanTerm = cleanTerm.replace(/find/gi, '').trim();

                // Simple inference heuristic
                if (this.schema['Book']) targetTable = 'Book';
                else if (this.schema['Author']) targetTable = 'Author';
                else targetTable = tables[0];
            } else {
                // Remove keywords
                const keywords = ['find', 'in', targetTable.toLowerCase()];
                keywords.forEach(k => {
                    const regex = new RegExp(`\\b${k}\\b`, 'gi');
                    cleanTerm = cleanTerm.replace(regex, '');
                });
                cleanTerm = cleanTerm.trim();
            }

            if (targetTable) {
                // Prioritize readable text columns
                const textCol = this.findColumnByType(
                    targetTable,
                    ['TEXT', 'VARCHAR'],
                    ['title', 'name', 'firstname', 'lastname', 'description', 'bio']
                );

                if (textCol && cleanTerm.length > 0) {
                    const limitClause = parseLimit(q);
                    const sortClause = parseSort(q, targetTable);
                    return `SELECT * FROM "${targetTable}" WHERE ${textCol} LIKE '%${cleanTerm}%'${sortClause}${limitClause};`;
                }
            }
        }

        // --- Explicit Commands ---

        // 4. Show/List intent
        if (q.startsWith("show") || q.startsWith("list") || q.startsWith("get") || q.startsWith("select")) {
            if (primaryTable) {
                const limitClause = parseLimit(q);
                const sortClause = parseSort(q, primaryTable);
                return `SELECT * FROM "${primaryTable}"${sortClause}${limitClause};`;
            }
        }

        // 5. Specific Intents
        if (q.includes("count") || q.includes("how many")) {
            if (primaryTable) {
                return `SELECT COUNT(*) as Total FROM "${primaryTable}";`;
            } else {
                return `SELECT count(*) as TotalTables FROM sqlite_master WHERE type='table';`;
            }
        }

        if (q.includes("oldest") || q.includes("first")) {
            if (primaryTable) {
                const dateCol = this.findColumnByType(primaryTable, ['DATE', 'DATETIME', 'INTEGER'], ['year', 'date', 'time', 'created']);
                if (dateCol) {
                    return `SELECT * FROM "${primaryTable}" ORDER BY ${dateCol} ASC LIMIT 1;`;
                }
            }
        }

        if (q.includes("newest") || q.includes("latest") || q.includes("recent")) {
            if (primaryTable) {
                const dateCol = this.findColumnByType(primaryTable, ['DATE', 'DATETIME', 'INTEGER'], ['year', 'date', 'time', 'created']);
                if (dateCol) {
                    return `SELECT * FROM "${primaryTable}" ORDER BY ${dateCol} DESC LIMIT 5;`;
                }
            }
        }

        if (q.includes("expensive") || q.includes("cost") || q.includes("price")) {
            const targetTables = primaryTable ? [primaryTable] : tables;
            for (const t of targetTables) {
                const priceCol = this.findColumnByName(t, ['price', 'cost', 'amount']);
                if (priceCol) {
                    const limitClause = parseLimit(q);
                    return `SELECT * FROM "${t}" ORDER BY ${priceCol} DESC${limitClause};`;
                }
            }
        }

        // 6. Fallback
        if (primaryTable) {
            const limitClause = parseLimit(q);
            const sortClause = parseSort(q, primaryTable);
            return `SELECT * FROM "${primaryTable}"${sortClause}${limitClause};`;
        }

        // 7. Global Fallback
        return `SELECT name as TableName FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`;
    }

    findColumnByType(table, types, prioritizeNames = []) {
        const tableData = this.schema[table];
        if (!tableData || !tableData.columns) return null;
        const cols = tableData.columns;

        // 1. Try to find a column that matches BOTH type AND priority name
        if (prioritizeNames.length > 0) {
            const priorityMatch = cols.find(c =>
                types.some(t => c.type && c.type.toUpperCase().includes(t)) &&
                prioritizeNames.some(p => c.name.toLowerCase().includes(p))
            );
            if (priorityMatch) return priorityMatch.name;
        }

        // 2. Fallback: Find any matching type, BUT prefer NOT to pick IDs/Codes if possible
        const candidates = cols.filter(c => types.some(t => c.type && c.type.toUpperCase().includes(t)));

        if (candidates.length > 0) {
            // Try to find one that DOESN'T look like an ID
            const nonIdMatch = candidates.find(c =>
                !c.name.toLowerCase().includes('id') &&
                !c.name.toLowerCase().includes('isbn') &&
                !c.name.toLowerCase().includes('code')
            );
            return nonIdMatch ? nonIdMatch.name : candidates[0].name;
        }

        return null;
    }

    findColumnByName(table, keywords) {
        const tableData = this.schema[table];
        if (!tableData || !tableData.columns) return null;
        const cols = tableData.columns;

        const match = cols.find(c => keywords.some(k => c.name.toLowerCase().includes(k)));
        return match ? match.name : null;
    }
}
