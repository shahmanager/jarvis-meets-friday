from pathlib import Path
import html,re,json,math,shutil
lines=Path('docs/DEMO_VIVA_GUIDE.md').read_text(encoding='utf-8').splitlines()
blocks=[];i=0
while i<len(lines):
 line=lines[i];i+=1
 if not line.strip():continue
 if line.startswith('|'):
  rows=[line]
  while i<len(lines) and lines[i].startswith('|'):rows.append(lines[i]);i+=1
  blocks.append(('table',[[c.strip() for c in r.strip('|').split('|')] for r in rows if not re.match(r'^\|[\s:|-]+$',r)]));continue
 m=re.match(r'^(#{1,3}) (.+)',line)
 if m:blocks.append(('h'+str(len(m[1])),m[2]));continue
 m=re.match(r'^!\[(.+)\]\(../public/diagrams/([\w-]+).svg\)$',line)
 if m:blocks.append(('image',(m[1],m[2])));continue
 if line.startswith('- '):blocks.append(('li',line[2:]));continue
 if re.match(r'^\d+\. ',line):blocks.append(('p',line));continue
 parts=[line]
 while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','|','!','- ')) and not re.match(r'^\d+\. ',lines[i]):parts.append(lines[i]);i+=1
 blocks.append(('p',' '.join(parts)))
def inline(s,pdf=False):
 s=html.escape(s);s=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s)
 s=re.sub(r'`([^`]+)`',r'<font name="Courier">\1</font>' if pdf else r'<code>\1</code>',s)
 if not pdf:s=re.sub(r'(https://[^\s<]+)',r'<a href="\1">\1</a>',s)
 return s
out=[];toc=[]
for kind,value in blocks:
 if kind.startswith('h'):
  anchor='chapter-'+str(len(toc)+1) if kind=='h2' else 'guide-title'
  if kind=='h2':toc.append((anchor,value))
  out.append(f'<{kind} id="{anchor}">{inline(value)}</{kind}>')
 elif kind=='table':out.append('<div class="table-wrap"><table><thead><tr>'+''.join('<th>'+inline(c)+'</th>' for c in value[0])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+inline(c)+'</td>' for c in row)+'</tr>' for row in value[1:])+'</tbody></table></div>')
 elif kind=='image':out.append('<figure><img src="/diagrams/'+value[1]+'.svg" alt="'+html.escape(value[0])+'"><figcaption>'+html.escape(value[0])+'</figcaption></figure>')
 elif kind=='li':out.append('<p class="bullet">• '+inline(value)+'</p>')
 else:out.append('<p>'+inline(value)+'</p>')
css='''*{box-sizing:border-box}body{margin:0;background:#f2f4f1;color:#203039;font:16px/1.75 Arial,sans-serif}aside{width:270px;position:fixed;inset:0 auto 0 0;background:#123d43;color:white;padding:32px 24px;overflow:auto}aside strong{font-size:22px}aside a{display:block;color:#e5f1ee;text-decoration:none;font-size:13px;padding:8px 0;border-bottom:1px solid #ffffff20}main{margin-left:270px;padding:40px 4vw 80px;max-width:1450px}article{background:white;border:1px solid #d6dfda;border-radius:12px;padding:38px 44px}h1{font-size:34px;line-height:1.25;letter-spacing:-.8px;margin-top:0}h2{font-size:24px;line-height:1.35;border-top:2px solid #dbe7e1;padding-top:24px;margin-top:48px;scroll-margin-top:20px}p{max-width:90ch}a{color:#176d76;overflow-wrap:anywhere}code{font:13px Consolas,monospace;background:#eef3f0;padding:2px 4px;overflow-wrap:anywhere}.table-wrap{overflow-x:auto;margin:24px 0}table{width:100%;border-collapse:collapse;font-size:14px;line-height:1.6}th{text-align:left;background:#164e55;color:white}td,th{padding:12px 14px;border:1px solid #d3dfda;vertical-align:top}tr:nth-child(even){background:#f7faf8}td:first-child{width:28%;font-weight:600}figure{margin:28px 0;padding:16px;border:1px solid #d3dfda;border-radius:8px}figure img{display:block;width:100%;height:auto}figcaption{font-size:12px;color:#526970;margin-top:8px}.notice{font-size:14px;margin-bottom:20px;background:#e9f3ef;padding:14px 20px;border-left:4px solid #31766c}.bullet{padding-left:12px}@media(max-width:950px){aside{position:static;width:auto}aside a{display:inline-block;margin-right:16px}main{margin:0;padding:18px}article{padding:22px}h1{font-size:28px}}@media print{@page{size:A4;margin:15mm}aside,.notice{display:none}body{background:white;font-size:10pt;line-height:1.5}main{margin:0;padding:0;max-width:none}article{padding:0;border:0}h1{font-size:23pt}h2{font-size:16pt;break-after:avoid}table{font-size:8pt}thead{display:table-header-group}tr,figure{break-inside:avoid}figure{padding:8px}a{color:inherit;text-decoration:none}}'''
nav='<aside><strong>Jarvis × Friday</strong><p>Cloud architecture explained</p>'+''.join('<a href="#'+a+'">'+html.escape(t)+'</a>' for a,t in toc)+'</aside>'
Path('public/demo-guide.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jarvis Meets Friday · Cloud architecture explained</title><style>'+css+'</style></head><body>'+nav+'<main><div class="notice">The agent runs in the cloud. Your device opens the website. <a href="/demo-guide.pdf">Download team PDF</a> · <a href="/">Open office</a></div><article>'+''.join(out)+'</article></main></body></html>',encoding='utf-8')
if '--pdf' not in __import__('sys').argv:print('Web guide generated');raise SystemExit
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,Flowable
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from pypdf import PdfReader
styles=getSampleStyleSheet();styles.add(ParagraphStyle(name='BodyClear',fontName='Helvetica',fontSize=10,leading=15,spaceAfter=9,textColor=colors.HexColor('#203039')));styles.add(ParagraphStyle(name='CellClear',parent=styles['BodyClear'],fontSize=8.6,leading=12,spaceAfter=0));styles.add(ParagraphStyle(name='HeaderClear',parent=styles['CellClear'],fontName='Helvetica-Bold',textColor=colors.white))
for name in ['Heading1','Heading2','Heading3']:styles[name].textColor=colors.HexColor('#174f55');styles[name].keepWithNext=True
styles['Heading1'].fontSize=25;styles['Heading1'].leading=30;styles['Heading2'].fontSize=17;styles['Heading2'].leading=22;styles['Heading2'].spaceBefore=20;styles['Heading2'].spaceAfter=11
figures=json.loads(Path('work/guide-diagrams.json').read_text());palette={'plain':('#f7f8f6','#a7b6b4'),'cloud':('#eaf6f4','#4c8c85'),'aws':('#fff3e2','#c58e40'),'model':('#f0eefb','#8770ad')}
class Diagram(Flowable):
 def __init__(self,key):super().__init__();self.f=figures[key];self.width=499;self.scale=self.width/self.f['size'][0];self.height=self.f['size'][1]*self.scale
 def draw(self):
  c=self.canv;f=self.f;h=f['size'][1];c.saveState();c.scale(self.scale,self.scale)
  def box(x,y,w,bh,label,body,t,group=False):
   fill,stroke=palette[t];c.setFillColor(colors.HexColor(fill) if group else colors.white);c.setStrokeColor(colors.HexColor(stroke));c.roundRect(x,h-y-bh,w,bh,10,fill=1,stroke=1);c.setFillColor(colors.HexColor('#193a43'));c.setFont('Helvetica-Bold',17);c.drawString(x+14,h-y-27,label)
   c.setFont('Helvetica',16)
   for i,line in enumerate(body):c.drawString(x+14,h-y-49-i*20,line)
  for x,y,w,bh,label,t in f['groups']:box(x,y,w,bh,label,[],t,True)
  c.setStrokeColor(colors.HexColor('#42636a'));c.setFillColor(colors.HexColor('#42636a'));c.setLineWidth(2)
  for pts in f['edges']:
   for (x,y),(xx,yy) in zip(pts,pts[1:]):c.line(x,h-y,xx,h-yy)
   (x,y),(xx,yy)=pts[-2:];a=math.atan2(yy-y,xx-x);p=c.beginPath();p.moveTo(xx,h-yy)
   for delta in [-.45,.45]:p.lineTo(xx-10*math.cos(a+delta),h-(yy-10*math.sin(a+delta)))
   p.close();c.drawPath(p,fill=1,stroke=0)
  for x,y,w,bh,label,body,t in f['nodes']:box(x,y,w,bh,label,body,t)
  c.restoreState()
story=[]
for kind,value in blocks:
 if kind.startswith('h'):story.append(Paragraph(inline(value,True),styles[{'h1':'Heading1','h2':'Heading2','h3':'Heading3'}[kind]]))
 elif kind=='image':story.extend([Diagram(value[1]),Paragraph(inline(value[0],True),styles['CellClear']),Spacer(1,12)])
 elif kind=='table':
  rows=[[Paragraph(inline(c,True),styles['HeaderClear' if j==0 else 'CellClear']) for c in row] for j,row in enumerate(value)];n=len(value[0]);widths=[155,344] if n==2 else [126,175,198];t=Table(rows,colWidths=widths,repeatRows=1,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#174f55')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f3f7f4')]),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#d2dfd9')),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]));story.extend([t,Spacer(1,12)])
 else:story.append(Paragraph(inline(value,True),styles['BodyClear'],bulletText='•' if kind=='li' else None))
def footer(c,d):
 c.saveState();c.setFont('Helvetica',8);c.setFillColor(colors.HexColor('#526970'));c.drawString(48,25,'Jarvis Meets Friday | Cloud architecture explained | 21 Oct 2026');c.drawRightString(A4[0]-48,25,str(d.page));c.restoreState()
target=Path('public/demo-guide.pdf');SimpleDocTemplate(str(target),pagesize=A4,leftMargin=48,rightMargin=48,topMargin=42,bottomMargin=48,title='Jarvis Meets Friday: Cloud Architecture Explained',author='Jarvis Meets Friday team').build(story,onFirstPage=footer,onLaterPages=footer)
reader=PdfReader(target);assert len(reader.pages)>6;assert 'cloud' in reader.pages[0].extract_text().lower();Path('output/pdf').mkdir(parents=True,exist_ok=True);shutil.copyfile(target,'output/pdf/Jarvis-Meets-Friday-Demo-Viva-Guide.pdf');print('PDF generated:',len(reader.pages),'pages')
