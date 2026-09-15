import type { EngineResult, OHLCV } from "./engine12";
export interface Robustness { score:number; agreement:number; completeness:number; freshness:number; stability:number; regimeShift:boolean; currentVol:number; baselineVol:number; message:string }
const sd=(a:number[])=>{const m=a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/Math.max(1,a.length-1));};
export function computeRobustness(bars:OHLCV[],result:EngineResult,availableLayers:number,updatedAt:number):Robustness{
 const agreement=Math.max(result.buyCount,result.sellCount,result.holdCount)/Math.max(1,result.activeKeys.length)*100;
 const completeness=Math.min(100,bars.length/252*70+availableLayers/3*30); const ageHours=Math.max(0,(Date.now()-updatedAt)/36e5); const freshness=ageHours<=36?100:Math.max(0,100-(ageHours-36)*2);
 const rets:number[]=[];for(let i=1;i<bars.length;i++)rets.push(Math.log(bars[i].close/bars[i-1].close)); const vols:number[]=[];for(let i=20;i<rets.length;i++)vols.push(sd(rets.slice(i-20,i))*Math.sqrt(252));
 const currentVol=vols.at(-1)??0, prior=vols.slice(-110,-20); const mean=prior.reduce((s,v)=>s+v,0)/Math.max(1,prior.length), spread=sd(prior); const regimeShift=prior.length>=60&&currentVol>mean+2*spread; const stability=regimeShift?35:prior.length>=60?100:55;
 const score=Math.round(agreement*.3+completeness*.25+freshness*.2+stability*.25); return{score,agreement,completeness,freshness,stability,regimeShift,currentVol:currentVol*100,baselineVol:mean*100,message:regimeShift?"Volatility regime shift detected; confidence bands widened.":prior.length<60?"More history is needed for a stable regime test.":"Volatility is within its recent regime."};
}
