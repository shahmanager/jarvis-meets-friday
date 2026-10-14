import {HttpError,object} from './security';
export type Preferences={maxSteps:number|null;maxTokens:number|null;teamReview:boolean;telegramTeam:boolean;memory:'builtin'|'agentmemory'};
export const defaultPreferences:Preferences={maxSteps:null,maxTokens:null,teamReview:true,telegramTeam:true,memory:'agentmemory'};
export function limit(value:unknown,name:string):number|null{if(value===null||value===undefined||value==='')return null;const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw new HttpError(400,`${name} must be a positive integer or blank for no app limit.`);return n;}
export function preferences(value:unknown):Preferences{const b=value?object(value):{};return {maxSteps:limit(b.maxSteps,'Step limit'),maxTokens:limit(b.maxTokens,'Token limit'),teamReview:b.teamReview!==false,telegramTeam:b.telegramTeam!==false,memory:b.memory==='builtin'?'builtin':'agentmemory'};}
export function budgetReached(t:{steps:number;tokens:number;maxSteps:number|null;maxTokens:number|null;stewardCalls?:number}){return (t.maxSteps!==null&&t.steps+(t.stewardCalls??0)>=t.maxSteps)||(t.maxTokens!==null&&t.tokens>=t.maxTokens);}
