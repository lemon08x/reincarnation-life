import { _decorator, Component, ResolutionPolicy, view } from 'cc';
import { FamilyService } from './app/familyService';
import { GameService } from './app/gameService';
import { presentFamilyEvent, presentFamilyHistory, presentFamilyHome, presentFamilyMember, presentFamilySettlement } from './app/presentation/familyPresenters';
import { presentCausality, presentEncounter, presentEnding, presentHome, presentRecall, presentJournal, routePlayPage } from './app/presentation/presenters';
import { CocosFamilySaveStore } from './platform/cocosFamilySaveStore';
import { CocosSaveStore } from './platform/cocosSaveStore';
import { UiKit } from './ui/kit';
import { FamilyPageActions, renderFamilyEvent, renderFamilyHistory, renderFamilyHome, renderFamilyMember, renderFamilySettlement } from './ui/familyPages';
import { PageActions, renderCausality, renderEncounter, renderEnding, renderError, renderHome, renderOverlay, renderRecall, renderJournal } from './ui/pages';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './ui/theme';

const { ccclass } = _decorator;
@ccclass('GameApp')
export class GameApp extends Component {
  private service!: GameService;
  private familyService!: FamilyService;
  private kit!: UiKit;
  private submitting = false;
  private nextActionAt = 0;
  private redraw: () => void = () => {};
  private seedFactory = () => ((Date.now() >>> 0) ^ (Math.floor(Math.random() * 0xffffffff) >>> 0)) >>> 0 || 1;

  public start(): void {
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.SHOW_ALL);
    this.kit = new UiKit(this, this.node);
    try {
      this.service = new GameService(new CocosSaveStore(), this.seedFactory);
      this.familyService = new FamilyService(new CocosFamilySaveStore(), this.seedFactory);
      if (!this.familyService.hasFamily()) this.familyService.startFamily();
      this.renderFamilyHome();
      view.on('canvas-resize', this.onResize, this);
    } catch (error) { this.renderError(error); }
  }
  public onDestroy(): void { view.off('canvas-resize', this.onResize, this); this.kit?.clearPage(); }
  private onResize(): void { this.scheduleOnce(() => this.redraw(), 0); }

  private legacyActions(back: () => void): PageActions {
    return { goHome: () => this.renderHome(), expand: (_key, title, body) => this.showOverlay(title, body), journal: () => this.renderJournal(back) };
  }

  private familyActions(): FamilyPageActions {
    return {
      goLegacy: () => this.renderHome(),
      showHistory: () => this.renderFamilyHistory(),
      showMember: () => this.renderFamilyMember(),
      expand: (_key, title, body) => this.showOverlay(title, body),
    };
  }

  private resume(): void { this.runCommand(() => { this.service.resumeCurrentLife(); this.renderLife(); }); }
  private newLife(): void { this.runCommand(() => { this.service.startNewLife([]); this.renderLife(); }); }

  private renderHome(): void {
    this.redraw = () => this.renderHome();
    const hasFamily = this.familyService.hasFamily();
    renderHome(this.kit, presentHome(this.service.getProfile(), this.service.getCurrentRun()), {
      ...this.legacyActions(() => this.renderHome()),
      continueLife: () => this.resume(),
      startLife: () => this.newLife(),
      lastResult: () => this.resume(),
      family: {
        label: hasFamily ? '回到家庭 ›' : '经营一个家庭 ›',
        action: () => this.familyModeEntry(),
      },
    });
  }

  private familyModeEntry(): void {
    this.runCommand(() => {
      if (!this.familyService.hasFamily()) {
        this.familyService.startFamily();
      }
      this.renderFamilyHome();
    });
  }

  private renderLife(): void {
    const page = routePlayPage(this.service.getCurrentRun());
    if (page === 'encounter') this.renderEncounter();
    else if (page === 'recall') this.renderRecall();
    else if (page === 'ending') this.renderEnding();
    else this.renderHome();
  }

  // ---------- 家庭模式 ----------

  private renderFamilyHome(): void {
    this.redraw = () => this.renderFamilyHome();
    const actions = this.familyActions();
    const view = presentFamilyHome(
      this.familyService.saveSnapshot(),
      this.familyService.getContent(),
      this.familyService.getEligibleBuildings(),
    );
    renderFamilyHome(this.kit, view, {
      ...actions,
      build: id => this.runCommand(() => { this.familyService.build(id); this.renderFamilyHome(); }),
      continueRun: () => this.runCommand(() => this.renderFamilyRoute()),
      startNext: () => this.runCommand(() => { this.familyService.startNextGeneration(); this.renderFamilyRoute(); }),
      viewSettlement: () => this.renderFamilySettlement(),
    });
  }

  private renderFamilyRoute(): void {
    const run = this.familyService.getCurrentRun();
    if (!run) return this.renderFamilyHome();
    if (run.status === 'settled') return this.renderFamilySettlement();
    if (run.pendingEvent) return this.renderFamilyEvent();
    this.renderFamilyHome();
  }

  private renderFamilyEvent(): void {
    this.redraw = () => this.renderFamilyEvent();
    const run = this.familyService.getCurrentRun();
    if (!run?.pendingEvent) return this.renderFamilyHome();
    const actions = this.familyActions();
    renderFamilyEvent(this.kit, presentFamilyEvent(this.familyService.saveSnapshot(), this.familyService.getContent()), {
      ...actions,
      backHome: () => this.renderFamilyHome(),
      select: optionId => this.runCommand(() => {
        this.familyService.chooseAndAdvance(run.pendingEvent!.instanceId, optionId);
        this.renderFamilyRoute();
      }),
    });
  }

  private renderFamilySettlement(): void {
    this.redraw = () => this.renderFamilySettlement();
    const settlement = this.familyService.getLastSettlement();
    if (!settlement) return this.renderFamilyHome();
    const actions = this.familyActions();
    renderFamilySettlement(this.kit, presentFamilySettlement(this.familyService.saveSnapshot(), this.familyService.getContent()), {
      ...actions,
      backHome: () => this.renderFamilyHome(),
    });
  }

  private renderFamilyHistory(): void {
    this.redraw = () => this.renderFamilyHistory();
    renderFamilyHistory(this.kit, presentFamilyHistory(this.familyService.saveSnapshot()), {
      ...this.familyActions(),
      back: () => this.renderFamilyHome(),
    });
  }

  private renderFamilyMember(): void {
    this.redraw = () => this.renderFamilyMember();
    const back = () => {
      const run = this.familyService.getCurrentRun();
      if (run?.status === 'active' && run.pendingEvent) this.renderFamilyEvent();
      else this.renderFamilyHome();
    };
    renderFamilyMember(this.kit, presentFamilyMember(this.familyService.saveSnapshot(), this.familyService.getContent()), {
      ...this.familyActions(),
      back,
    });
  }

  // ---------- 旧轮回模式 ----------

  private renderEncounter(): void {
    this.redraw = () => this.renderEncounter();
    const run = this.service.getCurrentRun();
    if (!run?.pendingEncounter) return this.renderHome();
    const instance = run.pendingEncounter.instanceId;
    renderEncounter(this.kit, presentEncounter(run, this.service.getContent(), null), {
      ...this.legacyActions(() => this.renderEncounter()),
      select: id => this.runCommand(() => { this.service.chooseAndAdvance(instance, id); this.renderLife(); }),
      openPast: id => this.renderCausality(id, () => this.renderEncounter()),
    });
  }
  private renderRecall(): void {
    this.redraw = () => this.renderRecall();
    const run = this.service.getCurrentRun();
    if (!run?.pendingRecall) return this.renderHome();
    const instance = run.pendingRecall.instanceId;
    renderRecall(this.kit, presentRecall(run, null), {
      ...this.legacyActions(() => this.renderRecall()),
      select: stance => this.runCommand(() => { this.service.chooseRecallAndAdvance(instance, stance); this.renderLife(); }),
      openPast: id => this.renderCausality(id, () => this.renderRecall()),
    });
  }
  private renderEnding(): void {
    this.redraw = () => this.renderEnding();
    const run = this.service.getCurrentRun();
    if (!run?.closing) return this.renderHome();
    renderEnding(this.kit, presentEnding(run, this.service.getContent()), {
      ...this.legacyActions(() => this.renderEnding()), nextLife: () => this.newLife(),
      openPast: id => this.renderCausality(id, () => this.renderEnding()),
    });
  }
  private renderJournal(back: () => void): void {
    this.redraw = () => this.renderJournal(back);
    renderJournal(this.kit, presentJournal(this.service.getProfile(), this.service.getCurrentRun()), {
      ...this.legacyActions(back), journal: undefined, back, openPast: id => this.renderCausality(id, () => this.renderJournal(back)),
    });
  }
  private renderCausality(id: string, back: () => void): void {
    this.redraw = () => this.renderCausality(id, back);
    const record = this.service.inspectCausality(id);
    if (!record) { this.showOverlay('往事', '暂时找不到这段记录。'); return; }
    renderCausality(this.kit, presentCausality(record), {
      ...this.legacyActions(() => this.renderCausality(id, back)), back,
      openSource: source => this.renderCausality(source, () => this.renderCausality(id, back)),
    });
  }
  private showOverlay(title: string, body: string): void { renderOverlay(this.kit, title, body, () => {}); }
  private renderError(error: unknown): void {
    console.error(error);
    renderError(this.kit, error instanceof Error ? error.message : String(error), () => { if (this.service) this.renderHome(); });
  }
  private runCommand(work: () => void): void {
    if (this.submitting || Date.now() < this.nextActionAt) return;
    this.submitting = true;
    try { work(); this.nextActionAt = Date.now() + 240; }
    catch (error) { this.renderError(error); }
    finally { this.submitting = false; }
  }
}