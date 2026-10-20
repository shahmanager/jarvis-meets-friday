// Render a small Markdown subset with DOM nodes. Model HTML is always plain text.
function plainText(value){return String(value??'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[*_`#]/g,'').replace(/\s+/g,' ').trim();}
function missionTitle(task){const first=String(task.prompt??'').split('\n').find(line=>line.trim())??'Untitled mission';const clean=plainText(first);return clean.length>95?clean.slice(0,92).trimEnd()+'…':clean;}
function renderRichText(root,value){
 root.replaceChildren();root.classList.add('rich-text');
 function inline(parent,text){
  const pattern=/(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^\s)]+\))/g;let start=0;
  for(const match of text.matchAll(pattern)){
   if(match.index>start)parent.append(document.createTextNode(text.slice(start,match.index)));
   const token=match[0];let node;
   if(token.startsWith('`')){node=document.createElement('code');node.textContent=token.slice(1,-1);}
   else if(token.startsWith('**')){node=document.createElement('strong');node.textContent=token.slice(2,-2);}
   else{const parts=token.match(/^\[([^\]]+)\]\(([^)]+)\)$/),safe=/^https?:\/\//i.test(parts[2])||/^\/api\/artifacts\/[a-f0-9-]{36}(?:\/preview)?$/i.test(parts[2]);node=document.createElement(safe?'a':'span');node.textContent=parts[1];if(safe){node.href=parts[2];if(!parts[2].startsWith('/')){node.target='_blank';node.rel='noopener noreferrer';}}}
   parent.append(node);start=match.index+token.length;
  }
  if(start<text.length)parent.append(document.createTextNode(text.slice(start)));
 }
 const lines=String(value??'').slice(0,240000).replace(/\r/g,'').split('\n');let i=0;
 while(i<lines.length){
  const line=lines[i];if(!line.trim()){i++;continue;}
  if(/^```/.test(line)){const pre=document.createElement('pre'),code=document.createElement('code'),body=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))body.push(lines[i++]);code.textContent=body.join('\n');pre.append(code);root.append(pre);i++;continue;}
  if(line.includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]??'')){
   const wrap=document.createElement('div'),table=document.createElement('table');wrap.className='table-scroll';
   const cells=row=>row.trim().replace(/^\||\|$/g,'').split('|');
   const rows=[line];i+=2;while(i<lines.length&&lines[i].includes('|')&&lines[i].trim())rows.push(lines[i++]);
   for(const [index,row]of rows.entries()){const tr=document.createElement('tr');for(const text of cells(row)){const cell=document.createElement(index?'td':'th');inline(cell,text.trim());tr.append(cell);}table.append(tr);}
   wrap.append(table);root.append(wrap);continue;
  }
  const heading=line.match(/^#{1,6}\s+(.+)$/);if(heading){const h=document.createElement('h3');inline(h,heading[1]);root.append(h);i++;continue;}
  const bullet=line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);if(bullet){const ordered=/^\s*\d+\./.test(line),list=document.createElement(ordered?'ol':'ul');while(i<lines.length){const m=lines[i].match(ordered?/^\s*\d+\.\s+(.+)$/:/^\s*[-*]\s+(.+)$/);if(!m)break;const li=document.createElement('li');inline(li,m[1]);list.append(li);i++;}root.append(list);continue;}
  const p=document.createElement('p'),body=[line];i++;while(i<lines.length&&lines[i].trim()&&!/^\s*(?:#{1,6}\s|[-*]\s|\d+\.\s|```)/.test(lines[i])&&!(lines[i].includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]??'')))body.push(lines[i++]);inline(p,body.join('\n'));root.append(p);
 }
}
