import type { EngineResult, Horizon, OHLCV } from "./engine12";

export type LayerKey = "technical" | "statistical" | "valuation";
export interface LayerResult {
  key: LayerKey;
  label: string;
  available: boolean;
  reason?: string;
  target: number | null;
  call: "UP" | "FLAT" | "DOWN" | null;
  path: number[];
  weight: number;
}
export interface FanPoint { date: string; median: number; low68: number; high68: number; low95: number; high95: number }
export interface Scenario { key: "bear" | "base" | "bull"; probability: number; target: number; contributions: Record<LayerKey, number> }
export interface EnsembleResult {
  layers: LayerResult[];
  fan: FanPoint[];
  target: number;
  signal: EngineResult["signal"];
  probabilities: { bear: number; base: number; bull: number };
  scenarios: Scenario[];
  weightSource: string;
  paths: number;
}
export interface WeightInput { weights?: Partial<Record<LayerKey, number>>; source?: string }
export interface ValuationInput { currentMultiple: number | null; sectorMedian: number | null; sampleSize: number; label: "P/E" | "P/B" }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
function hash(s: string) { let h = 2166136261; for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t=Math.imul(seed ^ seed>>>15,1|seed); t=t+Math.imul(t ^ t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function normal(r:()=>number){ const u=Math.max(r(),1e-9),v=Math.max(r(),1e-9); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
function quantile(sorted:number[],q:number){ const x=(sorted.length-1)*q,lo=Math.floor(x),hi=Math.ceil(x); return lo===hi?sorted[lo]:sorted[lo]+(sorted[hi]-sorted[lo])*(x-lo); }
function tradingDates(start:string,days:number){ const out:string[]=[]; const d=new Date(`${start}T12:00:00Z`); while(out.length<days){ d.setUTCDate(d.getUTCDate()+1); if(d.getUTCDay()!==0&&d.getUTCDay()!==6) out.push(d.toISOString().slice(0,10)); } return out; }
function roundedProbabilities(raw:number[]){ const floors=raw.map(Math.floor); let left=100-floors.reduce((a,b)=>a+b,0); const order=raw.map((v,i)=>({i,f:v-Math.floor(v)})).sort((a,b)=>b.f-a.f); for(let j=0;j<left;j++) floors[order[j%order.length].i]++; return floors; }
function signalFromReturn(r:number):EngineResult["signal"]{ return r>5?"STRONG BUY":r>2?"BUY":r<-5?"STRONG SELL":r<-2?"SELL":"HOLD"; }

export function runEnsemble(args:{ bars:OHLCV[]; technical:EngineResult; horizon:Horizon; valuation?:ValuationInput; learned?:WeightInput; catalystWidening?:Array<{date:string; factor:number}>; paths?:number }):EnsembleResult{
  const {bars,technical}=args; const days=Math.max(1,technical.forecastPath.length); const current=bars.at(-1)?.close ?? 0;
  const returns:number[]=[]; for(let i=1;i<bars.length;i++){ const a=bars[i-1].close,b=bars[i].close; if(a>0&&b>0) returns.push(Math.log(b/a)); }
  const recent=returns.slice(-252); const mu=recent.reduce((a,b)=>a+b,0)/Math.max(1,recent.length);
  const variance=recent.reduce((s,v)=>s+(v-mu)**2,0)/Math.max(1,recent.length-1); const sigma=Math.sqrt(variance);
  const count=clamp(args.paths ?? 750,500,1000); const rand=rng(hash(`${bars.at(-1)?.date}|${args.horizon}|${current}`));
  const paths:number[][]=[]; const terminals:number[]=[];
  for(let p=0;p<count;p++){ let value=current; const path=[current]; for(let d=1;d<=days;d++){ value*=Math.exp((mu-.5*sigma*sigma)+sigma*normal(rand)); path.push(value); } paths.push(path); terminals.push(value); }
  const dates=tradingDates(bars.at(-1)?.date ?? new Date().toISOString().slice(0,10),days);
  const statisticalPath:number[]=[]; const rawFan=dates.map((date,i)=>{ const col=paths.map(p=>p[i+1]).sort((a,b)=>a-b); const med=quantile(col,.5); statisticalPath.push(med); return {date,median:med,low68:quantile(col,.16),high68:quantile(col,.84),low95:quantile(col,.025),high95:quantile(col,.975)}; });
  const valuation=args.valuation; const valuationOk=!!valuation&&valuation.currentMultiple!=null&&valuation.currentMultiple>0&&valuation.sectorMedian!=null&&valuation.sectorMedian>0&&valuation.sampleSize>=5;
  const valuationTarget=valuationOk&&valuation ? current*(1+clamp((valuation.sectorMedian/valuation.currentMultiple)-1,-.35,.35)*.35) : null;
  const techPath=technical.forecastPath.map(p=>p.price); const valPath=valuationTarget==null?[]:dates.map((_,i)=>current+(valuationTarget-current)*(i+1)/days);
  const baseLayers:LayerResult[]=[
    {key:"technical",label:"Technical",available:true,target:technical.targetPrice,call:technical.targetPrice>current*1.01?"UP":technical.targetPrice<current*.99?"DOWN":"FLAT",path:techPath,weight:0},
    {key:"statistical",label:"Statistical",available:bars.length>=90,reason:bars.length<90?`Needs 90 sessions; ${bars.length} available`:undefined,target:bars.length>=90?statisticalPath.at(-1)??null:null,call:bars.length>=90?(statisticalPath.at(-1)??current)>current*1.01?"UP":(statisticalPath.at(-1)??current)<current*.99?"DOWN":"FLAT":null,path:bars.length>=90?statisticalPath:[],weight:0},
    {key:"valuation",label:"Valuation",available:valuationOk,reason:valuationOk?undefined:valuation?`Needs current ${valuation.label} and at least 5 sector peers (${valuation.sampleSize} available)`:"Fundamentals are unavailable for this asset",target:valuationTarget,call:valuationTarget==null?null:valuationTarget>current*1.01?"UP":valuationTarget<current*.99?"DOWN":"FLAT",path:valPath,weight:0},
  ];
  const available=baseLayers.filter(l=>l.available); const learned=args.learned?.weights; let sum=available.reduce((s,l)=>s+(learned?.[l.key]??0),0);
  for(const l of baseLayers) l.weight=l.available?(sum>0?(learned?.[l.key]??0)/sum:1/available.length):0;
  const target=baseLayers.reduce((s,l)=>s+(l.target??current)*l.weight,0);
  const shift=target-(rawFan.at(-1)?.median??target); const fan=rawFan.map((f,i)=>{ const t=(i+1)/days; const widening=(args.catalystWidening??[]).reduce((m,e)=> e.date>=f.date?Math.max(m,e.factor):m,1); const center=f.median+shift*t; return {date:f.date,median:center,low68:center-(f.median-f.low68)*widening,high68:center+(f.high68-f.median)*widening,low95:center-(f.median-f.low95)*widening,high95:center+(f.high95-f.median)*widening}; });
  terminals.sort((a,b)=>a-b); const bearCut=fan.at(-1)?.low68??current, bullCut=fan.at(-1)?.high68??current; const raw=[terminals.filter(v=>v<bearCut).length/count*100,terminals.filter(v=>v>=bearCut&&v<=bullCut).length/count*100,terminals.filter(v=>v>bullCut).length/count*100]; const [bear,base,bull]=roundedProbabilities(raw);
  const scenarioTargets={bear:quantile(terminals,.16)+shift,base:quantile(terminals,.5)+shift,bull:quantile(terminals,.84)+shift};
  const scenarios=(['bear','base','bull'] as const).map((key)=>({key,probability:key==='bear'?bear:key==='base'?base:bull,target:scenarioTargets[key],contributions:Object.fromEntries(baseLayers.map(l=>[l.key,((l.target??current)-current)*l.weight])) as Record<LayerKey,number>}));
  return {layers:baseLayers,fan,target,signal:signalFromReturn((target/current-1)*100),probabilities:{bear,base,bull},scenarios,weightSource:args.learned?.source??"Equal weights — track record building",paths:count};
}
