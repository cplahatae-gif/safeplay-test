
import Phaser from 'phaser';
import { Run, scenario, judge, type ActionId, type Observation } from './rules.ts';
import './styles.css';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const run = new Run();
const dialog = $('dialog');
let inspecting = false;
let scene: SiteScene;
let actionStarted = 0;
let confirmationShown = false;
let frameBottoms = [0.976, 0.98, 0.98, 0.98];
const floorY = (x: number) => 510 + x * 0.044;
const objects: {id:Observation;x:number;label:string}[] = [
  {id:'panel',x:892,label:'설비 제어반'},
  {id:'coworker',x:1040,label:'점검 중인 동료'}
];

function updateHUD() {
  const stages = {intro:0,explore:0,choice:1,feedback:1,action:2,final:2,done:3};
  const labels = {intro:'현장 진입',explore:'01 · 이동과 관찰',choice:'02 · 대응 판단',feedback:'02 · 판단 다시 보기',action:'03 · 동료 확인',final:'03 · 최종 확인',done:'훈련 완료'};
  const index = stages[run.phase];
  $('step-label').textContent = labels[run.phase];
  $('step-dots').innerHTML = [0,1,2].map(i=>'<i class="'+(i<index?'complete':i===index?'active':'')+'"></i>').join('');
  $('observed-count').textContent = '관찰 기록 ' + run.observations.size + ' / 2';
  $('decide').hidden = run.phase !== 'explore' || !run.ready;
  const objectives = {
    intro:'현장을 둘러보고, 작업 상태를 확인하세요.',
    explore:run.attempts.length ? '동료의 위치와 작업 상태를 다시 확인하세요.' : '통로를 걸으며 주변의 작업 상태를 확인하세요.',
    choice:'확인한 단서를 바탕으로 대응을 선택하세요.',
    feedback:'어떤 확인을 놓쳤는지 살펴보고 다시 판단하세요.',
    action:'재가동을 보류하고 동료에게 작업 상태를 확인합니다.',
    final:'상황이 달라졌을 때도 같은 원칙을 적용해 보세요.',
    done:'위험을 알아보고, 확인하는 행동까지 연습했습니다.'
  };
  $('objective').textContent = objectives[run.phase];
}

function panel(tag:string,title:string,body:string,closable=false) {
  dialog.innerHTML = '<div class="dialog-top"><span class="dialog-tag">'+tag+'</span>'+(closable?'<button class="close" data-action="close" aria-label="닫기">×</button>':'')+'</div><h2 id="dialog-title" class="dialog-title">'+title+'</h2>'+body;
  dialog.hidden = false;
  dialog.scrollTop = 0;
  $('proximity').hidden = true;
  requestAnimationFrame(()=>dialog.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true}));
}

function closeInspection() {
  inspecting = false;
  dialog.hidden = true;
  if(run.phase==='choice') run.phase='explore';
  updateHUD();
}

function investigate(id:Observation) {
  if(run.phase!=='explore' || inspecting) return;
  inspecting = true;
  run.observe(id);
  updateHUD();
  if(id==='coworker') {
    panel('관찰 기록 / 동료','아직 점검 중입니다','<p class="dialog-copy">동료가 컨베이어 가까이에서 공구를 사용하고 있습니다. 지금 재가동 요청이 들어왔습니다.</p><ul class="fact-list"><li>동료가 점검 구역에 남아 있습니다.</li><li>열린 공구함이 통로에 놓여 있습니다.</li><li>작업 완료와 이동 여부는 확인하지 않았습니다.</li></ul><span class="source-tag">가상 데모에서 설정한 상황</span><button class="primary" data-action="close">관찰 기록하기 <span>→</span></button>',true);
  } else {
    panel('관찰 기록 / 설비','멈춘 모습만 확인했습니다','<p class="dialog-copy">벨트가 움직이지 않고 점검 표지가 보입니다. 재가동 승인과 작업자 확인 기록은 없습니다.</p><ul class="fact-list"><li>현재 벨트는 움직이지 않습니다.</li><li>점검 표지가 붙어 있습니다.</li><li>재가동 가능한 상태인지는 별도 확인이 필요합니다.</li></ul><span class="source-tag">가상 상태 데이터 · 현장 검토 대기</span><button class="primary" data-action="close">관찰 기록하기 <span>→</span></button>',true);
  }
}

function openChoice() {
  run.openChoice();
  if(run.phase!=='choice') return;
  inspecting = false;
  updateHUD();
  panel('대응 선택','지금, 어떻게 할까요?','<p class="dialog-copy">재가동 요청을 받았습니다. 확인한 현장 상태를 바탕으로 행동을 선택하세요.</p>'+scenario.choices.map((c,i)=>'<button class="choice" data-action="'+c.id+'" data-key="'+(i+1)+'"><span class="choice-num">0'+(i+1)+'</span><span><strong>'+c.title+'</strong><small>'+c.detail+'</small></span></button>').join('')+'<p class="choice-help">숫자 1 · 2 · 3 또는 마우스로 선택</p>',true);
}

function showWrong(action:ActionId) {
  const result = judge(action);
  scene.setDanger(true);
  panel('위험 직전 / 교육용 일시정지','여기서 멈춰요','<span class="source-tag">사전 작성 피드백 · AI 미연동</span><p class="dialog-copy">'+result.reason+'</p><div class="safe-step">'+result.nextAction+'</div><button class="primary" data-action="retry">같은 상황 다시 확인 <span>↺</span></button><p class="choice-help">실제 설비의 자동 보호 기능을 의미하지 않습니다.</p>');
  $('dialog-title').classList.add('feedback-title');
  updateHUD();
}

function choose(id:ActionId) {
  const result = run.choose(id);
  if(!result) return;
  if(!result.correct) { showWrong(id); return; }
  dialog.hidden = true;
  scene.setDanger(false);
  actionStarted = 0;
  confirmationShown = false;
  $('world-caption').textContent='재가동을 보류하고 동료에게 확인합니다.';
  $('world-caption').hidden=false;
  updateHUD();
}

function showFinal() {
  panel('최종 확인 / 달라진 상황','새 작업자가 들어왔다면?','<span class="source-tag">사전 작성 피드백 · AI 미연동</span><p class="dialog-copy">동료 확인 이후, 다른 작업자가 점검 구역으로 들어왔습니다. 방금 확인한 기록만으로 바로 재가동해도 될까요?</p><button class="choice" data-action="final-wrong" data-key="1"><span class="choice-num">01</span><span><strong>방금 확인했으니 재가동한다</strong><small>이전 확인 기록을 그대로 사용한다.</small></span></button><button class="choice" data-action="final-safe" data-key="2"><span class="choice-num">02</span><span><strong>보류하고 바뀐 상태를 다시 확인한다</strong><small>작업자의 위치와 작업 상태를 다시 확인한다.</small></span></button>');
  updateHUD();
}

function showDone() {
  const first = scenario.choices.find(c=>c.id===run.attempts[0])?.title || '';
  const revised = run.attempts.length>1;
  panel('훈련 완료','확인하는 행동까지','<div class="success-mark" aria-hidden="true">✓</div><p class="dialog-copy">'+(revised?'첫 판단에서 놓친 단서를 다시 확인하고, 재가동을 보류하는 행동으로 바꿨습니다.':'동료의 위치와 작업 상태를 확인하는 행동을 선택했습니다.')+'</p><div class="result-line">최초 선택<strong>'+first+'</strong></div><div class="result-line">최종 확인<strong>바뀐 상태를 다시 확인한다</strong></div><div class="safe-step">실제 재가동은 해당 사업장의 절차와 권한 있는 담당자 확인에 따라야 합니다.</div><button class="primary" data-action="restart-game">처음부터 다시 연습 <span>↺</span></button>');
  updateHUD();
}

function dispatch(action:string) {
  if(action==='close') closeInspection();
  else if(action==='retry') {
    run.retry(); dialog.hidden=true; inspecting=false;
    scene.resetCheckpoint(); scene.setDanger(false);
    updateHUD();
  } else if(action==='restart-game') location.reload();
  else if(action==='final-wrong') {
    run.confirmFinal(false);
    panel('판단 다시 보기','확인 이후에도 상황은 바뀝니다','<span class="source-tag">사전 작성 피드백 · AI 미연동</span><p class="dialog-copy">새 작업자가 들어왔으므로 이전 확인만으로 현재 상태를 확정할 수 없습니다. 재가동을 보류하고 다시 확인하세요.</p><button class="primary" data-action="repeat-final">다시 판단하기 <span>↺</span></button>');
  } else if(action==='repeat-final') showFinal();
  else if(action==='final-safe') {
    if(run.confirmFinal(true)) showDone();
  } else if(scenario.choices.some(c=>c.id===action)) choose(action as ActionId);
}

dialog.addEventListener('click',e=>{
  const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if(button) dispatch(button.dataset.action!);
});
$('start').addEventListener('click',()=>{
  run.start(); $('intro').hidden=true; updateHUD();
  scene.input.keyboard?.resetKeys();
});
$('decide').addEventListener('click',openChoice);
document.addEventListener('keydown',e=>{
  if(!dialog.hidden) {
    if(e.key==='Escape' && (inspecting||run.phase==='choice')) closeInspection();
    else if(!e.repeat && /^[123]$/.test(e.key)) dialog.querySelector<HTMLButtonElement>('button[data-key="'+e.key+'"]')?.click();
  }
});

class SiteScene extends Phaser.Scene {
  player!:Phaser.GameObjects.Sprite;
  coworker!:Phaser.GameObjects.Image;
  standing!:Phaser.GameObjects.Sprite;
  shadow!:Phaser.GameObjects.Ellipse;
  danger!:Phaser.GameObjects.Rectangle;
  light!:Phaser.GameObjects.Arc;
  cursors!:Phaser.Types.Input.Keyboard.CursorKeys;
  keys!:{left:Phaser.Input.Keyboard.Key;right:Phaser.Input.Keyboard.Key;interact:Phaser.Input.Keyboard.Key};
  near:Observation|null=null;
  constructor(){super('site');}
  preload(){
    this.load.image('site','/assets/background.png');
    this.load.image('railing','/assets/railing.png');
    this.load.image('coworker','/assets/coworker.png');
    this.load.spritesheet('worker','/assets/worker.png',{frameWidth:529,frameHeight:743});
    this.load.json('assetInfo','/assets/asset-info.json');
    this.load.on('loaderror',()=>{$('loading').innerHTML='<p>현장 자산을 불러오지 못했습니다. 새로고침해 주세요.</p>';});
  }
  create(){
    scene=this;
    const info=this.cache.json.get('assetInfo');
    if(info?.worker?.bottoms) frameBottoms=info.worker.bottoms;
    this.add.image(0,0,'site').setOrigin(0,0).setDisplaySize(1280,720).setDepth(0);
    this.add.ellipse(1040,555,126,19,0x070c09,.35).setDepth(8);
    this.coworker=this.add.image(1048,558,'coworker').setOrigin(.48,.95).setDisplaySize(238.15,172).setDepth(10);
    this.standing=this.add.sprite(1050,556,'worker',0).setOrigin(.5,frameBottoms[0]).setDisplaySize(174.44,245).setFlipX(true).setDepth(10).setVisible(false);
    this.shadow=this.add.ellipse(440,floorY(440),69,13,0x080d09,.4).setDepth(15);
    this.player=this.add.sprite(440,floorY(440),'worker',0).setOrigin(.5,frameBottoms[0]).setDisplaySize(181.56,255).setDepth(20);
    this.add.image(0,0,'railing').setOrigin(0,0).setDisplaySize(1280,720).setDepth(40);
    this.light=this.add.circle(910,314,3.3,0xd8a243,.85).setDepth(5);
    this.danger=this.add.rectangle(640,360,1280,720,0x642f12,0).setDepth(60);
    this.cursors=this.input.keyboard!.createCursorKeys();
    this.keys=this.input.keyboard!.addKeys({left:'A',right:'D',interact:'E'}) as SiteScene['keys'];
    this.keys.interact.on('down',()=>{if(this.near) investigate(this.near);});
    for(const [key,direction] of [[this.cursors.left,-1],[this.keys.left,-1],[this.cursors.right,1],[this.keys.right,1]] as const) {
      key.on('down',()=>{
        if(run.phase==='explore'&&!inspecting&&dialog.hidden) this.player.x=Phaser.Math.Clamp(this.player.x+direction*3,155,944);
      });
    }
    window.addEventListener('blur',()=>this.input.keyboard?.resetKeys());
    $('loading').hidden=true;
    updateHUD();
  }
  setDanger(active:boolean){this.danger.setFillStyle(0x642f12,active?.18:0);this.light.setFillStyle(active?0xd37f46:0xd8a243);}
  resetCheckpoint(){this.player.setX(812);this.player.setY(floorY(812));this.player.setFrame(0).setOrigin(.5,frameBottoms[0]);}
  update(time:number,delta:number){
    if(!this.player) return;
    const dt=Math.min(delta,50)/1000;
    let direction=0;
    if(run.phase==='explore' && !inspecting && dialog.hidden) {
      direction=(this.cursors.right.isDown||this.keys.right.isDown?1:0)-(this.cursors.left.isDown||this.keys.left.isDown?1:0);
      this.player.x=Phaser.Math.Clamp(this.player.x+direction*145*dt,155,944);
    } else if(run.phase==='action') {
      if(!actionStarted) actionStarted=time;
      const distance=930-this.player.x;
      if(Math.abs(distance)>3){direction=Math.sign(distance);this.player.x+=direction*Math.min(Math.abs(distance),120*dt);}
      else if(!confirmationShown){
        confirmationShown=true;
        this.coworker.setVisible(false);this.standing.setVisible(true);
        $('world-caption').textContent='“점검 중입니다. 재가동을 보류해 주세요.”';
        this.light.setFillStyle(0xb8bd72);
        this.time.delayedCall(2300,()=>{
          $('world-caption').hidden=true;
          run.completeAction();showFinal();
        });
      }
    }
    this.player.y=floorY(this.player.x);
    const frame=direction?Math.floor(time/155)%4:0;
    this.player.setFrame(frame).setOrigin(.5,frameBottoms[frame]);
    if(direction) this.player.setFlipX(direction<0);
    this.shadow.setPosition(this.player.x,this.player.y-2);
    if(run.phase==='explore' && !inspecting && dialog.hidden){
      const available=objects.filter(o=>Math.abs(o.x-this.player.x)<142);
      available.sort((a,b)=>Number(run.observations.has(a.id))-Number(run.observations.has(b.id))||Math.abs(a.x-this.player.x)-Math.abs(b.x-this.player.x));
      const target=available[0];
      const prompt=$('proximity');
      prompt.hidden=!target;
      this.near=target?.id||null;
      if(target){
        prompt.querySelector('span')!.textContent=target.label+(run.observations.has(target.id)?' 다시 보기':' 조사');
        prompt.style.left=(target.x/1280*100)+'%';
        prompt.style.top=(target.id==='coworker'?54:43)+'%';
      }
    } else {$('proximity').hidden=true;this.near=null;}
  }
}

new Phaser.Game({
  type:Phaser.AUTO,
  parent:'game',
  width:1280,height:720,
  backgroundColor:'#18231c',
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
  scene:[SiteScene],
  render:{antialias:true,pixelArt:false}
});
