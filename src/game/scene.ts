import Phaser from 'phaser';
import { FIELD, RULES,asset } from '../config/game';
import { LEVELS } from '../config/levels';
import { GameModel,makeDog,type GameEvent } from './model';
export class DogScene extends Phaser.Scene {
  model:GameModel; onReady:()=>void; onTick:()=>void; onEffect:(e:GameEvent)=>void;
  private sprites=new Map<number,Phaser.GameObjects.Image>();
  private ghost!:Phaser.GameObjects.Image; private guide!:Phaser.GameObjects.Graphics;private debug!:Phaser.GameObjects.Graphics;
  private dangerLine!:Phaser.GameObjects.Graphics;
  private aim=210;private ghostLevel=0;private metrics:ReturnType<typeof makeDog>|null=null;
  private activePointer:number|null=null;private ready=false;private debugEnabled=new URLSearchParams(location.search).has('debug');
  constructor(model:GameModel,onReady:()=>void,onTick:()=>void,onEffect:(e:GameEvent)=>void){
    super('dogs');this.model=model;this.onReady=onReady;this.onTick=onTick;this.onEffect=onEffect;
  }
  preload(){
    this.load.on('progress',(p:number)=>{const el=document.querySelector('#load-progress');if(el)el.textContent=`Собираем стаю… ${Math.round(p*100)}%`;});
    this.load.on('loaderror',()=>{document.querySelector('#load-progress')!.textContent='Не получилось загрузить цвергов. Обнови страницу.';});
    for(const d of LEVELS)this.load.image(`dog${d.level}`,asset(`assets/dogs/${d.file}`));
  }
  create(){
    if(LEVELS.some(d=>!this.textures.exists(`dog${d.level}`)))return;
    this.drawRoom();this.dangerLine=this.add.graphics().setDepth(20);this.guide=this.add.graphics().setDepth(2);this.debug=this.add.graphics().setDepth(30);
    this.ghost=this.add.image(210,50,'dog1').setAlpha(.72).setDepth(5);
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{if(this.model.state!=='playing'||this.activePointer!==null)return;this.activePointer=p.id;this.aim=this.model.clampX(p.x);});
    this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{if(this.model.state==='playing'&&(this.activePointer===null||p.id===this.activePointer))this.aim=this.model.clampX(p.x);});
    this.input.on('pointerup',(p:Phaser.Input.Pointer)=>{if(this.activePointer!==p.id)return;this.activePointer=null;this.aim=this.model.clampX(p.x);this.model.drop(this.aim);});
    this.input.on('pointerupoutside',(p:Phaser.Input.Pointer)=>{if(this.activePointer===p.id)this.activePointer=null;});
    this.game.canvas.addEventListener('pointerdown',e=>{try{this.game.canvas.setPointerCapture(e.pointerId);}catch{}});
    this.game.canvas.addEventListener('pointercancel',()=>{this.activePointer=null;});
    this.input.keyboard?.on('keydown-D',()=>{this.debugEnabled=!this.debugEnabled;});
    this.input.keyboard?.on('keydown-LEFT',()=>{this.aim=this.model.clampX(this.aim-14);});
    this.input.keyboard?.on('keydown-RIGHT',()=>{this.aim=this.model.clampX(this.aim+14);});
    this.input.keyboard?.on('keydown-SPACE',(event:KeyboardEvent)=>{if((event.target as HTMLElement)?.closest?.('button,a,input,select,textarea'))return;event.preventDefault();if(!event.repeat)this.model.drop(this.aim);});
    this.model.onEvent=e=>{if(e.type==='merge'||e.type==='supermerge')this.effect(e);this.onEffect(e);};
    this.ready=true;this.onReady();
  }
  private drawRoom(){
    const g=this.add.graphics();
    g.fillStyle(0xf9f6ee);g.fillRoundedRect(0,0,420,650,20);
    // Gentle wallpaper and a wooden toy box, drawn around the physics field.
    for(let x=14;x<420;x+=28)for(let y=15;y<610;y+=28){g.fillStyle(0x718974,.07);g.fillCircle(x,y,1.2);}
    g.fillStyle(0xe9e1ce);g.fillRect(12,615,396,35);
    g.fillStyle(0xcaa984);g.fillRoundedRect(14,88,16,536,7);g.fillRoundedRect(390,88,16,536,7);
    g.fillStyle(0xe2c3a0);g.fillRoundedRect(10,84,22,14,5);g.fillRoundedRect(388,84,22,14,5);
    g.fillStyle(0xcaa984);g.fillRoundedRect(14,609,392,24,8);
    g.fillStyle(0xd9bb95);g.fillRoundedRect(19,613,382,10,4);
    g.lineStyle(1,0x9d7b54,.22);g.lineBetween(42,615,42,630);g.lineBetween(375,614,375,630);
    for(const x of [23,397]){g.fillStyle(0x886d50,.5);g.fillCircle(x,104,2);g.fillCircle(x,598,2);}
    this.add.text(210,634,'ОСТОРОЖНО, ЦВЕРГИ!',{fontFamily:'sans-serif',fontSize:'9px',color:'#8b795e',letterSpacing:2}).setOrigin(.5);
  }
  update(_time:number,delta:number){
    if(!this.ready)return;
    this.model.advance(delta);
    const ids=new Set(this.model.dogs.keys());for(const[id,sprite]of this.sprites)if(!ids.has(id)){sprite.destroy();this.sprites.delete(id);}
    for(const d of this.model.dogs.values()){
      let sprite=this.sprites.get(d.id);
      if(!sprite){sprite=this.add.image(0,0,`dog${d.level}`).setDepth(6);this.sprites.set(d.id,sprite);}
      const angle=d.body.angle,c=Math.cos(angle),s=Math.sin(angle);
      sprite.setPosition(d.body.position.x+c*d.offset.x-s*d.offset.y,d.body.position.y+s*d.offset.x+c*d.offset.y).setRotation(angle);
      const pop=1+.10*Math.max(0,1-(this.model.clock-d.born)/140);
      sprite.setScale(d.scale*pop);
    }
    if(this.ghostLevel!==this.model.current){this.ghostLevel=this.model.current;this.metrics=makeDog(this.ghostLevel);this.ghost.setTexture(`dog${this.ghostLevel}`).setScale(this.metrics.scale);this.aim=this.model.clampX(this.aim);}
    const visible=this.model.state==='playing';this.ghost.setVisible(visible);this.guide.clear();
    if(visible&&this.metrics){const m=this.metrics;const y=FIELD.top+(m.body.position.y-m.body.bounds.min.y);this.ghost.setPosition(this.aim+m.offset.x,y+m.offset.y).setAlpha(this.model.canDrop?.7:.24);
      if(this.model.canDrop){this.guide.lineStyle(1,0x6f8670,.24);for(let y0=80;y0<FIELD.floor;y0+=14)this.guide.lineBetween(this.aim,y0,this.aim,y0+5);}
    }
    this.dangerLine.clear();const danger=this.model.danger.elapsed>0;
    this.dangerLine.lineStyle(danger?2:1.2,danger?0xc04d39:0xae9a7a,danger?.8:.5);
    for(let x=FIELD.left+10;x<FIELD.right-8;x+=15)this.dangerLine.lineBetween(x,FIELD.danger,x+7,FIELD.danger);
    this.debug.clear();if(this.debugEnabled){for(const d of this.model.dogs.values()){
      this.debug.lineStyle(1,0xe65041,.9);for(const part of d.body.parts.slice(1)){this.debug.strokePoints(part.vertices.map(v=>new Phaser.Geom.Point(v.x,v.y)),true);}
      this.debug.fillStyle(0x0055ff);this.debug.fillCircle(d.body.position.x,d.body.position.y,2);
    }}
    this.onTick();
  }
  private effect(e:GameEvent){
    const color=e.type==='supermerge'?0xe68141:0x6b8b67;
    const text=this.add.text(e.x,e.y,e.type==='supermerge'?'СУПЕРГАВ!':`+${e.points}`,{fontFamily:'sans-serif',fontStyle:'bold',fontSize:e.type==='supermerge'?'25px':'20px',color:e.type==='supermerge'?'#c85f2c':'#345c43',stroke:'#faf5eb',strokeThickness:4}).setOrigin(.5).setDepth(40);
    this.tweens.add({targets:text,y:e.y-52,alpha:0,duration:850,ease:'Cubic.Out',onComplete:()=>text.destroy()});
    for(let i=0;i<(e.type==='supermerge'?24:8);i++){
      const p=this.add.circle(e.x,e.y,2+Math.random()*2,color,.85).setDepth(25);
      this.tweens.add({targets:p,x:e.x+(Math.random()-.5)*90,y:e.y+(Math.random()-.65)*80,alpha:0,scale:0,duration:400+Math.random()*250,onComplete:()=>p.destroy()});
    }
  }
  cancelPointer(){this.activePointer=null;}
}
