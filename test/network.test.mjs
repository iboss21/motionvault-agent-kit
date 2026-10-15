import test from'node:test';
import assert from'node:assert/strict';
import{startHttpServer}from'../src/server.mjs';
import{loadCatalog}from'../src/tools.mjs';
import{request}from'node:http';
const status=(url,headers)=>new Promise((resolve,reject)=>{const req=request(url,{headers},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});req.on('error',reject);req.end()});
test('network binding requires explicit exact hosts and preserves origin checks',async()=>{
 const catalog=await loadCatalog();
 await assert.rejects(startHttpServer({catalog,port:0,host:'0.0.0.0'}),/explicit Host/);
 await assert.rejects(startHttpServer({catalog,port:0,host:'0.0.0.0',allowedHosts:['*.motionvault.site']}),/exact hostnames/);
 const app=await startHttpServer({catalog,port:0,host:'0.0.0.0',allowedHosts:['mcp.motionvault.site']});
 try{const base=`http://127.0.0.1:${app.port}`;
  assert.equal(await status(base+'/',{Host:'mcp.motionvault.site'}),200);
  assert.equal(await status(base+'/health',{Host:'evil.example'}),403);
  assert.equal(await status(base+'/health',{Host:'mcp.motionvault.site',Origin:'https://evil.example'}),403);
  assert.equal(await status(base+'/health',{Host:'mcp.motionvault.site',Origin:'http://localhost:5188'}),200);
 }finally{await app.close()}
});
