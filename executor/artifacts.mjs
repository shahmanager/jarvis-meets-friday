import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const run=promisify(execFile);

export function artifactSpec(task,args,write=false){
 if(!/^[a-f0-9-]{36}$/.test(task)||typeof args.id!=='string'||!/^[a-f0-9-]{36}$/.test(args.id))throw new Error('Invalid artifact identifier.');
 if(write&&(typeof args.name!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9_. -]*\.(txt|md|csv|json|html)$/.test(args.name)||args.name.length>120||typeof args.content!=='string'||args.content.length>60000))throw new Error('Invalid text artifact.');
 return {key:`artifacts/${task}/${args.id}`,bytes:write?Buffer.byteLength(args.content):undefined};
}

export async function artifact(task,args,write){
 const spec=artifactSpec(task,args,write),bucket=process.env.ARTIFACT_BUCKET;
 if(!bucket||!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket))throw new Error('Configure ARTIFACT_BUCKET on the supervisor.');
 const directory=await mkdtemp(join(tmpdir(),'relay-artifact-')),file=join(directory,'body');
 try{
  if(write){await writeFile(file,args.content,{mode:0o600});await run('aws',['s3api','put-object','--bucket',bucket,'--key',spec.key,'--body',file,'--server-side-encryption','AES256','--content-type','application/octet-stream','--no-cli-pager'],{timeout:45000,maxBuffer:100000});return {stored:true,bytes:spec.bytes};}
  const {stdout}=await run('aws',['s3api','head-object','--bucket',bucket,'--key',spec.key,'--no-cli-pager'],{timeout:15000,maxBuffer:100000});const metadata=JSON.parse(stdout),length=metadata.ContentLength;
  if(!Number.isSafeInteger(length)||length<0||length>240000)throw new Error('Artifact exceeds the download limit.');
  if(length===0)return {content_base64:''};
  await run('aws',['s3api','get-object','--bucket',bucket,'--key',spec.key,'--range','bytes=0-239999','--if-match',metadata.ETag,'--no-cli-pager',file],{timeout:30000,maxBuffer:100000});
  if((await stat(file)).size>240000)throw new Error('Artifact exceeds the download limit.');
  return {content_base64:(await readFile(file)).toString('base64')};
 }finally{await rm(directory,{recursive:true,force:true});}
}
