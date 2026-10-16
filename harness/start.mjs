import {createBridge} from './bridge.mjs';
const bridge=createBridge({token:process.env.CODEX_HARNESS_TOKEN,apiKey:process.env.MODEL_API_KEY,baseUrl:process.env.MODEL_BASE_URL,models:(process.env.CODEX_MODELS??'').split(',').filter(Boolean),stateDir:process.env.HARNESS_STATE_DIR??'/state'});
bridge.server.listen(Number(process.env.PORT??8789),process.env.HOST??'127.0.0.1',()=>console.log('Cloud Codex gateway listening. No credentials or task contents logged.'));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{await bridge.close();process.exit(0);});
