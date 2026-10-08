export type ActionId = 'restart' | 'call-and-restart' | 'hold-and-confirm';
export type Observation = 'coworker' | 'panel';
export type Phase = 'intro' | 'explore' | 'choice' | 'feedback' | 'action' | 'final' | 'done';

export const scenario = {
  id: 'V03-DEMO',
  title: '점검 중인 동료',
  reviewStatus: '현장 검토 대기',
  source: '가상 데모 가정 V03, 사업장 절차 미제공',
  choices: [
    { id: 'restart' as ActionId, title: '재가동 버튼을 누른다', detail: '컨베이어가 멈춰 있으니 작업을 재개한다.' },
    { id: 'call-and-restart' as ActionId, title: '동료에게 외친 뒤 재가동한다', detail: '재가동한다고 알리고 곧바로 시작한다.' },
    { id: 'hold-and-confirm' as ActionId, title: '재가동을 보류하고 확인한다', detail: '동료와 담당자에게 위치와 작업 상태를 확인한다.' }
  ]
};

export function judge(action: ActionId) {
  const correct = action === 'hold-and-confirm';
  const reason = action === 'restart'
    ? '동료가 설비 가까이에서 점검 중입니다. 멈춘 벨트만 보고 재가동해도 된다고 판단하면 작업자의 위치와 점검 상태를 놓칩니다.'
    : action === 'call-and-restart'
    ? '알리는 것과 확인하는 것은 다릅니다. 동료의 응답과 위치, 작업 상태를 확인하지 않은 채 재가동하면 위험이 남아 있습니다.'
    : '재가동을 보류하면 확인할 시간을 확보할 수 있습니다. 동료와 담당자에게 작업 상태를 확인하는 행동으로 이어집니다.';
  return { correct, reason, nextAction: '재가동을 보류하고 동료와 담당자에게 위치와 작업 상태를 확인합니다.' };
}

export class Run {
  phase: Phase = 'intro';
  observations = new Set<Observation>();
  attempts: ActionId[] = [];
  finalWrong = 0;
  start() { this.phase = 'explore'; }
  observe(id: Observation) { if (this.phase === 'explore') this.observations.add(id); }
  get ready() { return this.observations.has('coworker') && this.observations.has('panel'); }
  openChoice() { if (this.phase === 'explore' && this.ready) this.phase = 'choice'; }
  choose(action: ActionId) {
    if (this.phase !== 'choice' || !this.ready) return null;
    const result = judge(action);
    this.attempts.push(action);
    this.phase = result.correct ? 'action' : 'feedback';
    return result;
  }
  retry() {
    if (this.phase !== 'feedback') return;
    this.observations.delete('coworker');
    this.phase = 'explore';
  }
  completeAction() { if (this.phase === 'action') this.phase = 'final'; }
  confirmFinal(hold: boolean) {
    if (this.phase !== 'final') return false;
    if (hold) this.phase = 'done';
    else this.finalWrong++;
    return hold;
  }
}
