import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createMotionVaultServer,startHttpServer } from '../src/server.mjs';
import { catalogSchema,createToolset,configuredOrigin,contrastRatio,fetchSource,loadCatalog,timeline } from '../src/tools.mjs';

const fixture=catalogSchema.parse({templates:[
 {id:'noir-film',title:'Noir Film',subtitle:'Original cinematic portrait',category:'Websites',engine:'Cinematic / Video',tags:['Cinematic','Noir'],prompt:'Build an original photographic film.',color:'#d8bd82',cinematic:{kind:'ronin',poster:'/cinematic/ronin.webp',video:'/cinematic/ronin.mp4'}},
 {id:'still-world',title:'Still World',category:'Scroll',engine:'Cinematic / Scroll',tags:['Botanical'],free:true,prompt:'Build original still world.',cinematic:{kind:'eden',poster:'/cinematic/eden.webp'}},
 {id:'ripple-shader',title:'Ripple',category:'Backgrounds',engine:'WebGL / GLSL',tags:['Shader'],free:true,prompt:'Build ripple shader.'},
],designAssets:[{id:'studio-style',title:'Studio Style',library:'styles',description:'Original ivory and black style.',tags:['Editorial'],tokens:{colors:{ink:'#171717',paper:'#f2eee6'},spacing:{unit:'8px'}}},{id:'aurora-bg',title:'Aurora Background',library:'backgrounds',tags:['Aurora'],source:'body{background:#111}',language:'css'}]});
const definitions=createToolset(fixture);
const execute=(name,args={})=>{const tool=definitions.find(t=>t.name===name);return tool.run(tool.inputSchema.parse(args))};
const asText=value=>({status:200,headers:{'content-type':'application/json'},body:JSON.stringify(value)});

test('catalog is independently loadable, bounded and validates original public metadata',async()=>{
 const actual=await loadCatalog();assert.ok(actual.templates.length>=24);assert.ok(actual.templates.find(t=>t.id==='ronin-studio').cinematic.video);
 assert.throws(()=>catalogSchema.parse({templates:[{id:'../secret',title:'bad'}]}));
 assert.equal(configuredOrigin(),'http://localhost:5188');
 for(const bad of ['file:///etc/passwd','https://user:password@example.com','http://example.com','https://example.com/path','https://example.com/?token=secret'])assert.throws(()=>configuredOrigin(bad));
 assert.equal(configuredOrigin('https://motionvault.site'),'https://motionvault.site');
});

test('search combines real filters, bounded pagination and exact media capabilities without source leakage',()=>{
 assert.equal(execute('search_templates',{query:'cinematic noir'}).total,1);
 assert.equal(execute('search_templates',{mediaKind:'photo-with-runtime'}).templates[0].id,'still-world');
 assert.equal(execute('search_templates',{free:true}).total,2);
 assert.equal(execute('search_templates',{limit:1,offset:1}).templates.length,1);
 assert.ok(!('prompt' in execute('search_templates').templates[0]));
 assert.equal(execute('search_templates',{library:'styles',query:'ivory'}).assets[0].id,'studio-style');
 assert.equal(execute('search_templates',{library:'all'}).total,5);
 assert.throws(()=>execute('search_templates',{limit:500}));assert.throws(()=>execute('get_template',{id:'noir-film',cookie:'secret'}));
 assert.throws(()=>execute('get_template',{id:'missing'}),/Unknown template/);
});

test('design assets expose genuine source/tokens and explicit generation provenance',()=>{
 const design=execute('get_design_system',{id:'studio-style'});assert.match(design.designMd,/--colors-ink: #171717/);
 const css=execute('get_asset_source',{id:'studio-style'});assert.equal(css.generatedFromTokens,true);assert.match(css.source,/--spacing-unit: 8px/);
 const original=execute('get_asset_source',{id:'aurora-bg'});assert.equal(original.source,'body{background:#111}');assert.equal(original.generatedFromTokens,false);
});

test('live WebGL studies remain GPU templates and do not advertise unsupported media exports',async()=>{
 const catalog=await loadCatalog(),study=catalog.templates.find(item=>item.procedural);
 assert.ok(study,'Bundled catalog must contain an actual WebGL study');
 const tools=createToolset(catalog),run=(name,args)=>{const tool=tools.find(t=>t.name===name);return tool.run(tool.inputSchema.parse(args))};
 assert.equal(run('get_template',{id:study.id}).mediaKind,'gpu-shader');
 const checklist=run('get_export_checklist',{id:study.id,formats:['source','mp4','png']});
 assert.deepEqual(checklist.checks.map(item=>item.available),[true,false,false]);
 assert.match(checklist.checks[1].steps[0],/standalone source export only/);
});

test('storyboard mechanism and weighted timeline produce exact end times and frame boundaries',()=>{
 const beats=timeline([{name:'a',weight:1},{name:'b',weight:2},{name:'c',weight:1}],12,30);
 assert.deepEqual(beats.map(b=>[b.start,b.end]),[[0,3],[3,9],[9,12]]);assert.equal(beats.at(-1).endFrame,360);
 const story=execute('plan_storyboard',{mechanism:'product-reveal',duration:10,fps:'24'});assert.equal(story.shots.at(-1).endFrame,240);assert.match(story.shots[1].action,/Mask environment/);
 assert.throws(()=>execute('build_motion_timeline',{duration:10,beats:[{name:'a',weight:0}]}));
});

test('easing inversion, contrast and crop calculations are substantive and bounded',()=>{
 assert.equal(contrastRatio('#000000','#ffffff'),21);assert.equal(contrastRatio('#777777','#777777'),1);
 assert.equal(execute('analyze_contrast',{foreground:'#777777',background:'#ffffff',fontPx:16}).aa,false);
 assert.equal(execute('analyze_contrast',{foreground:'#777777',background:'#ffffff',fontPx:24}).aa,true);
 const curve=execute('get_easing_curve',{intent:'settle',samples:11});assert.equal(curve.points[0].value,0);assert.equal(curve.points.at(-1).value,1);assert.ok(curve.points[5].value>.5);
 const crop=execute('plan_responsive_crop',{assetWidth:1600,assetHeight:900,width:390,height:844,focusX:.7,targetX:.65});assert.ok(Math.abs(crop.subjectViewportPosition.x-.65)<.001);assert.ok(crop.visibleAssetFraction<.4);
 const tokens=execute('get_design_tokens',{width:390,height:844});assert.ok(tokens.tokens.bodyPx>=13);assert.ok(tokens.tokens.controlPx>=11);
});

test('generators return executable escaped scroll HTML and three complete original GPU shader programs',()=>{
 const document=execute('generate_scroll_scaffold',{title:'Safe </script><script>bad()</script>',chapters:['Establish','Reveal','Resolve'],templateId:'noir-film'});
 assert.match(document.html,/position:sticky/);assert.match(document.html,/assets|cinematic\/ronin.webp/);assert.ok(!document.html.includes('<script>bad()'));
 const inline=document.html.match(/<script>([\s\S]*?)<\/script>/)[1];new Function(inline);
 for(const kind of ['ripple','aurora','liquid-chrome']){const shader=execute('generate_glsl_shader',{kind});assert.match(shader.fragment,/gl_FragColor/);assert.match(shader.html,/getContext\('webgl'\)/);new Function(shader.html.match(/<script>([\s\S]*?)<\/script>/)[1]);}
 const issues=execute('validate_motion_spec',{width:390,headlinePx:48,bodyPx:4,controlPx:3,duration:6,fps:30,media:'still',claimsGeneratedSubjectVideo:true,files:[]});assert.equal(issues.passed,false);assert.ok(issues.issues.length>=4);
});

test('source retrieval only calls fixed configured endpoint, strips unrelated fields and rejects cross-origin assets',async()=>{
 let seen;
 const fetchImpl=async(url,options)=>{seen={url,options};return new Response(JSON.stringify({id:'noir-film',title:'Noir',html:'<!doctype html><html>Original</html>',assets:[{url:'http://localhost:5188/cinematic/ronin.webp',path:'assets/ronin.webp'}],passwordHash:'not-public'}),{headers:{'content-type':'application/json'}})};
 const source=await fetchSource('http://localhost:5188','noir-film',{fetchImpl});assert.equal(seen.url,'http://localhost:5188/api/agent/templates/noir-film/source');assert.equal(seen.options.redirect,'error');assert.deepEqual(seen.options.headers,{Accept:'application/json'});assert.ok(!('passwordHash' in source));
 await assert.rejects(fetchSource('http://localhost:5188','../secret',{fetchImpl}));
 await assert.rejects(fetchSource('http://localhost:5188','noir-film',{fetchImpl:async()=>new Response(JSON.stringify({id:'noir-film',html:'<!doctype html>',assets:[{url:'http://evil.test/a',path:'a'}]}),{headers:{'content-type':'application/json'}})}),/configured MotionVault origin/);
});

test('source service fails closed on wrong IDs/types/HTTP status and enforces streamed byte limits',async()=>{
 await assert.rejects(fetchSource('http://localhost:5188','noir-film',{fetchImpl:async()=>new Response('nope',{status:503})}),/503/);
 await assert.rejects(fetchSource('http://localhost:5188','noir-film',{fetchImpl:async()=>new Response('{}',{headers:{'content-type':'text/html'}})}),/JSON/);
 await assert.rejects(fetchSource('http://localhost:5188','noir-film',{fetchImpl:async()=>new Response(JSON.stringify({id:'other',html:'<!doctype html>',assets:[]}),{headers:{'content-type':'application/json'}})}),/invalid template/);
 await assert.rejects(fetchSource('http://localhost:5188','noir-film',{maxBytes:30,fetchImpl:async()=>new Response('x'.repeat(31),{headers:{'content-type':'application/json'}})}),/byte limit/);
});

test('official SDK in-memory protocol lists 40 validated tools, resources, prompts and structured results',async(t)=>{
 const server=createMotionVaultServer(fixture),client=new Client({name:'motionvault-test',version:'1.0.0'});
 const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();await server.connect(serverTransport);await client.connect(clientTransport);t.after(async()=>{await client.close();await server.close()});
 const listed=await client.listTools();assert.equal(listed.tools.length,40);assert.ok(listed.tools.every(tool=>tool.annotations.readOnlyHint));
 const result=await client.callTool({name:'get_template',arguments:{id:'noir-film'}});assert.equal(result.structuredContent.mediaKind,'generated-video');
 const invalid=await client.callTool({name:'get_template',arguments:{id:'../invalid'}});assert.equal(invalid.isError,true);
 const metadata=JSON.parse(await readFile(new URL('../data/capabilities.json',import.meta.url),'utf8'));
 assert.deepEqual((await client.listResources()).resources.map(r=>r.uri),metadata.resources.map(r=>r.uri));assert.deepEqual((await client.listPrompts()).prompts.map(p=>p.name),metadata.prompts.map(p=>p.name));
 const palette=await client.callTool({name:'generate_palette',arguments:{seed:'#ff6600'}});assert.equal(palette.structuredContent.tones.length,8);
 const agents=await client.callTool({name:'list_agent_workflows',arguments:{}});assert.equal(agents.structuredContent.agents.length,6);
 const resource=await client.readResource({uri:'motionvault://capabilities'});assert.equal(JSON.parse(resource.contents[0].text).tools,40);
 const prompt=await client.getPrompt({name:'plan_product_film',arguments:{product:'original ski optics'}});assert.match(prompt.messages[0].content.text,/genuinely different product angle/);
});

test('official SDK stdio client can initialize CLI and call a tool with clean stdout framing',async(t)=>{
 const cli=fileURLToPath(new URL('../src/cli.mjs',import.meta.url));const transport=new StdioClientTransport({command:process.execPath,args:[cli,'--stdio'],stderr:'pipe'});
 const client=new Client({name:'stdio-test',version:'1.0.0'});await client.connect(transport);t.after(()=>client.close());
 assert.equal((await client.listTools()).tools.length,40);
 const result=await client.callTool({name:'get_template',arguments:{id:'ronin-studio'}});assert.equal(result.structuredContent.id,'ronin-studio');
});

test('official SDK streamable HTTP client round trip works statelessly and rejects invalid hosts/origins/body sizes',async(t)=>{
 const app=await startHttpServer({catalog:fixture,port:0});t.after(()=>app.close());
 const client=new Client({name:'http-test',version:'1.0.0'});await client.connect(new StreamableHTTPClientTransport(new URL(app.url)));t.after(()=>client.close());
 assert.equal((await client.listTools()).tools.length,40);assert.equal((await client.callTool({name:'search_templates',arguments:{query:'noir'}})).structuredContent.total,1);
 const base=`http://127.0.0.1:${app.port}`;assert.equal((await fetch(base+'/health')).status,200);
 assert.equal((await fetch(base+'/mcp',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{' })).status,400);
 assert.equal((await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:'a'.repeat(270000)})})).status,413);
 assert.equal((await fetch(base+'/mcp')).status,405);
 const badHost=await new Promise((resolve,reject)=>{const req=request(base+'/health',{headers:{Host:'evil.test'}},response=>{response.resume();resolve(response.statusCode)});req.on('error',reject);req.end()});assert.equal(badHost,403);
});

