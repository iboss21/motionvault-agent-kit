#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMotionVaultServer,startHttpServer } from './server.mjs';
import { loadCatalog } from './tools.mjs';

async function main(){
 const args=process.argv.slice(2);
 if(args.includes('--help')){process.stdout.write('motionvault-agent-kit [--stdio | --http] [--port 5190]\nEnvironment: MOTIONVAULT_BASE_URL, MOTIONVAULT_CATALOG_PATH, MOTIONVAULT_MCP_ALLOWED_ORIGINS\nPersonal stdio reads: MOTIONVAULT_API_KEY (scoped read key; never commit it). Public HTTP forwards only each caller’s Bearer key.\n');return}
 const allowed=new Set(['--stdio','--http','--port']);
 for(let index=0;index<args.length;index++){if(!allowed.has(args[index]))throw new Error(`Unknown option: ${args[index]}`);if(args[index]==='--port'){if(!/^\d+$/.test(args[index+1]||''))throw new Error('--port requires an integer.');index++;}}
 if(args.includes('--stdio')&&args.includes('--http'))throw new Error('Choose --stdio or --http.');
 const catalog=await loadCatalog(process.env.MOTIONVAULT_CATALOG_PATH||undefined),baseUrl=process.env.MOTIONVAULT_BASE_URL||'http://localhost:5188';
 if(args.includes('--http')){
  const index=args.indexOf('--port'),port=index>=0?Number(args[index+1]):5190;
  const host=process.env.MOTIONVAULT_MCP_BIND_HOST||'127.0.0.1';
  const app=await startHttpServer({catalog,baseUrl,port,host,allowedHosts:(process.env.MOTIONVAULT_MCP_ALLOWED_HOSTS||'').split(',').map(s=>s.trim()).filter(Boolean),allowedOrigins:(process.env.MOTIONVAULT_MCP_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean)});
  process.stderr.write(`MotionVault MCP: ${app.url} (bind ${host})\n`);
  const stop=async()=>{await app.close();process.exit(0)};process.once('SIGINT',stop);process.once('SIGTERM',stop);
 }else{
  const server=createMotionVaultServer(catalog,{baseUrl});await server.connect(new StdioServerTransport());
  const stop=async()=>{await server.close();process.exit(0)};process.once('SIGINT',stop);process.once('SIGTERM',stop);
 }
}
main().catch(error=>{process.stderr.write(`MotionVault MCP: ${error instanceof Error?error.message:'startup failed'}\n`);process.exitCode=1});
