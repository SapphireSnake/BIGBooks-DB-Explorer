# BigBooks Explorer

**BigBooks Explorer** is a lightweight, client-side database visualization tool designed to showcase the power of in-browser SQL processing and natural language querying. It allows users to explore SQLite databases, visualize schemas, and run queries using plain English.

![BigBooks Explorer](https://via.placeholder.com/800x450?text=BigBooks+Explorer+Screenshot)

## Features

*   **📂 Drag-and-Drop Database Loading**: Load any standard SQLite file (`.sqlite`, `.db`) directly in the browser.
*   **🤖 AI-Powered Querying**: Type natural language queries like "Find Rowling in Author" or "Books under 20" and watch them convert to SQL instantly.
*   **📊 Visual Schema**: Automatically generates an Entity-Relationship Diagram (ERD) using Mermaid.js to visualize table connections.
*   **⚡ Zero-Latency**: Powered by `sql.js` (WebAssembly), all queries run locally in your browser with no backend latency.
*   **🛡️ Privacy First**: Your database files never leave your device.

## Architecture

This project follows a **Static Web Application** architecture:

*   **Frontend**: HTML5, Tailwind CSS (Styling), Alpine.js (Reactivity).
*   **Database Engine**: `sql.js` (WASM port of SQLite) running in a Web Worker.
*   **Visualization**: `mermaid.js` for dynamic schema rendering.
*   **Logic**: Modular ES6 JavaScript (`js/app.js`, `js/database.js`, `js/ai.js`).

## Quick Start

Since this project uses WebAssembly and `fetch()`, it requires a local web server to bypass CORS restrictions.

1.  **Run the demo script**:
    ```bash
    ./start_demo.sh
    ```
    This will start a simple Python HTTP server and open the application in your default browser.

2.  **Explore the Data**:
    *   Click on tables in the sidebar to view data.
    *   Switch to the "Visual Schema" tab to see relationships.
    *   Type queries like "Show all authors" or "Count books" in the AI input.

## Project Structure

```
BigBooks_Demo/
├── index.html          # Main application entry point
├── project.sqlite      # Default demo database
├── start_demo.sh       # Local server launcher
├── js/
│   ├── app.js          # Core UI logic (Alpine.js)
│   ├── database.js     # Database manager (sql.js wrapper)
│   ├── ai.js           # Natural Language to SQL engine
│   ├── alpine.js       # Alpine.js framework
│   ├── sql-wasm.js     # SQL.js loader
│   └── sql-wasm.wasm   # SQL.js WebAssembly binary
└── README.md           # This file
```

## AI Capabilities

The "Simulated AI" understands:
*   **Fuzzy Search**: "Find Harry Potter" (infers table and column).
*   **Numeric Filtering**: "Books under 20", "Quantity over 50".
*   **Sorting**: "Sort by price desc", "Alphabetic".
*   **Aggregations**: "Count authors", "Oldest book".
