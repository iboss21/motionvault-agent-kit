import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {z} from 'zod';
import {createToolset} from '../src/tools.mjs';
import {workflows,resourceDefinitions,promptDefinitions} from '../src/workflows.mjs';

const root=new URL('../',import.meta.url);
const frontmatter=content=>{
 const block=content.match(/^---\r?\n([\s\S]*?)\r?\n---/);if(!block)throw Error('Skill/agent is missing YAML frontmatter.');
 const result={};for(const key of ['name','description']){const value=block[1].match(new RegExp(`^${key}: (.+)$`,'m'));if(!value)throw Error(`Missing ${key} metadata.`);result[key]=value[1].trim();}return result;
};
export async function buildCapabilities(){
 const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
 const definitions=createToolset({templates:[],designAssets:[]});
 const skillNames=(await readdir(new URL('skills/',root),{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort();
 const skills=await Promise.all(skillNames.map(async name=>{const path=`skills/${name}/SKILL.md`,meta=frontmatter(await readFile(new URL(path,root),'utf8'));if(meta.name!==name)throw Error(`Skill directory/name mismatch: ${name}`);return{...meta,path};}));
 const agents=await Promise.all(workflows.map(async workflow=>{const path=`agents/${workflow.id}.md`,meta=frontmatter(await readFile(new URL(path,root),'utf8'));if(meta.name!==workflow.id)throw Error(`Agent guide/name mismatch: ${workflow.id}`);if(!skills.some(s=>s.name===workflow.skill))throw Error(`Missing workflow skill: ${workflow.skill}`);for(const name of workflow.tools)if(!definitions.some(t=>t.name===name))throw Error(`Unknown workflow tool: ${name}`);return{id:workflow.id,title:workflow.title,description:meta.description,path,skill:workflow.skill,tools:workflow.tools,execution:'client-invoked instruction guide'};}));
 const tools=definitions.map(tool=>({name:tool.name,description:tool.description,inputSchema:z.toJSONSchema(tool.inputSchema,{io:'input'}),readOnly:true,network:['get_build_prompt','get_template_source','verify_template_source'].includes(tool.name)?'configured-source-origin-only':'none'}));
 return{schemaVersion:1,name:pkg.name,version:pkg.version,counts:{tools:tools.length,resources:resourceDefinitions.length,prompts:promptDefinitions.length,skills:skills.length,agents:agents.length},tools,resources:resourceDefinitions,prompts:promptDefinitions,skills,agents,runtime:{sdk:'@modelcontextprotocol/sdk 1.32.1',protocolLine:'v1 / through 2025-11-25',transports:['stdio','stateless-streamable-http'],sourceTimeoutMs:8000,sourceMaxBytes:1000000,requestMaxBytes:262144,mutations:false,mediaGeneration:false,backgroundAgents:false},sourceBoundary:'Original or explicitly licensed work only. React Bits MIT + Commons Clause components/bundles/ports are interaction research, not commercial template-library source.'};
}
export const serializeCapabilities=value=>JSON.stringify(value,null,2)+'\n';
export async function writeCapabilities({check=false}={}){
 const expected=serializeCapabilities(await buildCapabilities()),path=new URL('data/capabilities.json',root);
 if(check){if(await readFile(path,'utf8')!==expected)throw Error('Capability metadata is stale. Run npm run capabilities.');}
 else{await mkdir(new URL('data/',root),{recursive:true});await writeFile(path,expected);}
 return JSON.parse(expected).counts;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const counts=await writeCapabilities({check:process.argv.includes('--check')});process.stdout.write(JSON.stringify({ok:true,counts})+'\n');}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
}
