import Phaser from 'phaser';
import { FIELD, RULES,asset } from '../config/game';
import { LEVELS } from '../config/levels';
import { GameModel,makeDog,type GameEvent } from './model';
export class DogScene extends Phaser.Scene {
  model:GameModel; onReady:()=>void; onTick:()=>void; onEffect:(e:GameEvent)=>void;
  private sprites=new Map<number,Phaser.GameObjects.Image>();
  private ghost!:Phaser.GameObjects.Image; private guide!:Phaser.GameObjects.Graphics;private debug!:Phaser.GameObjects.Graphics;
  private dangerLine!:Phaser.GameObjects.Graphics;
  private aim=FIELD.width/2;private ghostLevel=0;private metrics:ReturnType<typeof makeDog>|null=null;
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
    this.ghost=this.add.image(FIELD.width/2,40,'dog1').setAlpha(.72).setDepth(5);
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
    const {width,height,left,right,floor,danger}=FIELD;
    g.fillStyle(0xf9f6ee);g.fillRoundedRect(0,0,width,height,14);
    for(let x=14;x<width;x+=28)for(let y=15;y<floor;y+=28){g.fillStyle(0x718974,.06);g.fillCircle(x,y,1.2);}
    const wallTop=danger-16;
    g.fillStyle(0xcaa984);g.fillRoundedRect(left-15,wallTop,15,floor-wallTop+18,5);g.fillRoundedRect(right,wallTop,15,floor-wallTop+18,5);
    g.fillStyle(0xe2c3a0);g.fillRoundedRect(left-18,wallTop-3,21,11,4);g.fillRoundedRect(right-3,wallTop-3,21,11,4);
    g.fillStyle(0xcaa984);g.fillRoundedRect(left-15,floor,right-left+30,18,6);
    g.fillStyle(0xd9bb95);g.fillRoundedRect(left-10,floor+3,right-left+20,8,3);
    for(const x of [left-7,right+7]){g.fillStyle(0x886d50,.45);g.fillCircle(x,wallTop+18,1.8);g.fillCircle(x,floor-12,1.8);}
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
