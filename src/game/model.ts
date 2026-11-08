import Matter from 'matter-js';
import { FIELD, RULES } from '../config/game';
import { levelData, pickLevel, mergePoints } from '../config/levels';
const { Bodies, Body, Composite, Engine, Events, Vertices, Query } = Matter;
export type Dog = {id: number; level: number; body: Matter.Body; scale: number; offset: {x:number;y:number}; born: number; eligible: boolean; merging: boolean};
export type GameEvent = {type: 'merge'|'supermerge'|'impact'|'gameover'|'drop'; x: number; y: number; points?:number; level?:number; pair?:string; speed?:number};
export type State = 'ready'|'playing'|'paused'|'gameover';
export class DangerTimer {
  elapsed = 0;
  update(danger: boolean, dt: number) { this.elapsed = danger ? this.elapsed + dt : 0; return this.elapsed >= RULES.dangerTime; }
  reset() { this.elapsed=0; }
}
export function makeDog(level: number): {body:Matter.Body; scale:number; offset:{x:number;y:number}} {
  const data = levelData(level);
  const rawArea = data.vertices.reduce((sum,poly) => sum + Math.abs(Vertices.area(poly as Matter.Vector[], false)),0);
  const scale = Math.sqrt((Math.PI * (data.diameter/2)**2) / rawArea);
  const parts = data.vertices.map(poly => {
    const vertices = poly.map(v => ({x:v.x*scale,y:v.y*scale}));
    const centre = Vertices.centre(vertices as Matter.Vertex[]);
    return Bodies.fromVertices(centre.x,centre.y,[vertices], {friction:.35, frictionStatic:.5,restitution:.08,frictionAir:.01, slop:.035}, true);
  });
  const body = Body.create({parts, friction:.35,frictionStatic:.5,restitution:.08,frictionAir:.01, sleepThreshold:90});
  const offset={x:512*scale-body.position.x,y:512*scale-body.position.y};
  return {body,scale,offset};
}
const extents=new Map<number,{left:number;right:number}>();
export class GameModel {
  engine = Engine.create({enableSleeping:true, positionIterations:10,velocityIterations:8});
  dogs = new Map<number,Dog>();
  state:State='ready'; score=0; highest=1; current=1; next=1; clock=0; merges=0;
  danger=new DangerTimer();
  private accumulator=0; private serial=1; private lastDrop:number|null=null; private dropTime=-Infinity; private contacted=false;
  private startedContacts: {a:Matter.Body;b:Matter.Body;speed:number}[]=[];
  private velocities=new Map<number,Matter.Vector>();
  private newBodies:number[]=[];
  private random:()=>number;
  onEvent:(event:GameEvent)=>void=()=>{};
  constructor(random:()=>number=Math.random) {
    this.random=random;
    this.engine.gravity.y=1;
    Composite.add(this.engine.world,[
      Bodies.rectangle(FIELD.left-20,FIELD.floor/2,40,FIELD.floor+400,{isStatic:true,label:'left'}),
      Bodies.rectangle(FIELD.right+20,FIELD.floor/2,40,FIELD.floor+400,{isStatic:true,label:'right'}),
      Bodies.rectangle(210,FIELD.floor+24,440,48,{isStatic:true,label:'floor'})
    ]);
    Events.on(this.engine,'collisionStart',(event)=>{
      for(const p of event.pairs){
        const a=p.bodyA.parent,b=p.bodyB.parent;
        const va=this.velocities.get(a.id)??a.velocity, vb=this.velocities.get(b.id)??b.velocity;
        const speed=Math.abs((va.x-vb.x)*p.collision.normal.x+(va.y-vb.y)*p.collision.normal.y);
        this.startedContacts.push({a,b,speed});
      }
    });
  }
  reset() {
    for(const dog of this.dogs.values()) Composite.remove(this.engine.world,dog.body);
    this.dogs.clear(); Engine.clear(this.engine);
    this.score=0;this.highest=1;this.merges=0;this.clock=0;this.accumulator=0;this.lastDrop=null;this.dropTime=-Infinity;this.contacted=false;
    this.newBodies=[];this.startedContacts=[];this.velocities.clear();this.danger.reset();this.current=pickLevel(this.random);this.next=pickLevel(this.random);this.state='playing';
  }
  get canDrop() {return this.state==='playing' && (this.lastDrop===null || ((this.contacted&&this.clock-this.dropTime>=RULES.dropCooldown)||this.clock-this.dropTime>=RULES.dropTimeout));}
  clampX(x:number, level=this.current) {
    let size=extents.get(level);
    if(!size){const shape=makeDog(level);size={left:shape.body.position.x-shape.body.bounds.min.x,right:shape.body.bounds.max.x-shape.body.position.x};extents.set(level,size);}
    return Math.max(FIELD.left+size.left+1,Math.min(FIELD.right-size.right-1,x));
  }
  addDog(level:number,x:number,y:number,eligible=false) {
    const made=makeDog(level); const dog:Dog={...made,id:this.serial++,level,born:this.clock,eligible,merging:false};
    made.body.label=`dog:${dog.id}`; made.body.plugin={dogId:dog.id};
    Body.setPosition(made.body,{x,y}); this.fit(made.body);
    this.dogs.set(dog.id,dog);Composite.add(this.engine.world,made.body);this.newBodies.push(dog.id);return dog;
  }
  drop(x:number) {
    if(!this.canDrop)return false;
    const probe=makeDog(this.current); const heightAbove=probe.body.position.y-probe.body.bounds.min.y;
    const dog=this.addDog(this.current,this.clampX(x),FIELD.top+heightAbove);
    this.lastDrop=dog.id;this.dropTime=this.clock;this.contacted=false;
    this.highest=Math.max(this.highest,this.current);
    this.current=this.next;this.next=pickLevel(this.random);
    this.onEvent({type:'drop',x:dog.body.position.x,y:dog.body.position.y,level:dog.level});return true;
  }
  pause(){if(this.state==='playing'){this.state='paused';this.accumulator=0;}}
  resume(){if(this.state==='paused'){this.state='playing';this.accumulator=0;}}
  advance(delta:number){
    if(this.state!=='playing')return;
    this.accumulator+=Math.min(delta,80);
    while(this.accumulator>=RULES.step && this.state==='playing'){this.step();this.accumulator-=RULES.step;}
  }
  step(){
    if(this.state!=='playing')return;
    this.clock+=RULES.step;this.velocities.clear();this.startedContacts=[];
    for(const d of this.dogs.values())this.velocities.set(d.body.id,{...d.body.velocity});
    Engine.update(this.engine,RULES.step);
    const contacts=new Map<string,{a:Matter.Body;b:Matter.Body;speed:number;started:boolean}>();
    const add=(a:Matter.Body,b:Matter.Body,speed=0,started=false)=>{
      a=a.parent;b=b.parent;if(a.id===b.id)return;
      const key=[a.id,b.id].sort((x,y)=>x-y).join(':');const old=contacts.get(key);
      contacts.set(key,{a,b,speed:Math.max(old?.speed??0,speed),started:started||!!old?.started});
    };
    for(const p of this.engine.pairs.list)if(p.isActive)add(p.bodyA,p.bodyB);
    for(const c of this.startedContacts)add(c.a,c.b,c.speed,true);
    const dynamic=[...this.dogs.values()].map(d=>d.body);
    for(const id of this.newBodies){const d=this.dogs.get(id);if(d)for(const c of Query.collides(d.body,dynamic.filter(b=>b!==d.body)))add(c.bodyA,c.bodyB);}
    this.newBodies=[];
    const get=(b:Matter.Body)=>this.dogs.get(b.plugin?.dogId);
    const candidates=[...contacts.values()].sort((p,q)=>Math.min(p.a.id,p.b.id)-Math.min(q.a.id,q.b.id)||Math.max(p.a.id,p.b.id)-Math.max(q.a.id,q.b.id));
    const pairs:[Dog,Dog][]=[];
    for(const c of candidates){
      const a=get(c.a),b=get(c.b);
      if((a?.id===this.lastDrop||b?.id===this.lastDrop))this.contacted=true;
      if(a&&b&&a.level===b.level&&!a.merging&&!b.merging){a.merging=true;b.merging=true;pairs.push([a,b]);}
    }
    const consumed=new Set(pairs.flatMap(pair=>pair.map(d=>d.id)));
    // Emit confirmed merges first; impact sounds from consumed bodies are suppressed.
    for(const [a,b]of pairs.sort((p,q)=>q[0].level-p[0].level))this.merge(a,b);
    const impacts=candidates.filter(c=>c.started&&c.speed>=1.5).sort((a,b)=>b.speed-a.speed);
    for(const c of impacts){const a=get(c.a),b=get(c.b);if((a&&consumed.has(a.id))||(b&&consumed.has(b.id))||(!a&&!b))continue;
      // A removed dog is no longer in the map: also inspect its original ID.
      if(consumed.has(c.a.plugin?.dogId)||consumed.has(c.b.plugin?.dogId))continue;
      const p=a?.body.position??b!.body.position;
      this.onEvent({type:'impact',x:p.x,y:p.y,pair:[c.a.id,c.b.id].sort((x,y)=>x-y).join(':'),speed:c.speed});
    }
    let danger=false;
    for(const d of this.dogs.values()){
      if(d.body.bounds.min.y>=FIELD.danger)d.eligible=true;
      if(!d.eligible&&this.clock-d.born>=RULES.dropTimeout)d.eligible=true;
      if(d.eligible&&d.body.bounds.min.y<FIELD.danger)danger=true;
      const v=d.body.velocity;if(Math.hypot(v.x,v.y)>16)Body.setVelocity(d.body,{x:Math.max(-10,Math.min(10,v.x)),y:Math.max(-14,Math.min(14,v.y))});
      if(Math.abs(d.body.angularVelocity)>.18)Body.setAngularVelocity(d.body,Math.sign(d.body.angularVelocity)*.18);
      if(d.body.bounds.max.y>FIELD.floor+10||d.body.bounds.min.x<FIELD.left-10||d.body.bounds.max.x>FIELD.right+10)this.fit(d.body);
    }
    if(this.danger.update(danger,RULES.step)){this.state='gameover';this.onEvent({type:'gameover',x:210,y:FIELD.danger});}
  }
  private fit(body:Matter.Body){
    let dx=0,dy=0;if(body.bounds.min.x<FIELD.left+1)dx=FIELD.left+1-body.bounds.min.x;
    if(body.bounds.max.x+dx>FIELD.right-1)dx+=FIELD.right-1-(body.bounds.max.x+dx);
    if(body.bounds.max.y>FIELD.floor)dy=FIELD.floor-body.bounds.max.y;
    if(dx||dy)Body.translate(body,{x:dx,y:dy});
  }
  private merge(a:Dog,b:Dog){
    if(!this.dogs.has(a.id)||!this.dogs.has(b.id))return;
    const x=(a.body.position.x+b.body.position.x)/2,y=(a.body.position.y+b.body.position.y)/2;
    const mass=a.body.mass+b.body.mass;
    const velocity={x:(a.body.velocity.x*a.body.mass+b.body.velocity.x*b.body.mass)/mass,y:(a.body.velocity.y*a.body.mass+b.body.velocity.y*b.body.mass)/mass};
    for(const d of [a,b]){Composite.remove(this.engine.world,d.body);this.dogs.delete(d.id);}
    const points=mergePoints(a.level);this.score+=points;this.merges++;
    if(a.level<11){const d=this.addDog(a.level+1,x,y,a.eligible||b.eligible);
      Body.setAngle(d.body,(a.body.angle+b.body.angle)/2);this.fit(d.body);
      Body.setVelocity(d.body,{x:Math.max(-3,Math.min(3,velocity.x)),y:Math.max(-3,Math.min(3,velocity.y))});
      this.highest=Math.max(this.highest,d.level);
    }
    this.onEvent({type:a.level===11?'supermerge':'merge',x,y,points,level:a.level+1});
  }
  destroy(){Composite.clear(this.engine.world,false);Engine.clear(this.engine);Events.off(this.engine,'collisionStart');}
}
