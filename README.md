# TiDB MCP Server

A Model Context Protocol server for TiDB that provides SQL query capabilities.

## Features
- Execute SQL queries against TiDB
- Read-only operations for safety
- Easy integration with MCP ecosystem

## Installation
```bash
npm install -g tidb-mcp-server
```

## Configuration
Create a `config.json` file with your TiDB connection details:

```json
{
  "host": "your-tidb-host",
  "port": 4000,
  "user": "your-username",
  "password": "your-password",
  "database": "your-database"
}
```

## Usage
1. Start the server:
```bash
tidb-server
```

2. Use with MCP tools:
```bash
mcp query --server tidb --sql "SELECT * FROM users LIMIT 10"
```

## Example Queries
```sql
-- Get table schema
SELECT * FROM information_schema.tables WHERE table_schema = 'your-database';

-- Simple query
SELECT id, name FROM users WHERE status = 'active';
```

## License
MIT
