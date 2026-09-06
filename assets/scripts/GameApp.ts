import { _decorator, Component, ResolutionPolicy, view } from 'cc';
import { GameService } from './app/gameService';
import {
  presentCarry,
  presentCausality,
  presentEncounter,
  presentEnding,
  presentHome,
  presentRecall,
  routePlayPage,
} from './app/presentation/presenters';
import { RecallStance } from './core/model';
import { CocosSaveStore } from './platform/cocosSaveStore';
import { UiKit } from './ui/kit';
import {
  renderCarry,
  renderCausality,
  renderEncounter,
  renderEnding,
  renderError,
  renderHome,
  renderOverlay,
  renderRecall,
} from './ui/pages';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './ui/theme';

const { ccclass } = _decorator;

@ccclass('GameApp')
export class GameApp extends Component {
  private service!: GameService;
  private kit!: UiKit;
  private submitting = false;
  private selectedChoiceId: string | null = null;
  private selectedRecall: RecallStance | null = null;
  private selectedCarryIds: string[] = [];
  private browseId: string | null = null;
  private returnPage: 'encounter' | 'recall' | 'ending' | 'home' = 'home';
  private overlay: { title: string; body: string } | null = null;
  private lastEncounterKey = '';

  public start(): void {
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.SHOW_ALL);
    this.service = new GameService(new CocosSaveStore(), () => this.createSeed());
    this.kit = new UiKit(this, this.node);
    this.renderHome();
  }

  public onDestroy(): void {
    this.kit?.clearPage();
  }

  private renderHome(): void {
    this.overlay = null;
    const viewModel = presentHome(this.service.getProfile(), this.service.getCurrentRun());
    renderHome(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      continueLife: () => this.renderLife(),
      archiveLife: () => this.runCommand(() => {
        this.service.archiveCurrentLife();
        this.renderEnding();
      }),
      startLife: () => this.openCarryOrStart(),
      lastResult: () => this.renderEnding(),
    });
  }

  private openCarryOrStart(): void {
    const candidates = this.service.listCarryCandidates();
    if (candidates.length === 0) {
      this.runCommand(() => {
        this.service.startNewLife([]);
        this.renderLife();
      });
      return;
    }
    this.selectedCarryIds = [];
    this.renderCarry();
  }

  private renderCarry(): void {
    const viewModel = presentCarry(this.service.listCarryCandidates(), this.selectedCarryIds);
    renderCarry(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      toggle: (id) => {
        if (this.selectedCarryIds.includes(id)) {
          this.selectedCarryIds = this.selectedCarryIds.filter((item) => item !== id);
        } else if (this.selectedCarryIds.length < 2) {
          this.selectedCarryIds = [...this.selectedCarryIds, id];
        }
        this.renderCarry();
      },
      begin: () => this.runCommand(() => {
        this.service.startNewLife(this.selectedCarryIds);
        this.renderLife();
      }),
      skip: () => this.runCommand(() => {
        this.service.startNewLife([]);
        this.renderLife();
      }),
    });
    this.paintOverlay();
  }

  private renderLife(): void {
    const run = this.service.getCurrentRun();
    const page = routePlayPage(run);
    if (page === 'ending') {
      this.renderEnding();
      return;
    }
    if (page === 'recall') {
      this.renderRecall();
      return;
    }
    if (page === 'encounter') {
      this.renderEncounter();
      return;
    }
    this.renderHome();
  }

  private renderEncounter(): void {
    const run = this.service.getCurrentRun();
    if (!run?.pendingEncounter || run.status !== 'active') {
      this.renderLife();
      return;
    }
    if (this.lastEncounterKey !== run.pendingEncounter.instanceId) {
      this.lastEncounterKey = run.pendingEncounter.instanceId;
      this.selectedChoiceId = null;
    }
    const viewModel = presentEncounter(run, this.service.getContent(), this.selectedChoiceId);
    renderEncounter(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      select: (id) => {
        this.selectedChoiceId = id;
        this.renderEncounter();
      },
      confirm: () => {
        if (!this.selectedChoiceId) {
          return;
        }
        this.runCommand(() => {
          this.service.submitCurrentResponse(this.selectedChoiceId as string);
          this.selectedChoiceId = null;
          this.renderLife();
        });
      },
      openPast: (id) => this.openCausality(id, 'encounter'),
    });
    this.paintOverlay();
  }

  private renderRecall(): void {
    const run = this.service.getCurrentRun();
    if (!run?.pendingRecall || run.status !== 'active') {
      this.renderLife();
      return;
    }
    const viewModel = presentRecall(run, this.selectedRecall);
    renderRecall(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      select: (stance) => {
        this.selectedRecall = stance;
        this.renderRecall();
      },
      confirm: () => {
        if (!this.selectedRecall) {
          return;
        }
        this.runCommand(() => {
          this.service.submitCurrentRecall(this.selectedRecall as RecallStance);
          this.selectedRecall = null;
          this.renderLife();
        });
      },
      openPast: (index) => {
        const id = run.pendingRecall?.fragmentIds[index];
        if (id) {
          this.openCausality(id, 'recall');
        }
      },
    });
    this.paintOverlay();
  }

  private renderEnding(): void {
    const run = this.service.getCurrentRun();
    if (!run?.closing) {
      this.renderError(new Error('当前没有可展示的人生收束。'));
      return;
    }
    const viewModel = presentEnding(run, this.service.getContent());
    renderEnding(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      archive: () => this.runCommand(() => {
        this.service.archiveCurrentLife();
        this.openCarryOrStart();
      }),
      nextLife: () => this.openCarryOrStart(),
    });
    this.paintOverlay();
  }

  private openCausality(id: string, from: 'encounter' | 'recall' | 'ending' | 'home'): void {
    this.browseId = id;
    this.returnPage = from;
    this.renderCausality();
  }

  private renderCausality(): void {
    const id = this.browseId;
    if (!id) {
      this.returnFromCausality();
      return;
    }
    const record = this.service.inspectCausality(id);
    if (!record) {
      this.showOverlay('往事', '这段记录暂时找不到了。');
      this.returnFromCausality();
      return;
    }
    const viewModel = presentCausality(record);
    renderCausality(this.kit, viewModel, {
      goHome: () => this.renderHome(),
      expand: (_key, title, body) => this.showOverlay(title, body),
      back: () => this.returnFromCausality(),
      openSource: (sourceId) => this.openCausality(sourceId, this.returnPage),
    });
    this.paintOverlay();
  }

  private returnFromCausality(): void {
    this.browseId = null;
    if (this.returnPage === 'recall') {
      this.renderRecall();
      return;
    }
    if (this.returnPage === 'ending') {
      this.renderEnding();
      return;
    }
    if (this.returnPage === 'encounter') {
      this.renderEncounter();
      return;
    }
    this.renderHome();
  }

  private renderError(error: unknown): void {
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
    if (name === 'carry') {
      this.renderCarry();
      return;
    }
    if (name === 'causality') {
      this.renderCausality();
      return;
    }
    if (name === 'ending') {
      this.renderEnding();
      return;
    }
    this.renderLife();
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

  private createSeed(): number {
    const timePart = Date.now() >>> 0;
    const randomPart = Math.floor(Math.random() * 0xffff_ffff) >>> 0;
    const seed = (timePart ^ randomPart) >>> 0;
    return seed === 0 ? 1 : seed;
  }
}
