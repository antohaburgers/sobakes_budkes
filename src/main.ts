import Phaser from 'phaser';
import './style.css';
import { FIELD,asset } from './config/game';
import { LEVELS } from './config/levels';
import { GameModel, type GameEvent } from './game/model';
import { DogScene } from './game/scene';
import { SoundPlayer } from './audio/sound';
const paw='<svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true"><ellipse cx="24" cy="32" rx="12" ry="10"/><ellipse cx="10" cy="17" rx="5" ry="7" transform="rotate(-25 10 17)"/><ellipse cx="21" cy="11" rx="5" ry="7"/><ellipse cx="33" cy="13" rx="5" ry="7"/><ellipse cx="41" cy="23" rx="5" ry="7" transform="rotate(25 41 23)"/></svg>';
const icons={sound:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M11 4 5 9H2v6h3l6 5V4Z"/><path d="M15 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/></svg>',muted:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M11 4 5 9H2v6h3l6 5V4Z"/><path d="m16 9 6 6m0-6-6 6"/></svg>',pause:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14M16 5v14"/></svg>'};
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<header class="site-header"><a class="brand" href="./" aria-label="Собакес Будкес — главная"><span class="brand-paw">${paw}</span><span>СОБАКЕС<span class="brand-line">БУДКЕС<span class="brand-dot">®</span></span></span></a><span class="header-note"><i></i> РАЗРЕШАЕТСЯ ГАВКАТЬ</span><button id="help" class="help-button" aria-label="Как играть">?</button></header>
<main class="layout">
<section class="game-column" aria-label="Игровое поле">
<div class="topline"><span class="eyebrow">ЦВЕРГИ ПАДАЮТ. РЕКОРДЫ РАСТУТ.</span><span class="edition">VOL. 01</span></div>
<div class="hud"><div class="score-group"><span class="stat-label">ТВОИ ОЧКИ</span><strong id="score">0</strong></div><div class="record-group"><span class="stat-label">ЛИЧНЫЙ РЕКОРД <span class="tiny-star">✦</span></span><strong id="best">0</strong></div><div class="hud-actions"><button id="sound" class="icon-button" aria-label="Выключить звук" title="Звук">${icons.sound}</button><button id="pause" class="icon-button" aria-label="Пауза" title="Пауза">${icons.pause}</button></div></div>
<div class="stage-shell"><div id="game"></div><div id="danger" class="danger-warning" hidden>Коробка полна! <span id="danger-count"></span></div>
<div class="mobile-next"><span>ДАЛЬШЕ</span><img id="next-mobile" alt="Следующая собака"></div>
<div id="overlay" class="overlay" role="dialog" aria-modal="true" aria-labelledby="overlay-title">
<div class="welcome-stamp">ВСЕ ПСЫ ХОРОШИ. ЭТИ — ОСОБЕННО.</div><div class="hero-art"><div class="hero-circle"></div><img src="${asset('assets/dogs/schnauzer_11.webp')}" alt="Весёлый Суперцверг"/><span class="hero-spark spark-one">✦</span><span class="hero-spark spark-two">✳</span><span class="hero-tag">очень хороший мальчик</span></div>
<h1 id="overlay-title">Маленькие псы.<br><em>Большой переполох.</em></h1><p class="overlay-copy">Роняй цвергов. Соединяй одинаковых.<br>И попробуй уместить всю эту банду.</p><button id="play" class="primary-button" disabled>Собираем стаю…</button><p id="load-progress" class="micro-copy">Собираем стаю…</p>
</div>
<div id="pause-overlay" class="overlay simple-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden><div class="modal-paw">${paw}</div><span class="eyebrow">ПЕРЕРЫВ НА ПОЧЕСАТЬ ЗА УХОМ</span><h2 id="pause-title">Стая отдыхает.</h2><p>Цверги никуда не убегут.</p><button id="resume" class="primary-button">Продолжить <span>↗</span></button><button id="restart" class="text-button">Начать заново</button></div>
<div id="confirm-overlay" class="overlay simple-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title" hidden><div class="modal-paw">${paw}</div><h2 id="confirm-title">Начнём с чистой коробки?</h2><p>Очки этой партии сбросятся.<br>Рекорд останется с тобой.</p><button id="confirm-restart" class="primary-button">Да, новую партию</button><button id="cancel-restart" class="text-button">Оставить моих цвергов</button></div>
<div id="end-overlay" class="overlay simple-overlay" role="dialog" aria-modal="true" aria-labelledby="end-title" hidden><div class="end-art"><img src="${asset('assets/dogs/schnauzer_03.webp')}" alt="Озадаченный цверг"></div><span id="end-label" class="eyebrow">СТАЯ В СБОРЕ</span><h2 id="end-title">Больше не влезает!</h2><p>Ничего, в следующей коробке<br>обязательно поместятся.</p><strong id="final-score" class="final-score">0</strong><span class="stat-label">ОЧКОВ ЗА ЭТУ ПАРТИЮ</span><button id="again" class="primary-button">Ещё одну коробку <span>↗</span></button></div>
<div id="help-overlay" class="overlay simple-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title" hidden><span class="eyebrow">ВСЁ ПРОСТО. ПОЧТИ.</span><h2 id="help-title">Как укротить стаю</h2><ol class="instructions"><li><b>Прицелься.</b> Двигай пальцем или мышью над коробкой.</li><li><b>Отпусти.</b> Цверг упадёт вниз. Две одинаковые собаки соединятся в следующую.</li><li><b>Укладывай.</b> Не держи кучу выше пунктирной линии дольше двух секунд.</li><li><b>Собери Супергав!</b> Два Суперцверга исчезнут и дадут +4096.</li></ol><button id="close-help" class="primary-button">Понятно, погнали</button><p class="micro-copy">На компьютере: ← → и пробел. Esc — пауза.</p></div>
</div>
<div class="under-game"><span id="game-hint"><span class="hint-dot"></span> Хорошие мальчики готовы к падению</span><span>СДЕЛАНО С ГАВ</span></div>
</section>
<aside class="sidebar"><section class="next-card"><div class="card-heading"><span class="eyebrow">КТО СЛЕДУЮЩИЙ</span><span>↙</span></div><div class="next-art"><img id="next" src="${asset('assets/dogs/schnauzer_01.webp')}" alt="Следующая собака"/><span class="next-oval"></span></div><strong id="next-name">Цверг-малыш</strong><p id="next-description">Мал, да удивлён.</p><span id="next-level" class="level-pill">УРОВЕНЬ 01</span></section>
<section class="rule-card"><span class="eyebrow">ПРОСТАЯ СОБАЧЬЯ МАТЕМАТИКА</span><div class="dog-equation"><img src="${asset('assets/dogs/schnauzer_01.webp')}" alt="Малыш"/><span>+</span><img src="${asset('assets/dogs/schnauzer_01.webp')}" alt="Малыш"/><span>=</span><img src="${asset('assets/dogs/schnauzer_02.webp')}" alt="Шкодник"/></div><p>Два одинаковых цверга —<br><b>один покрупнее.</b></p></section>
<section class="pack-card"><div class="card-heading"><span class="eyebrow">ТВОЯ БУДУЩАЯ СТАЯ</span><span id="pack-count">1 / 11</span></div><div class="pack-grid">${LEVELS.map(d=>`<div class="pack-dog ${d.level===1?'unlocked':''}" data-level="${d.level}" title="${d.level}. ${d.name}"><img src="${asset(`assets/dogs/${d.file}`)}" alt="${d.name}"/><span>${String(d.level).padStart(2,'0')}</span></div>`).join('')}</div><p class="pack-note">От малыша до Суперцверга.<br>Познакомься с каждым.</p></section>
<div class="side-footer">НИ ОДИН ЦВЕРГ<br>НЕ ПОСТРАДАЛ <span>♡</span></div></aside>
</main><footer class="site-footer"><span>СОБАКЕС БУДКЕС © 2026</span><span>11 ХАРАКТЕРОВ · ОДНА КОРОБКА</span></footer>`;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const model=new GameModel();const sound=new SoundPlayer();let best=0;
try{best=Number(localStorage.getItem('sobakes:best'))||0;}catch{}best=Math.max(0,best);
$('best').textContent=best.toLocaleString('ru');
let lastNext=0,lastScore=-1,lastHighest=0;let helpPrevious:'ready'|'playing'|'paused'|'gameover'='ready';let newRecord=false;
function updateSound(){ $('sound').innerHTML=sound.muted?icons.muted:icons.sound;$('sound').setAttribute('aria-label',sound.muted?'Включить звук':'Выключить звук');$('sound').setAttribute('aria-pressed',String(!sound.muted)); }
updateSound();
const descriptions=['Мал, да удивлён.','Уже что-то задумал.','Вообще не понял, что случилось.','Длина — его суперсила.','Жизнь удалась.','Всё под контролем. Почти.','К взлёту готов.','Ещё пять минуточек.','Нам нужно серьёзно погавкать.','Большому псу — большой отдых.','Главный хороший мальчик.'];
function tick(){
 sound.update();
 if(lastScore!==model.score){lastScore=model.score;$('score').textContent=model.score.toLocaleString('ru');if(model.score>best){best=model.score;newRecord=true;$('best').textContent=best.toLocaleString('ru');try{localStorage.setItem('sobakes:best',String(best));}catch{}}}
 if(lastNext!==model.next){lastNext=model.next;const data=LEVELS[model.next-1];for(const id of ['next','next-mobile']){$<HTMLImageElement>(id).src=asset(`assets/dogs/${data.file}`);$<HTMLImageElement>(id).alt=`Следующий: ${data.name}`;}$('next-name').textContent=data.name;$('next-description').textContent=descriptions[data.level-1];$('next-level').textContent=`УРОВЕНЬ ${String(data.level).padStart(2,'0')}`;}
 if(lastHighest!==model.highest){lastHighest=model.highest;document.querySelectorAll<HTMLElement>('.pack-dog').forEach(el=>el.classList.toggle('unlocked',Number(el.dataset.level)<=model.highest));$('pack-count').textContent=`${model.highest} / 11`;}
 $('danger').hidden=model.danger.elapsed===0||model.state!=='playing';$('danger-count').textContent=`${Math.max(0,(2000-model.danger.elapsed)/1000).toFixed(1)} c`;
 $('pause').toggleAttribute('disabled',model.state==='ready'||model.state==='gameover');
 const hint=model.state==='playing'?(model.canDrop?'Двигай и отпускай — цверг упадёт':'Цверг устраивается поудобнее…'):'Хорошие мальчики готовы к падению';
 if($('game-hint').textContent!==hint)$('game-hint').textContent=hint;
}
function event(e:GameEvent){
 if(e.type==='impact'||e.type==='merge'||e.type==='supermerge')sound.event({type:e.type,pair:e.pair});
 if(e.type==='gameover'){sound.stop();scene.cancelPointer();tick();$('final-score').textContent=model.score.toLocaleString('ru');$('end-label').textContent=newRecord?'НОВЫЙ ЛИЧНЫЙ РЕКОРД!':'СТАЯ В СБОРЕ';$('end-overlay').hidden=false;$('again').focus();}
}
const scene=new DogScene(model,()=>{$<HTMLButtonElement>('play').disabled=false;$('play').innerHTML='Выпустить цвергов <span>↗</span>';$('load-progress').textContent='Без регистрации. Без поводка.';},tick,event);
const game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:FIELD.width,height:FIELD.height,backgroundColor:'#f9f6ee',transparent:false,antialias:true,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},input:{activePointers:1},render:{roundPixels:false},audio:{noAudio:true},scene:[scene]});
function hideOverlays(){for(const id of ['overlay','pause-overlay','confirm-overlay','end-overlay','help-overlay'])$(id).hidden=true;}
function start(){sound.stop();void sound.unlock();hideOverlays();model.reset();scene.cancelPointer();newRecord=false;lastNext=0;lastHighest=0;tick();game.canvas.focus();}
function pause(){if(model.state==='playing'){model.pause();sound.stop();scene.cancelPointer();hideOverlays();$('pause-overlay').hidden=false;$('resume').focus();}}
$('play').onclick=start;$('again').onclick=start;
$('sound').onclick=()=>{sound.toggle();updateSound();};
$('pause').onclick=()=>{if(model.state==='playing')pause();else if(model.state==='paused'&&!$('pause-overlay').hidden)resume();};
function resume(){hideOverlays();model.resume();void sound.unlock();game.canvas.focus();}
$('resume').onclick=resume;
$('restart').onclick=()=>{hideOverlays();$('confirm-overlay').hidden=false;$('confirm-restart').focus();};
$('confirm-restart').onclick=start;
$('cancel-restart').onclick=()=>{hideOverlays();$('pause-overlay').hidden=false;$('resume').focus();};
$('help').onclick=()=>{helpPrevious=model.state;if(model.state==='playing'){model.pause();sound.stop();scene.cancelPointer();}hideOverlays();$('help-overlay').hidden=false;$('close-help').focus();};
$('close-help').onclick=()=>{hideOverlays();if(helpPrevious==='playing'){model.resume();void sound.unlock();}else if(helpPrevious==='paused')$('pause-overlay').hidden=false;else if(helpPrevious==='ready')$('overlay').hidden=false;else $('end-overlay').hidden=false;};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(model.state==='playing')pause();else if(model.state==='paused'&&!$('pause-overlay').hidden)resume();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);
game.canvas.setAttribute('tabindex','0');game.canvas.setAttribute('aria-label','Поле игры: стрелки влево и вправо — прицелиться, пробел — сбросить цверга');
// A small, explicit dev-only hook for deterministic physics acceptance checks.
if(import.meta.env.DEV)(window as unknown as {__sobakes:unknown}).__sobakes={model,scene,sound};
