import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameModel,makeDog,DangerTimer} from '../src/game/model';
import {pickLevel,mergePoints} from '../src/config/levels';
import {SoundGate,randomClip} from '../src/audio/sound';
import {FIELD} from '../src/config/game';
test('spawn weights cover levels 1–4 at precise boundaries',()=>{
 assert.deepEqual([0,.3499,.35,.6499,.65,.8499,.85,.9999].map(n=>pickLevel(()=>n)),[1,1,2,2,3,3,4,4]);
});
test('each compound collider has increasing physical area and fits the box',()=>{
 let previous=0;
 for(let level=1;level<=11;level++){
  const {body}=makeDog(level);assert.ok(body.parts.length>=4);assert.ok(body.area>previous);previous=body.area;
  assert.ok(body.bounds.max.x-body.bounds.min.x<FIELD.right-FIELD.left);
 }
});
test('drop promotes preview exactly once and ignores fast duplicate input',()=>{
 const seq=[0,.9,.5];let i=0;const m=new GameModel(()=>seq[i++%seq.length]);m.reset();
 assert.equal(m.current,1);assert.equal(m.next,4);assert.ok(m.drop(200));assert.equal(m.current,4);assert.equal(m.next,2);
 assert.equal(m.drop(250),false);assert.equal(m.dogs.size,1);assert.equal(m.score,0);m.destroy();
});
test('triple contact consumes only one pair and counts +4 once',()=>{
 const m=new GameModel();m.reset();const events:string[]=[];m.onEvent=e=>events.push(e.type);
 for(let i=0;i<3;i++)m.addDog(1,200+i,550,true);
 m.step();assert.equal(m.score,4);assert.equal(m.dogs.size,2);assert.equal(m.merges,1);
 assert.deepEqual([...m.dogs.values()].map(d=>d.level).sort(),[1,2]);assert.equal(events.filter(e=>e==='merge').length,1);m.destroy();
});
test('new result merges with a stationary equal neighbour on subsequent steps',()=>{
 const m=new GameModel();m.reset();m.addDog(1,195,550,true);m.addDog(1,196,550,true);m.addDog(2,216,550,true);
 for(let i=0;i<12;i++)m.step();assert.equal(m.score,12);assert.equal(m.dogs.size,1);assert.equal([...m.dogs.values()][0].level,3);m.destroy();
});
test('two final levels disappear for +4096 without creating level 12',()=>{
 const m=new GameModel();m.reset();m.addDog(11,210,500,true);m.addDog(11,211,500,true);m.step();
 assert.equal(m.score,4096);assert.equal(m.dogs.size,0);assert.equal(mergePoints(11),4096);m.destroy();
});
test('pause freezes the danger timer and physics; clear field resets danger',()=>{
 const timer=new DangerTimer();assert.equal(timer.update(true,1900),false);assert.equal(timer.update(false,16),false);assert.equal(timer.elapsed,0);assert.equal(timer.update(true,2000),true);
 const m=new GameModel();m.reset();m.addDog(1,200,80,true);m.step();const elapsed=m.danger.elapsed,clock=m.clock;m.pause();m.advance(2000);assert.equal(m.clock,clock);assert.equal(m.danger.elapsed,elapsed);m.destroy();
});
test('merge results inherit overflow eligibility without resetting global danger',()=>{
 const m=new GameModel();m.reset();m.danger.elapsed=1800;m.addDog(1,200,75,true);m.addDog(1,201,75,true);m.step();
 assert.ok([...m.dogs.values()][0].eligible);assert.ok(m.danger.elapsed>1800);m.destroy();
});
test('falling bodies stay above the floor and inside the walls',()=>{
 const m=new GameModel();m.reset();for(let level=1;level<=11;level++)m.addDog(level,60+level*25,150+level*20,true);
 for(let i=0;i<360;i++){if(m.state!=='playing')break;m.step();}
 for(const d of m.dogs.values()){assert.ok(d.body.bounds.max.y<=FIELD.floor+2);assert.ok(d.body.bounds.min.x>=FIELD.left-2);assert.ok(d.body.bounds.max.x<=FIELD.right+2);}m.destroy();
});
test('audio limits and parent-pair cooldown work without affecting random pool size',()=>{
 const g=new SoundGate();assert.ok(g.allow({type:'impact',pair:'1:2'},0));assert.equal(g.allow({type:'merge'},219),false);
 assert.equal(g.allow({type:'impact',pair:'1:2'},250),false);assert.ok(g.allow({type:'impact',pair:'1:3'},250));assert.ok(g.allow({type:'impact',pair:'1:2'},701));
 const clips=Array.from({length:11},(_,i)=>i);assert.deepEqual(clips.map((_,i)=>randomClip(clips,()=>(i+.5)/11)),clips);assert.equal(randomClip([],()=>0),undefined);
});
test('blocked entrance eventually ends the round instead of exempting fresh dogs forever',async()=>{
 const Matter=(await import('matter-js')).default;
 const m=new GameModel();m.reset();const dog=m.addDog(1,210,70,false);Matter.Body.setStatic(dog.body,true);
 for(let i=0;i<215;i++)m.step();assert.equal(m.state,'gameover');m.destroy();
});
test('restart clears scores, merging queue and overflow after gameover',()=>{
 const m=new GameModel();m.reset();m.addDog(1,200,550,true);m.addDog(1,201,550,true);m.step();assert.equal(m.score,4);
 m.state='gameover';m.danger.elapsed=2000;m.reset();assert.equal(m.dogs.size,0);assert.equal(m.score,0);assert.equal(m.danger.elapsed,0);assert.equal(m.state,'playing');assert.ok(m.canDrop);m.destroy();
});
test('long mixed-shape session remains finite without leaking bodies outside the box',()=>{
 let seed=37;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};const m=new GameModel(random);m.reset();
 for(let i=0;i<5000&&m.state==='playing';i++){if(m.canDrop)m.drop(50+random()*320);m.step();}
 assert.ok(m.merges>5);assert.ok(m.dogs.size<120);
 for(const d of m.dogs.values()){assert.ok(Number.isFinite(d.body.position.x+d.body.position.y+d.body.angle));assert.ok(d.body.bounds.max.y<=FIELD.floor+2);}m.destroy();
});
test('merge audio cadence accepts exactly half of merge events',async()=>{
 const {MergeCadence}=await import('../src/audio/sound');const cadence=new MergeCadence();
 assert.deepEqual(Array.from({length:8},()=>cadence.accept()),[true,false,true,false,true,false,true,false]);
});
