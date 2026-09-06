import { _decorator, Component, ResolutionPolicy, view } from 'cc';
import { GameService } from './app/gameService';
import {
  presentChoices,
  presentHistoryFigures,
  presentHistoryRegions,
  presentHome,
  presentLoadout,
  presentPaths,
  presentReady,
  presentResult,
  presentRewards,
  presentScenario,
  presentSummary,
  presentTalents,
  routePlayPage,
} from './app/presentation/presenters';
import { HistoryRegionId, LifeMark, LifeRun, TalentDraft } from './core/model';
import { CocosSaveStore } from './platform/cocosSaveStore';
import { UiKit } from './ui/kit';
import {
  renderChoices,
  renderError,
  renderHistoryFigures,
  renderHistoryRegions,
  renderHome,
  renderLoadout,
  renderOverlay,
  renderPaths,
  renderReady,
  renderResult,
  renderRewards,
  renderScenario,
  renderSummary,
  renderTalents,
} from './ui/pages';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './ui/theme';

const { ccclass } = _decorator;

interface RunSnapshot {
  resources?: Record<string, number>;
  marks: LifeMark[];
}

@ccclass('GameApp')
export class GameApp extends Component {
  private service!: GameService;
  private kit!: UiKit;
  private talentDraft: TalentDraft | null = null;
  private selectedTalentIds: string[] = [];
  private autoPlaying = false;
  private advancing = false;
  private submitting = false;
  private selectedLegacyId: string | null = null;
  private selectedChoiceId: string | null = null;
  private selectedRewardId: string | null = null;
  private foresightOpen = false;
  private browseEventId = '';
  private historyRegion: HistoryRegionId | null = null;
  private selectedFigureId: string | null = null;
  private lastScenarioKey = '';
  private snapshot: RunSnapshot | null = null;
  private overlay: { title: string; body: string } | null = null;

  public start(): void {
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.SHOW_ALL);
    this.service = new GameService(new CocosSaveStore(), () => this.createSeed());
    this.kit = new UiKit(this, this.node);
    this.renderHome();
  }

  public onDestroy(): void {
    this.stopAutoPlay();
    this.kit?.clearPage();
  }

  private renderHome(): void {
    this.stopAutoPlay();
    this.overlay = null;
    const viewModel = presentHome(this.service.getProfile(), this.service.getCurrentRun(), this.service.getContent());
    renderHome(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      continueLife: () => this.renderLife(),
      claimReward: () => this.renderResult(),
      freeMode: () => this.openTalentSelection(),
      historyMode: () => this.renderHistoryRegions(),
      loadout: () => {
        this.selectedLegacyId = null;
        this.renderLegacyLoadout();
      },
      lastResult: () => this.renderResult(),
    });
  }

  private openTalentSelection(): void {
    this.runCommand(() => {
      this.talentDraft = this.service.createTalentDraft();
      this.selectedTalentIds = [];
      this.renderTalentSelection();
    });
  }

  private renderTalentSelection(): void {
    const draft = this.talentDraft;
    if (!draft) {
      this.renderError(new Error('天赋候选尚未生成。'));
      return;
    }
    const viewModel = presentTalents(draft, this.selectedTalentIds, this.service.getContent());
    renderTalents(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      toggle: (id) => this.toggleTalent(id),
      begin: () => this.beginLife(),
    });
    this.paintOverlay();
  }

  private toggleTalent(talentId: string): void {
    const draft = this.talentDraft;
    if (!draft) {
      return;
    }
    if (this.selectedTalentIds.includes(talentId)) {
      this.selectedTalentIds = this.selectedTalentIds.filter((id) => id !== talentId);
    } else if (this.selectedTalentIds.length < draft.requiredSelectionCount) {
      this.selectedTalentIds = [...this.selectedTalentIds, talentId];
    }
    this.renderTalentSelection();
  }

  private beginLife(): void {
    if (!this.talentDraft) {
      this.renderError(new Error('缺少本世天赋信息。'));
      return;
    }
    this.runCommand(() => {
      this.service.startNewLife(this.talentDraft as TalentDraft, this.selectedTalentIds);
      this.captureSnapshot(this.service.getCurrentRun());
      this.renderLife();
    });
  }

  private renderLife(preserveAutoPlay = false): void {
    if (!preserveAutoPlay) {
      this.stopAutoPlay();
    }
    const run = this.service.getCurrentRun();
    if (!run) {
      this.renderHome();
      return;
    }
    const page = routePlayPage(run);
    if (page === 'result') {
      this.renderResult();
      return;
    }
    if (page === 'path') {
      this.renderPathSelect();
      return;
    }
    if (page === 'scenario') {
      this.renderScenario();
      return;
    }
    if (page === 'summary') {
      this.renderScenarioSummary();
      return;
    }
    if (page === 'choice') {
      this.renderChoice();
      return;
    }
    this.renderReady(preserveAutoPlay);
  }

  private renderHistoryRegions(): void {
    const regions = presentHistoryRegions(this.service.getContent());
    renderHistoryRegions(this.kit, regions, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      openRegion: (id) => {
        this.historyRegion = id;
        this.selectedFigureId = null;
        this.renderHistoryFigures();
      },
    });
    this.paintOverlay();
  }

  private renderHistoryFigures(): void {
    const regionId = this.historyRegion;
    if (!regionId) {
      this.renderHistoryRegions();
      return;
    }
    const content = this.service.getContent();
    const region = content.regions.find((item) => item.id === regionId);
    const figures = presentHistoryFigures(regionId, content, this.selectedFigureId);
    renderHistoryFigures(this.kit, region?.name ?? '历史', figures, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      select: (id) => {
        this.selectedFigureId = id;
        this.renderHistoryFigures();
      },
      confirm: () => {
        if (!this.selectedFigureId) {
          return;
        }
        this.runCommand(() => {
          this.service.startHistoryRun(this.selectedFigureId as string);
          this.captureSnapshot(this.service.getCurrentRun());
          this.renderLife();
        });
      },
      back: () => this.renderHistoryRegions(),
    });
    this.paintOverlay();
  }

  private renderPathSelect(): void {
    const run = this.service.getCurrentRun();
    if (!run || run.status !== 'active') {
      this.renderHome();
      return;
    }
    const viewModel = presentPaths(run, this.service.getContent());
    renderPaths(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      choose: (id) => this.runCommand(() => {
        this.captureSnapshot(run);
        this.service.chooseCurrentPath(id);
        this.lastScenarioKey = '';
        this.renderLife();
      }),
    });
    this.paintOverlay();
  }

  private renderScenario(): void {
    const run = this.service.getCurrentRun();
    if (!run?.currentScenario || run.status !== 'active') {
      this.renderLife();
      return;
    }
    const key = `${run.currentScenario.scenarioId}:${run.currentScenario.kind}`;
    const keepScene = this.lastScenarioKey === key;
    this.lastScenarioKey = key;
    const viewModel = presentScenario(run, this.service.getContent(), this.snapshot ?? undefined);
    renderScenario(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      act: (id) => this.runCommand(() => {
        this.captureSnapshot(run);
        this.service.resolveCurrentScenarioAction(id);
        this.renderLife();
      }),
    }, keepScene);
    this.paintOverlay();
  }

  private renderScenarioSummary(): void {
    const run = this.service.getCurrentRun();
    if (!run?.scenarioReport) {
      this.renderLife();
      return;
    }
    const viewModel = presentSummary(run, this.service.getContent(), this.snapshot ?? undefined);
    renderSummary(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      next: () => this.runCommand(() => {
        this.service.continueCurrentScenario();
        this.lastScenarioKey = '';
        this.captureSnapshot(this.service.getCurrentRun());
        this.renderLife();
      }),
    });
    this.paintOverlay();
  }

  private renderChoice(): void {
    const run = this.service.getCurrentRun();
    if (!run || run.status !== 'active' || run.turnState !== 'awaiting-choice' || !run.pendingDecision) {
      this.renderLife();
      return;
    }
    if (this.browseEventId !== run.pendingDecision.eventId) {
      this.browseEventId = run.pendingDecision.eventId;
      this.selectedChoiceId = null;
      this.foresightOpen = false;
    }
    const viewModel = presentChoices(run, this.service.getContent(), this.selectedChoiceId, this.foresightOpen);
    renderChoices(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      select: (id) => {
        this.selectedChoiceId = id;
        this.renderChoice();
      },
      confirm: () => {
        if (!this.selectedChoiceId) {
          return;
        }
        this.runCommand(() => {
          this.captureSnapshot(run);
          this.service.resolveCurrentChoice(this.selectedChoiceId as string);
          this.selectedChoiceId = null;
          this.renderLife();
        });
      },
      toggleForesight: () => {
        this.foresightOpen = !this.foresightOpen;
        this.renderChoice();
      },
      reroll: () => this.runCommand(() => {
        this.service.rerollCurrentDecision();
        this.browseEventId = '';
        this.renderChoice();
      }),
    });
    this.paintOverlay();
  }

  private renderReady(_preserveAutoPlay: boolean): void {
    const run = this.service.getCurrentRun();
    if (!run) {
      this.renderHome();
      return;
    }
    const viewModel = presentReady(run, this.service.getContent(), this.autoPlaying);
    renderReady(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      advance: () => this.advanceOneYear(),
      toggleAuto: () => this.toggleAutoPlay(),
    });
    this.paintOverlay();
  }

  private renderResult(): void {
    this.stopAutoPlay();
    const run = this.service.getCurrentRun();
    if (!run?.settlement || !run.endingId) {
      this.renderError(new Error('当前没有可展示的人生结算。'));
      return;
    }
    const viewModel = presentResult(run, this.service.getProfile(), this.service.getContent());
    renderResult(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      rewards: () => {
        this.selectedRewardId = null;
        this.renderRewardSelection();
      },
      nextLife: () => this.openTalentSelection(),
    });
    this.paintOverlay();
  }

  private renderRewardSelection(): void {
    const run = this.service.getCurrentRun();
    if (!run?.settlement || run.status !== 'reward-pending') {
      this.renderResult();
      return;
    }
    const viewModel = presentRewards(run, this.service.getProfile(), this.service.getContent(), this.selectedRewardId);
    renderRewards(this.kit, viewModel, {
      goHome: () => this.renderResult(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      select: (id) => {
        this.selectedRewardId = id;
        this.renderRewardSelection();
      },
      claim: () => {
        if (!this.selectedRewardId) {
          return;
        }
        this.runCommand(() => {
          this.service.claimCurrentReward(this.selectedRewardId as string);
          this.renderResult();
        });
      },
    });
    this.paintOverlay();
  }

  private renderLegacyLoadout(): void {
    const profile = this.service.getProfile();
    const viewModel = presentLoadout(
      profile,
      this.service.getContent(),
      this.service.getOwnedLegacies(),
      this.service.getLegacySlotCount(),
      this.selectedLegacyId,
    );
    renderLoadout(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      select: (id) => {
        this.selectedLegacyId = id;
        this.renderLegacyLoadout();
      },
      toggle: (id) => this.runCommand(() => {
        this.service.toggleEquippedLegacy(id);
        this.renderLegacyLoadout();
      }),
    });
    this.paintOverlay();
  }

  private renderError(error: unknown): void {
    this.stopAutoPlay();
    const message = error instanceof Error ? error.message : String(error);
    console.error(error);
    renderError(this.kit, message, () => this.renderHome());
  }

  private showOverlay(title: string, body: string): void {
    this.overlay = { title, body };
    this.paintOverlay();
  }

  private paintOverlay(): void {
    if (!this.overlay) {
      return;
    }
    const current = this.overlay;
    renderOverlay(this.kit, current.title, current.body, () => {
      this.overlay = null;
      this.refreshCurrent();
    });
  }

  private refreshCurrent(): void {
    const name = this.kit.pageName;
    if (name === 'home') {
      this.renderHome();
      return;
    }
    if (name === 'talents') {
      this.renderTalentSelection();
      return;
    }
    if (name === 'history-regions') {
      this.renderHistoryRegions();
      return;
    }
    if (name === 'history-figures') {
      this.renderHistoryFigures();
      return;
    }
    if (name === 'loadout') {
      this.renderLegacyLoadout();
      return;
    }
    if (name === 'rewards') {
      this.renderRewardSelection();
      return;
    }
    if (name === 'result') {
      this.renderResult();
      return;
    }
    this.renderLife(this.autoPlaying);
  }

  private advanceOneYear(): void {
    if (this.advancing) {
      return;
    }
    this.advancing = true;
    try {
      const current = this.service.getCurrentRun();
      this.captureSnapshot(current);
      const run = this.service.advanceCurrentLife();
      if (run.status === 'active' && run.turnState === 'ready') {
        this.renderLife(true);
      } else if (run.status === 'active') {
        this.stopAutoPlay();
        this.renderLife();
      } else {
        this.stopAutoPlay();
        this.renderResult();
      }
    } catch (error) {
      this.stopAutoPlay();
      this.renderError(error);
    } finally {
      this.advancing = false;
    }
  }

  private toggleAutoPlay(): void {
    if (this.autoPlaying) {
      this.stopAutoPlay();
      this.renderLife();
      return;
    }
    const run = this.service.getCurrentRun();
    if (!run || run.status !== 'active' || run.turnState !== 'ready') {
      this.renderLife();
      return;
    }
    this.autoPlaying = true;
    this.schedule(this.autoTick, 0.45);
    this.renderLife(true);
  }

  private readonly autoTick = (): void => {
    this.advanceOneYear();
  };

  private stopAutoPlay(): void {
    if (!this.autoPlaying) {
      return;
    }
    this.unschedule(this.autoTick);
    this.autoPlaying = false;
  }

  private runCommand(work: () => void): void {
    if (this.submitting) {
      return;
    }
    this.submitting = true;
    try {
      work();
    } catch (error) {
      this.renderError(error);
    } finally {
      this.submitting = false;
    }
  }

  private captureSnapshot(run: LifeRun | null): void {
    if (!run) {
      this.snapshot = null;
      return;
    }
    this.snapshot = {
      resources: run.currentScenario ? { ...run.currentScenario.resources } : undefined,
      marks: (run.marks ?? []).map((mark) => ({ ...mark })),
    };
  }

  private createSeed(): number {
    const timePart = Date.now() >>> 0;
    const randomPart = Math.floor(Math.random() * 0xffff_ffff) >>> 0;
    const seed = (timePart ^ randomPart) >>> 0;
    return seed === 0 ? 1 : seed;
  }
}
