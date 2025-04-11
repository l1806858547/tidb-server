#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import mysql from 'mysql2/promise';

class TiDBServer {
  private server: Server;
  private pool: mysql.Pool;

  constructor() {
    this.server = new Server(
      {
        name: 'tidb-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // 从环境变量获取TiDB连接配置
    if (!process.env.TIDB_HOST || !process.env.TIDB_PORT || !process.env.TIDB_USER || 
        !process.env.TIDB_PASS || !process.env.TIDB_DB) {
      throw new Error('Missing required TiDB connection environment variables');
    }

    // 设置操作权限默认值
    process.env.ALLOW_INSERT_OPERATION = process.env.ALLOW_INSERT_OPERATION || 'false';
    process.env.ALLOW_UPDATE_OPERATION = process.env.ALLOW_UPDATE_OPERATION || 'false';
    process.env.ALLOW_DELETE_OPERATION = process.env.ALLOW_DELETE_OPERATION || 'false';

    const config = {
      host: process.env.TIDB_HOST,
      port: parseInt(process.env.TIDB_PORT),
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASS,
      database: process.env.TIDB_DB,
      connectionLimit: 5,
      // TiDB特定配置
      timezone: '+08:00',
      supportBigNumbers: true,
      bigNumberStrings: true
    };

    this.pool = mysql.createPool(config);

    this.setupToolHandlers();
    this.setupResourceHandlers();
    
    this.server.onerror = (error) => console.error('[TiDB MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.pool.end();
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'tidb_query',
          description: 'Execute SQL queries against TiDB',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'The SQL query to execute'
              }
            },
            required: ['sql']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'tidb_query') {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      }

      if (!request.params.arguments || typeof request.params.arguments.sql !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'SQL query is required and must be a string');
      }

      try {
        const sql = request.params.arguments.sql.trim().toLowerCase();
        const sqlType = sql.split(' ')[0];
        
        // 检查操作权限
        if (sqlType === 'insert' && process.env.ALLOW_INSERT_OPERATION !== 'true') {
          throw new McpError(ErrorCode.InvalidRequest, 'INSERT operations are not allowed');
        }
        if (sqlType === 'update' && process.env.ALLOW_UPDATE_OPERATION !== 'true') {
          throw new McpError(ErrorCode.InvalidRequest, 'UPDATE operations are not allowed');
        }
        if (sqlType === 'delete' && process.env.ALLOW_DELETE_OPERATION !== 'true') {
          throw new McpError(ErrorCode.InvalidRequest, 'DELETE operations are not allowed');
        }
        
        const [rows] = await this.pool.query(sql);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(rows, null, 2)
          }]
        };
      } catch (error) {
        if (error instanceof Error) {
          return {
            content: [{
              type: 'text',
              text: `TiDB query error: ${error.message}`
            }],
            isError: true
          };
        }
        throw error;
      }
    });
  }

  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: []
    }));

    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: []
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async () => ({
      contents: []
    }));
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('TiDB MCP server running on stdio');
  }
}

const server = new TiDBServer();
server.run().catch(console.error);
