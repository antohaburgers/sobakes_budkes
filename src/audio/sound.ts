import { asset } from '../config/game';
export type SoundEvent={type:'impact'|'merge'|'supermerge';pair?:string};
export class MergeCadence {
  private count=0;
  accept(){return this.count++ % 2 === 0;}
}
export class SoundGate {
  last=-Infinity; pairs=new Map<string,number>();
  allow(event:SoundEvent, now:number){
    if(now-this.last<220)return false;
    if(event.type==='impact'&&event.pair&&now-(this.pairs.get(event.pair)??-Infinity)<700)return false;
    this.last=now;
    if(event.type==='impact'&&event.pair)this.pairs.set(event.pair,now);
    if(this.pairs.size>400)for(const [key,time]of this.pairs)if(now-time>2000)this.pairs.delete(key);
    return true;
  }
  reset(){this.last=-Infinity;this.pairs.clear();}
}
export const randomClip = <T>(clips:T[], random= Math.random):T|undefined => clips[Math.floor(random()*clips.length)];
export class SoundPlayer {
  muted=false; readyCount=0; context:AudioContext|null=null;
  private buffers:AudioBuffer[]=[];private master:GainNode|null=null;
  private voices:{source:AudioBufferSourceNode;gain:GainNode}[]=[];
  private gate=new SoundGate();private pending:{event:SoundEvent;time:number}|null=null;
  private loading:Promise<void>|null=null; private generation=0;
  private cadence=new MergeCadence();
  private music:HTMLAudioElement|null=null;private musicWanted=false;
  startMusic(){
    this.musicWanted=true;
    if(!this.music){this.music=new Audio(asset('assets/music/caf-serenade_90349.mp3'));this.music.loop=true;this.music.volume=.18;this.music.preload='auto';}
    if(!this.muted)void this.music.play().catch(()=>{});
  }
  constructor(){try{this.muted=localStorage.getItem('sobakes:muted')==='true';}catch{}}
  async unlock(){
    try{
      const Ctx=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
      if(!Ctx)return;
      if(!this.context){this.context=new Ctx();this.master=this.context.createGain();this.master.gain.value=.7;this.master.connect(this.context.destination);}
      await this.context.resume();
      if(this.musicWanted&&!this.muted&&this.music?.paused)void this.music.play().catch(()=>{});
      if(!this.loading)this.loading=this.load();
      await this.loading;
    }catch{/* Play remains available even if a browser blocks or cannot decode audio. */}
  }
  private async load(){
    try{
      const manifest=await fetch(asset('assets/sfx/manifest.json')).then(r=>{if(!r.ok)throw Error('sfx manifest');return r.json();});
      const result=await Promise.allSettled(manifest.clips.map(async(c:{file:string})=>{
        const response=await fetch(asset(`assets/sfx/${c.file}`));if(!response.ok)throw Error(c.file);
        return this.context!.decodeAudioData(await response.arrayBuffer());
      }));
      this.buffers=result.flatMap(r=>r.status==='fulfilled'?[r.value as AudioBuffer]:[]);this.readyCount=this.buffers.length;
    }catch{this.buffers=[];}
  }
  toggle(){
    const wanted=this.musicWanted;this.muted=!this.muted;this.stop();this.musicWanted=wanted;
    try{localStorage.setItem('sobakes:muted',String(this.muted));}catch{}
    if(!this.muted){void this.unlock();if(wanted)this.startMusic();}return this.muted;
  }
  event(event:SoundEvent,now=performance.now()){
    if(this.muted||!this.context||this.context.state!=='running'||!this.buffers.length)return;
    if(event.type!=='impact'&&!this.cadence.accept())return;
    if(this.voices.length>=2&&event.type==='impact')return;
    if(!this.gate.allow(event,now)){
      if(event.type!=='impact'&&(!this.pending||event.type==='supermerge'||this.pending.event.type!=='supermerge'))this.pending={event,time:now};return;
    }
    this.play(event);
  }
  update(now=performance.now()){
    const p=this.pending;if(!p)return;
    if(now-p.time>150){this.pending=null;return;}
    if(!this.muted&&this.gate.allow(p.event,now)){this.pending=null;this.play(p.event);}
  }
  private play(event:SoundEvent){
    if(!this.context||!this.master||this.muted)return;
    const buffer=randomClip(this.buffers);if(!buffer)return;
    const ctx=this.context, generation=this.generation;
    const start=()=>{
      if(this.muted||ctx.state!=='running'||generation!==this.generation)return;
      const source=ctx.createBufferSource();source.buffer=buffer;
      const gain=ctx.createGain();gain.gain.value=event.type==='impact'?.28:.45;
      source.connect(gain);gain.connect(this.master!);const voice={source,gain};this.voices.push(voice);
      source.onended=()=>{this.voices=this.voices.filter(v=>v!==voice);source.disconnect();gain.disconnect();};source.start();
    };
    if(this.voices.length>=2){
      const oldest=this.voices.shift()!;oldest.source.onended=null;
      oldest.gain.gain.setTargetAtTime(0,ctx.currentTime,.012);oldest.source.stop(ctx.currentTime+.04);
      oldest.source.onended=()=>{oldest.source.disconnect();oldest.gain.disconnect();start();};
    }else start();
  }
  stop(){this.musicWanted=false;this.music?.pause();this.generation++;this.pending=null;this.gate.reset();for(const v of this.voices){v.source.onended=null;try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();}this.voices=[];}
}
