import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createToolset,catalogSchema,contrastRatio} from '../src/tools.mjs';
import {buildCapabilities,serializeCapabilities} from '../scripts/build-capabilities.mjs';
import {workflows} from '../src/workflows.mjs';

const catalog=catalogSchema.parse({templates:[{id:'sample-film',title:'Sample Film',category:'Websites',engine:'Cinematic / Video',tags:['Cinematic'],cinematic:{kind:'sample',poster:'/cinematic/sample.png',video:'/cinematic/sample.mp4'}}],designAssets:[{id:'style-a',title:'A',library:'styles',tokens:{colors:{ink:'#111111'},spacing:{unit:4}}},{id:'style-b',title:'B',library:'styles',tokens:{colors:{ink:'#222222'},spacing:{unit:8}}}]});
const html='<!doctype html><html lang="en"><head><title>Sample</title></head><body><h1>Sample</h1><img alt="Original subject" src="assets/sample.png"><video src="/cinematic/sample.mp4"></video><a href="#contact">Contact</a><section id="contact"><label for="email">Email</label><input id="email" name="email"><button>Pause motion</button></section><style>@media(prefers-reduced-motion:reduce){*{transition:none}}</style></body></html>';
const fetchImpl=async()=>new Response(JSON.stringify({id:'sample-film',title:'Sample',html,assets:[{url:'http://localhost:5188/cinematic/sample.png',path:'assets/sample.png'}]}),{headers:{'content-type':'application/json'}});
const definitions=createToolset(catalog,{fetchImpl});
const run=(name,args={})=>{const tool=definitions.find(t=>t.name===name);assert.ok(tool,`Missing tool ${name}`);return tool.run(tool.inputSchema.parse(args));};

test('all 40 names are unique and generated capabilities exactly match registry, skills and real role guides',async()=>{
 assert.equal(definitions.length,40);assert.equal(new Set(definitions.map(t=>t.name)).size,40);
 const expected=await buildCapabilities(),stored=await readFile(new URL('../data/capabilities.json',import.meta.url),'utf8');
 assert.equal(stored,serializeCapabilities(expected));assert.deepEqual(expected.counts,{tools:40,resources:3,prompts:3,skills:6,agents:6});
 assert.deepEqual(expected.tools.map(t=>t.name),definitions.map(t=>t.name));assert.ok(expected.tools.every(t=>t.inputSchema.additionalProperties===false));
 for(const guide of expected.agents){const content=await readFile(new URL('../'+guide.path,import.meta.url),'utf8');assert.match(content,/does not start background agents/);for(const tool of guide.tools)assert.ok(definitions.some(t=>t.name===tool));}
 assert.match(expected.sourceBoundary,/Commons Clause/);
});

test('palette contrast is measured and fluid type scale reaches exact viewport endpoints',()=>{
 const palette=run('generate_palette',{seed:'#ed392d'});assert.equal(palette.tones.length,8);assert.equal(palette.contrast[0].ratio,Math.round(contrastRatio(palette.colors.ink,palette.colors.surface)*10000)/10000);assert.match(palette.css,/--tone-800/);
 const scale=run('generate_type_scale',{basePx:16,ratio:1.25,steps:4,minViewport:400,maxViewport:1400,desktopMultiplier:1.5});assert.equal(scale.scale[0].minPx,16);assert.equal(scale.scale[3].maxPx,46.875);assert.match(scale.css,/clamp/);
 const formula=scale.scale[3].css.match(/calc\(([-\d.]+)px \+ ([-\d.]+)vw\)/);assert.ok(Math.abs(Number(formula[1])+Number(formula[2])*4-scale.scale[3].minPx)<.001);assert.ok(Math.abs(Number(formula[1])+Number(formula[2])*14-scale.scale[3].maxPx)<.001);
 assert.throws(()=>run('generate_type_scale',{minViewport:1000,maxViewport:600}),/exceed/);
 const spacing=run('generate_spacing_scale',{unit:4,multipliers:[4,0,1,4],density:'compact'});assert.deepEqual(spacing.scale.map(s=>s.px),[0,3,12]);assert.match(spacing.css,/--space-2:12px/);
});

test('design comparison uses real nested values and generated documents/layouts contain usable decisions',()=>{
 const comparison=run('compare_design_assets',{ids:['style-a','style-b']});assert.equal(comparison.tokenDifferences.length,2);assert.deepEqual(comparison.tokenDifferences[0].values,{'style-a':'#111111','style-b':'#222222'});
 assert.throws(()=>run('compare_design_assets',{ids:['style-a','missing']}),/Unknown/);
 const doc=run('generate_design_document',{name:'Night studio',purpose:'A material-led original system.',colors:{ink:'#111111',paper:'#fafafa'},fontFamilies:['Georgia'],typeScale:[16,24,48],spacing:[4,8,16],componentRules:['Keep visible keyboard focus.']});assert.match(doc.content,/Keep visible keyboard focus/);assert.match(doc.content,/font redistribution/);
 const layout=run('generate_responsive_layout',{});assert.match(layout.css,/minmax\(min\(100%,280px\),1fr\)/);assert.match(layout.css,/@container/);assert.match(layout.example,/class="cinematic-layout"/);assert.throws(()=>run('generate_responsive_layout',{className:'</style><script>'}));
});

test('HTML inspection ignores script strings and catches duplicate IDs, broken anchors and executable URLs',()=>{
 const result=run('inspect_html',{html:html+'<div id="contact"></div><a href="#missing">Missing</a><a href="javascript:bad()">Bad</a><script>const x="<img src=not-real>"</script>'});
 assert.equal(result.counts.img,1);for(const code of ['duplicate-id','missing-anchor','executable-url'])assert.ok(result.findings.some(f=>f.code===code));assert.equal(result.blocking,true);
 assert.throws(()=>run('inspect_html',{html:'a'.repeat(120001)}));assert.throws(()=>run('inspect_html',{html,url:'https://arbitrary.example'}));
 const pass=run('check_accessibility_markup',{html});assert.equal(pass.findings.length,0);
 const fail=run('check_accessibility_markup',{html:'<html><img src="x"><button></button><input name="email"></html>'});for(const code of ['missing-lang','missing-title','missing-h1','missing-alt','empty-button','label-needs-review'])assert.ok(fail.findings.some(f=>f.code===code));
});

test('motion checks preserve unknown evidence and produce effect-specific reduced-motion alternatives',()=>{
 const reviewed=run('check_motion_accessibility',{html,autonomousSeconds:8,hasEquivalentStill:true});assert.equal(reviewed.findings.length,0);
 const failed=run('check_motion_accessibility',{html:'<video autoplay></video>',autonomousSeconds:6,flashesPerSecond:4});assert.ok(failed.findings.some(f=>f.code==='no-pause-signal'));assert.ok(failed.findings.some(f=>f.code==='flash-review'));
 const plan=run('build_reduced_motion_plan',{effects:['shader','scrub-video','flash','shader']});assert.equal(plan.effects.length,3);assert.match(plan.effects.find(e=>e.effect==='shader').implementation,/RAF/);assert.match(plan.effects.find(e=>e.effect==='flash').alternative,/Remove/);assert.match(plan.note,/CSS alone/);
});

test('asset validation rejects traversal/collisions/missing files and performance totals stay explicit',()=>{
 const result=run('validate_asset_manifest',{assets:[{path:'../secrets.png',kind:'image'},{path:'assets/A.png',kind:'video',url:'https://remote.example/A.png'},{path:'assets/a.png',kind:'image'}],packagedPaths:['assets/A.png']});for(const code of ['unsafe-path','duplicate-path','missing-file','external-origin','extension-kind','missing-license'])assert.ok(result.findings.some(f=>f.code===code));
 for(const path of ['C:/private.png','assets\\x.png','%2e%2e/private.png','assets//x.png'])assert.ok(run('validate_asset_manifest',{assets:[{path}]}).blocking);
 const budget=run('analyze_performance_budget',{assets:[{path:'hero.mp4',kind:'video',bytes:6000000},{path:'font.woff2',kind:'font',bytes:100000},{path:'unknown.png',kind:'image'}],initialPaths:['hero.mp4','font.woff2'],initialBudgetBytes:3000000});assert.equal(budget.knownTotalBytes,6100000);assert.equal(budget.knownInitialBytes,6100000);assert.equal(budget.byKind.video,6000000);assert.ok(budget.findings.some(f=>f.code==='unknown-byte-size'));assert.ok(budget.findings.some(f=>f.code==='initial-budget'));
});

test('license review enforces reference-only React Bits and separates end-project/library permission',()=>{
 const dependency=run('audit_dependencies',{dependencies:[{name:'react-bits',version:'^1.0.0',license:'MIT + Commons Clause'},{name:'three',version:'0.180.0',license:'MIT',noticeIncluded:true}]});assert.ok(dependency.blocking);assert.ok(dependency.findings.some(f=>f.code==='unpinned-version'));assert.ok(dependency.findings.some(f=>f.code==='restricted-redistribution'));
 const item={name:'Original generated image',kind:'media',license:'Provider output terms',source:'https://provider.example/terms',evidence:'Recorded output scope; downstream library grant unverified.'};assert.equal(run('review_licensing',{use:'end-project',items:[item]}).blocking,false);assert.equal(run('review_licensing',{use:'template-library',items:[item]}).blocking,true);
 const copied=run('review_licensing',{use:'template-library',items:[{name:'React Bits port',kind:'code',license:'MIT + Commons Clause',source:'https://github.com/DavidHDev/react-bits',evidence:'Current LICENSE.md',redistributionPermission:'confirmed',noticeIncluded:true}]});assert.ok(copied.findings.some(f=>f.code==='reference-only'));
});

test('provenance comparison requires native bytes and preserves credential validation limits',()=>{
 const a='a'.repeat(64),b='b'.repeat(64);const good=run('check_media_provenance',{items:[{path:'hero.png',nativeSha256:a,distributedSha256:a,provenanceRequired:true,nativeMarkerPresent:true,distributedMarkerPresent:true}]});assert.equal(good.blocking,false);assert.equal(good.results[0].byteIdentical,true);assert.match(good.scope,/does not read media/i);
 const bad=run('check_media_provenance',{items:[{path:'hero.webp',nativeSha256:a,distributedSha256:b,provenanceRequired:true,nativeMarkerPresent:true,distributedMarkerPresent:false}]});assert.equal(bad.findings.length,2);assert.equal(bad.blocking,true);
 assert.throws(()=>run('check_media_provenance',{items:[{path:'x',nativeSha256:'bad',distributedSha256:a}]}));
});

test('source verification uses one origin, hashes exact HTML and does not execute source',async()=>{
 const result=await run('verify_template_source',{id:'sample-film'});assert.equal(result.sha256,createHash('sha256').update(html).digest('hex'));assert.equal(result.blocking,false);assert.equal(result.assetCount,1);
 const definitions2=createToolset(catalog,{fetchImpl:async()=>new Response(JSON.stringify({id:'sample-film',html:'<!doctype html><video></video>',assets:[{path:'../outside',url:'http://localhost:5188/x'}]}),{headers:{'content-type':'application/json'}})});const tool=definitions2.find(t=>t.name==='verify_template_source');const bad=await tool.run({id:'sample-film'});assert.ok(bad.findings.some(f=>f.code==='unsafe-source-path'));assert.ok(bad.findings.some(f=>f.code==='video-reference-unverified'));
});

test('launch gates cannot turn absent evidence into passes; visual plans and agents expose real scope',()=>{
 const launch=run('plan_launch_preflight',{scope:'paid-library',evidence:[{gate:'desktop-frames',status:'pass',note:'Actual screenshots.'}]});assert.equal(launch.ready,false);assert.equal(launch.gates.length,10);assert.equal(launch.gates.find(g=>g.gate==='billing-cancellation').status,'unverified');
 assert.throws(()=>run('plan_launch_preflight',{evidence:[{gate:'forms',status:'pass'},{gate:'forms',status:'fail'}]}),/Duplicate/);
 const qa=run('plan_visual_qa',{id:'sample-film',duration:8});assert.equal(qa.cases.length,10);assert.deepEqual(qa.cases.slice(0,5).map(c=>c.timeSeconds),[0,2,4,6,8]);assert.match(qa.scope,/not evidence/);
 assert.equal(run('list_agent_workflows',{}).agents.length,6);assert.equal(run('list_agent_workflows',{query:'rights'}).agents[0].id,'asset-rights-steward');for(const workflow of workflows)assert.equal(run('get_agent_workflow',{id:workflow.id}).deliverables.length,3);
});
