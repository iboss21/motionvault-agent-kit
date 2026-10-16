import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createToolset,catalogSchema} from '../src/tools.mjs';
import {createMotionVaultServer,startHttpServer} from '../src/server.mjs';
const catalog=catalogSchema.parse({templates:[{id:'premium-original',title:'Premium original',category:'Websites',engine:'CSS',free:false,prompt:'PRIVATE_BUNDLED_PROMPT_MUST_NEVER_ESCAPE'},{id:'free-original',title:'Free original',category:'Websites',engine:'CSS',free:true,prompt:'A public free prompt.'}]});
const key='mv_read_'+'a'.repeat(43);
test('premium prompt retrieval ignores bundled secrets and forwards only a personal read key',async()=>{
 const calls=[],fetchImpl=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({templateId:'premium-original',prompt:'AUTHORISED_SERVER_PROMPT'}),{headers:{'content-type':'application/json'}});};
 const tools=createToolset(catalog,{baseUrl:'https://motionvault.test',apiKey:key,fetchImpl}),prompt=tools.find(t=>t.name==='get_build_prompt');
 const result=await prompt.run({id:'premium-original'});assert.match(result.prompt,/AUTHORISED_SERVER_PROMPT/);assert(!result.prompt.includes('PRIVATE_BUNDLED_PROMPT'));assert.equal(calls[0].options.headers.Authorization,'Bearer '+key);assert.equal(calls[0].url,'https://motionvault.test/api/agent/templates/premium-original/prompt');
 const free=await prompt.run({id:'free-original'});assert.match(free.prompt,/A public free prompt/);assert.equal(calls.length,1);
});
test('MCP catalog resources never leak premium prompts even with a full private input catalog',async(t)=>{
 const server=createMotionVaultServer(catalog),client=new Client({name:'access-test',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();
 await server.connect(b);await client.connect(a);t.after(async()=>{await client.close();await server.close();});
 const resource=await client.readResource({uri:'motionvault://catalog'});assert(!resource.contents[0].text.includes('PRIVATE_BUNDLED_PROMPT'));assert(resource.contents[0].text.includes('A public free prompt.'));
});
test('shared HTTP MCP never lends its environment key and forwards each caller key only',async(t)=>{
 const old=process.env.MOTIONVAULT_API_KEY;process.env.MOTIONVAULT_API_KEY='mv_read_'+'z'.repeat(43);t.after(()=>{if(old===undefined)delete process.env.MOTIONVAULT_API_KEY;else process.env.MOTIONVAULT_API_KEY=old;});
 const seen=[],app=await startHttpServer({catalog,port:0,baseUrl:'https://motionvault.test',fetchImpl:async(url,options)=>{seen.push(options.headers.Authorization);return options.headers.Authorization===`Bearer ${key}`?new Response(JSON.stringify({templateId:'premium-original',prompt:'SCOPED_ACCOUNT_PROMPT'}),{headers:{'content-type':'application/json'}}):new Response('{}',{status:401,headers:{'content-type':'application/json'}});}});t.after(()=>app.close());
 const anonymous=new Client({name:'anonymous-read',version:'1'});await anonymous.connect(new StreamableHTTPClientTransport(new URL(app.url)));t.after(()=>anonymous.close());const denied=await anonymous.callTool({name:'get_build_prompt',arguments:{id:'premium-original'}});assert.equal(denied.isError,true);assert.equal(seen[0],undefined);
 const personal=new Client({name:'personal-read',version:'1'});await personal.connect(new StreamableHTTPClientTransport(new URL(app.url),{requestInit:{headers:{Authorization:'Bearer '+key}}}));t.after(()=>personal.close());const allowed=await personal.callTool({name:'get_build_prompt',arguments:{id:'premium-original'}});assert.equal(allowed.structuredContent.id,'premium-original');assert.match(allowed.structuredContent.prompt,/SCOPED_ACCOUNT_PROMPT/);assert.equal(seen[1],'Bearer '+key);assert(!seen.some(value=>value?.includes('z'.repeat(43))));
});
