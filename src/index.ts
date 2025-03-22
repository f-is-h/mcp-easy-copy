#!/usr/bin/env node

/**
 * MCP Easy Copy Server
 * 
 * This MCP server lists all configured MCP services in the Claude Desktop application.
 * It makes it easy for users to copy service names for use in their prompts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Create an MCP server that will appear at the top of the tools list
const server = new McpServer({
  name: "mcp-easy-copy", // Use hyphens consistently for npm naming convention
  version: "1.0.0"
});

// Configure logging to stderr (doesn't interfere with the MCP protocol)
const logDebug = (message: string) => {
  // Uncomment for debugging
  // console.error(`[DEBUG] ${message}`);
};

/**
 * Configuration file paths for different operating systems
 * - macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
 * - Linux: ~/.config/Claude/claude_desktop_config.json
 * - Windows: %APPDATA%/Claude/claude_desktop_config.json
 */
const possibleConfigPaths = [
  path.join(os.homedir(), "Library/Application Support/Claude/claude_desktop_config.json"),
  path.join(os.homedir(), ".config/Claude/claude_desktop_config.json"),
  path.join(os.homedir(), "AppData/Roaming/Claude/claude_desktop_config.json")
];

/**
 * Finds the Claude Desktop configuration file
 * @returns The path to the config file if found, null otherwise
 */
async function findConfigFile(): Promise<string | null> {
  for (const configPath of possibleConfigPaths) {
    try {
      await fs.access(configPath);
      logDebug(`Found config file at: ${configPath}`);
      return configPath;
    } catch (error) {
      logDebug(`Config file not found at: ${configPath}`);
    }
  }
  return null;
}

/**
 * Retrieves all MCP service names from the Claude Desktop configuration file
 * @returns Array of MCP service names
 */
async function getMcpServices(): Promise<string[]> {
  try {
    // Find the config file
    const configPath = await findConfigFile();
    if (!configPath) {
      return [];
    }
    
    // Read and parse the config file
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    // Extract and return MCP service names
    return config.mcpServers ? Object.keys(config.mcpServers) : [];
  } catch (error) {
    logDebug(`Error getting MCP services: ${error}`);
    return [];
  }
}

/**
 * Resource that returns the list of configured MCP services
 * This resource is exposed through URI: mcp-services://list
 */
server.resource(
  "mcp-services-list",
  "mcp-services://list",
  async (uri) => {
    try {
      // Find the config file
      const configPath = await findConfigFile();
      if (!configPath) {
        return {
          contents: [{
            uri: uri.href,
            text: "Error: Claude Desktop configuration file not found."
          }]
        };
      }
      
      // Read and parse the config file
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      // Extract MCP service names
      const services = config.mcpServers ? Object.keys(config.mcpServers) : [];
      
      // Format the output in a user-friendly way
      const formattedList = services.length > 0 
        ? "📋 AVAILABLE MCP SERVICES:\n" + services.map((name) => `- ${name}`).join("\n") + "\n\nCopy a service name to use in prompts like:\n" +
          "• Can you use [service name] to...\n" +
          "• Please call [service name] to..."
        : "No MCP services configured.";
      
      return {
        contents: [{
          uri: uri.href,
          text: formattedList
        }]
      };
    } catch (error) {
      console.error("Error reading MCP config:", error);
      return {
        contents: [{
          uri: uri.href,
          text: `Error reading MCP configuration: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

/**
 * Initializes and starts the MCP server
 */
async function main() {
  try {
    // Get initial MCP services to include in the tool description
    let toolDescription = "List all MCP services available in this Claude instance";
    const services = await getMcpServices();
    
    if (services.length > 0) {
      // Format service names with separators for better visibility in the UI
      // (newlines don't work well in Claude's tool descriptions)
      const servicesList = services.map(name => `${name}`).join(" │ ");
      toolDescription = `│ ${servicesList} │`;
    }
    
    // Register the tool with underscores to appear at the top of tool listings
    server.tool(
      "_________available_mcp_services_for_easy_copy_________",
      toolDescription,
      {}, // No parameters needed
      async () => {
        // Always fetch the latest services when the tool is called
        const currentServices = await getMcpServices();
        
        if (currentServices.length === 0) {
          return {
            content: [{ 
              type: "text", 
              text: "No MCP services configured." 
            }]
          };
        }
        
        // Format the output with numbered list and usage instructions
        const formattedList = "📋 AVAILABLE MCP SERVICES:\n" + 
          currentServices.map((name, index) => `${index + 1}. ${name}`).join("\n") + 
          "\n\nCopy a service name to use in prompts like:\n" +
          "• Can you use [service name] to...\n" +
          "• Please call [service name] to...";
        
        return {
          content: [{ 
            type: "text", 
            text: formattedList 
          }]
        };
      }
    );
    
    // Connect the server using stdio transport (standard for MCP)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Easy Copy server running...");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
main();