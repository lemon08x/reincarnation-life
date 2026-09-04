import {
  _decorator,
  Button,
  Color,
  Component,
  Graphics,
  Label,
  Layers,
  Node,
  ResolutionPolicy,
  UITransform,
  view,
} from 'cc';
import { GameService } from './app/gameService';
import {
  formatStatDelta,
  getAllocationPointTotal,
  getChoiceDisplayText,
  getCurrentLifeStage,
  getPendingEvent,
} from './core/lifeEngine';
import {
  emptyStats,
  LegacyCategory,
  STAT_KEYS,
  StatKey,
  Stats,
  TalentDraft,
} from './core/model';
import { getLevelProgress, getPermanentBenefits } from './core/progression';
import { CocosSaveStore } from './platform/cocosSaveStore';

const { ccclass } = _decorator;

const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;

const COLORS = {
  paper: new Color(244, 238, 225, 255),
  paperLight: new Color(252, 249, 242, 255),
  paperDark: new Color(226, 215, 194, 255),
  ink: new Color(43, 38, 31, 255),
  muted: new Color(111, 100, 84, 255),
  faint: new Color(189, 176, 153, 255),
  accent: new Color(174, 67, 47, 255),
  accentDark: new Color(128, 44, 32, 255),
  white: new Color(255, 252, 245, 255),
  disabled: new Color(181, 172, 157, 255),
  positive: new Color(53, 111, 82, 255),
};

const STAT_LABELS: Record<StatKey, string> = {
  health: '体魄',
  intellect: '心智',
  charm: '人缘',
  wealth: '家底',
};

@ccclass('GameApp')
export class GameApp extends Component {
  private service!: GameService;
  private screen: Node | null = null;
  private talentDraft: TalentDraft | null = null;
  private selectedTalentIds: string[] = [];
  private allocation: Stats = emptyStats();
  private autoPlaying = false;
  private advancing = false;
  private legacyPage = 0;

  public start(): void {
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.SHOW_ALL);
    this.service = new GameService(new CocosSaveStore(), () => this.createSeed());
    this.renderHome();
  }

  public onDestroy(): void {
    this.stopAutoPlay();
  }

  private renderHome(): void {
    this.stopAutoPlay();
    const screen = this.createScreen('Home');
    const profile = this.service.getProfile();
    const content = this.service.getContent();
    const benefits = getPermanentBenefits(profile, content);
    const levelProgress = getLevelProgress(profile, content);
    const currentRun = this.service.getCurrentRun();
    const ownedLegacies = this.service.getOwnedLegacies();
    const slotCount = this.service.getLegacySlotCount();

    this.addRings(screen, 0, 505);
    this.addLabel(screen, '轮　回', 0, 510, 580, 90, 58, COLORS.ink, true, true);
    this.addLabel(
      screen,
      '这一世可以失败，但不会白活',
      0,
      432,
      600,
      44,
      25,
      COLORS.muted,
      true,
    );

    this.addPanel(screen, 0, 145, 610, 425, COLORS.paperLight, 26, COLORS.paperDark);
    this.addLabel(screen, `轮回者 · ${profile.level} 级`, 0, 280, 520, 60, 37, COLORS.ink, true, true);
    this.addLabel(
      screen,
      `累计轮回经验　${profile.totalExp}`,
      0,
      225,
      520,
      45,
      23,
      COLORS.muted,
      true,
    );
    this.addProgressBar(screen, 0, 178, 470, 18, levelProgress.progress);

    const progressText = levelProgress.nextThreshold === null
      ? '当前已达到本版本最高轮回等级'
      : `距离下一等级还需 ${Math.max(0, levelProgress.nextThreshold - profile.totalExp)} 经验`;
    this.addLabel(screen, progressText, 0, 135, 520, 38, 21, COLORS.muted, true);

    const permanentText = [
      `永久初始属性　+${benefits.attributePointBonus}`,
      `天赋候选数量　${3 + benefits.talentCandidateBonus}`,
      `传承槽位　　　${profile.equippedLegacyIds.length}/${slotCount}`,
    ].join('\n');
    this.addLabel(screen, permanentText, -205, 15, 300, 125, 23, COLORS.ink, false, false, 40);
    this.addLabel(
      screen,
      levelProgress.nextRewardText ? `下一奖励\n${levelProgress.nextRewardText}` : '轮回之路\n仍会继续延伸',
      155,
      15,
      260,
      125,
      22,
      COLORS.accentDark,
      false,
      true,
      38,
    );

    const equippedNames = profile.equippedLegacyIds
      .map((id) => content.legacies.find((legacy) => legacy.id === id)?.name)
      .filter(Boolean)
      .join(' · ');
    const boonNames = profile.pendingBoonIds
      .map((id) => content.legacies.find((legacy) => legacy.id === id)?.name)
      .filter(Boolean)
      .join(' · ');
    this.addLabel(
      screen,
      equippedNames ? `本世装备：${equippedNames}` : '尚未装备永久传承',
      0,
      -92,
      540,
      34,
      19,
      COLORS.muted,
      true,
    );
    if (boonNames) {
      this.addLabel(screen, `下世祝福：${boonNames}`, 0, -128, 540, 34, 19, COLORS.positive, true);
    }

    if (currentRun?.status === 'active') {
      this.addButton(screen, '继续这一世', 0, -230, 540, 88, COLORS.accent, () => this.renderLife());
      this.addLabel(screen, `当前人生：${currentRun.age} 岁`, 0, -292, 520, 34, 20, COLORS.muted, true);
    } else if (currentRun?.status === 'reward-pending') {
      this.addButton(screen, '领取本世传承', 0, -230, 540, 88, COLORS.accent, () => this.renderResult());
      this.addLabel(screen, '选择奖励后才能开启下一世', 0, -292, 520, 34, 20, COLORS.muted, true);
    } else {
      this.addButton(screen, '开启新的一世', 0, -230, 540, 88, COLORS.accent, () => this.openTalentSelection());
      if (currentRun?.status === 'settled') {
        this.addButton(
          screen,
          '查看上一世结算',
          0,
          -332,
          540,
          68,
          COLORS.paperDark,
          () => this.renderResult(),
          true,
          COLORS.ink,
        );
      }
    }

    if (ownedLegacies.length > 0 && currentRun?.status !== 'active' && currentRun?.status !== 'reward-pending') {
      this.addTextAction(screen, '调整本世传承', 0, -422, () => {
        this.legacyPage = 0;
        this.renderLegacyLoadout();
      });
    }

    this.addLabel(
      screen,
      '每一段人生都将成为轮回者的一部分',
      0,
      -545,
      600,
      40,
      20,
      COLORS.faint,
      true,
    );
  }

  private openTalentSelection(): void {
    try {
      this.talentDraft = this.service.createTalentDraft();
      this.selectedTalentIds = [];
      this.allocation = emptyStats();
      this.renderTalentSelection();
    } catch (error) {
      this.renderError(error);
    }
  }

  private renderTalentSelection(): void {
    const screen = this.createScreen('Talents');
    const draft = this.talentDraft;
    if (!draft) {
      this.renderError(new Error('天赋候选尚未生成。'));
      return;
    }

    this.addSectionTitle(screen, '选择本世天赋', `从 ${draft.candidateIds.length} 项中选择 ${draft.requiredSelectionCount} 项`);
    const talents = draft.candidateIds.map((id) => this.service.getContent().talents.find((item) => item.id === id));
    const cardHeight = draft.candidateIds.length >= 5 ? 118 : 138;
    const spacing = cardHeight + 18;
    const firstY = 345;

    talents.forEach((talent, index) => {
      if (!talent) {
        return;
      }
      const selected = this.selectedTalentIds.includes(talent.id);
      const effects = formatStatDelta(talent.effects);
      const title = `${selected ? '◆ ' : ''}${talent.name}　${effects}`;
      const body = `${title}\n${talent.description}`;
      this.addButton(
        screen,
        body,
        0,
        firstY - index * spacing,
        610,
        cardHeight,
        selected ? new Color(237, 217, 199, 255) : COLORS.paperLight,
        () => this.toggleTalent(talent.id),
        true,
        selected ? COLORS.accentDark : COLORS.ink,
        24,
        selected ? COLORS.accent : COLORS.paperDark,
      );
    });

    const isReady = this.selectedTalentIds.length === draft.requiredSelectionCount;
    this.addButton(
      screen,
      isReady ? '分配初始属性' : `还需选择 ${draft.requiredSelectionCount - this.selectedTalentIds.length} 项`,
      0,
      -520,
      560,
      88,
      isReady ? COLORS.accent : COLORS.disabled,
      () => this.renderAllocation(),
      isReady,
    );
    this.addTextAction(screen, '返回轮回空间', 0, -585, () => this.renderHome());
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

  private renderAllocation(): void {
    const screen = this.createScreen('Allocation');
    const profile = this.service.getProfile();
    const totalPoints = getAllocationPointTotal(profile, this.service.getContent());
    const spentPoints = STAT_KEYS.reduce((sum, key) => sum + this.allocation[key], 0);
    const remaining = totalPoints - spentPoints;
    const talentNames = this.selectedTalentIds
      .map((id) => this.service.getContent().talents.find((talent) => talent.id === id)?.name)
      .filter(Boolean)
      .join(' · ');

    this.addSectionTitle(screen, '分配初始属性', `本世天赋：${talentNames}`);
    this.addLabel(screen, `剩余点数　${remaining}`, 0, 340, 520, 70, 38, remaining === 0 ? COLORS.positive : COLORS.accent, true, true);

    STAT_KEYS.forEach((key, index) => {
      const y = 205 - index * 145;
      this.addPanel(screen, 0, y, 590, 112, COLORS.paperLight, 20, COLORS.paperDark);
      this.addLabel(screen, STAT_LABELS[key], -190, y, 140, 60, 28, COLORS.ink, true, true);
      this.addButton(
        screen,
        '−',
        70,
        y,
        72,
        64,
        this.allocation[key] > 0 ? COLORS.paperDark : COLORS.disabled,
        () => this.adjustAllocation(key, -1),
        this.allocation[key] > 0,
        COLORS.ink,
        32,
      );
      this.addLabel(screen, String(this.allocation[key]), 165, y, 80, 64, 34, COLORS.ink, true, true);
      this.addButton(
        screen,
        '+',
        260,
        y,
        72,
        64,
        remaining > 0 ? COLORS.accent : COLORS.disabled,
        () => this.adjustAllocation(key, 1),
        remaining > 0,
        COLORS.white,
        31,
      );
    });

    this.addLabel(
      screen,
      `每项基础值为 2，天赋与家庭还会继续修正属性`,
      0,
      -395,
      590,
      50,
      21,
      COLORS.muted,
      true,
    );
    this.addButton(
      screen,
      remaining === 0 ? '投身这一世' : '请分配全部点数',
      0,
      -490,
      560,
      88,
      remaining === 0 ? COLORS.accent : COLORS.disabled,
      () => this.beginLife(),
      remaining === 0,
    );
    this.addTextAction(screen, '返回重选天赋', 0, -575, () => this.renderTalentSelection());
  }

  private adjustAllocation(key: StatKey, delta: number): void {
    const totalPoints = getAllocationPointTotal(this.service.getProfile(), this.service.getContent());
    const spentPoints = STAT_KEYS.reduce((sum, statKey) => sum + this.allocation[statKey], 0);
    if (delta > 0 && spentPoints >= totalPoints) {
      return;
    }
    if (delta < 0 && this.allocation[key] <= 0) {
      return;
    }
    this.allocation = {
      ...this.allocation,
      [key]: this.allocation[key] + delta,
    };
    this.renderAllocation();
  }

  private beginLife(): void {
    if (!this.talentDraft) {
      this.renderError(new Error('缺少本世天赋信息。'));
      return;
    }
    try {
      this.service.startNewLife(this.talentDraft, this.selectedTalentIds, this.allocation);
      this.renderLife();
    } catch (error) {
      this.renderError(error);
    }
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
    if (run.status !== 'active') {
      this.renderResult();
      return;
    }
    if (run.turnState === 'awaiting-focus') {
      this.stopAutoPlay();
      this.renderStageFocus();
      return;
    }
    if (run.turnState === 'awaiting-choice') {
      this.stopAutoPlay();
      this.renderDecision();
      return;
    }

    const screen = this.createScreen('Life');
    const content = this.service.getContent();
    const family = content.families.find((item) => item.id === run.familyId);
    const stage = getCurrentLifeStage(run, content);
    const focus = stage.focuses.find((item) => item.id === run.currentFocusId);
    const latest = run.history[run.history.length - 1];

    this.addLabel(screen, `${run.age}`, 0, 520, 240, 105, 82, COLORS.ink, true, true);
    this.addLabel(screen, '岁', 105, 500, 80, 50, 27, COLORS.muted, false);
    this.addLabel(
      screen,
      `${family?.name ?? '未知家庭'}　·　${stage.name}${focus ? `：${focus.name}` : ''}`,
      0,
      430,
      600,
      45,
      22,
      COLORS.muted,
      true,
    );

    STAT_KEYS.forEach((key, index) => {
      const x = -243 + index * 162;
      this.addPanel(screen, x, 345, 142, 86, COLORS.paperLight, 18, COLORS.paperDark);
      this.addLabel(screen, STAT_LABELS[key], x, 365, 126, 30, 19, COLORS.muted, true);
      this.addLabel(screen, String(run.stats[key]), x, 330, 126, 40, 29, COLORS.ink, true, true);
    });

    this.addPanel(screen, 0, 75, 620, 410, COLORS.paperLight, 28, COLORS.paperDark);
    this.addLabel(screen, `${latest.age} 岁`, -245, 230, 100, 45, 24, COLORS.accent, true, true);
    this.addLabel(screen, latest.text, 0, 80, 520, 230, 31, COLORS.ink, true, true, 48);
    const effectText = formatStatDelta(latest.effects) || '平稳度过';
    this.addLabel(screen, effectText, 0, -73, 520, 44, 22, COLORS.positive, true, true);

    const recent = run.history.slice(-4, -1).reverse();
    const historyText = recent.length > 0
      ? recent.map((entry) => `${entry.age} 岁　${this.truncate(entry.text, 22)}`).join('\n')
      : '人生刚刚开始，尚无往事可回看。';
    this.addLabel(screen, historyText, 0, -235, 570, 140, 20, COLORS.muted, false, false, 38);

    this.addButton(
      screen,
      '继续人生',
      -150,
      -465,
      280,
      88,
      COLORS.accent,
      () => this.advanceOneYear(),
    );
    this.addButton(
      screen,
      this.autoPlaying ? '暂停快进' : '快进至抉择',
      170,
      -465,
      260,
      88,
      this.autoPlaying ? COLORS.accentDark : COLORS.paperDark,
      () => this.toggleAutoPlay(),
      true,
      this.autoPlaying ? COLORS.white : COLORS.ink,
    );
    this.addTextAction(screen, '返回轮回空间（本世已自动保存）', 0, -565, () => this.renderHome());
  }

  private renderStageFocus(): void {
    const run = this.service.getCurrentRun();
    if (!run || run.status !== 'active' || run.turnState !== 'awaiting-focus') {
      this.renderLife();
      return;
    }
    const stage = getCurrentLifeStage(run, this.service.getContent());
    const screen = this.createScreen('StageFocus');
    const timing = run.age < stage.minAge
      ? `即将进入 ${stage.minAge}—${stage.maxAge} 岁的${stage.name}`
      : `${stage.minAge}—${stage.maxAge} 岁 · ${stage.name}`;

    this.addSectionTitle(screen, `这一程，想怎样度过？`, timing);
    this.addLabel(
      screen,
      '你的选择会立刻带来一点成长，并让这一阶段更常遇见相关经历。',
      0,
      395,
      590,
      55,
      21,
      COLORS.muted,
      true,
    );

    stage.focuses.forEach((focus, index) => {
      this.addButton(
        screen,
        `${focus.name}\n${focus.description}`,
        0,
        245 - index * 205,
        610,
        170,
        COLORS.paperLight,
        () => this.selectStageFocus(focus.id),
        true,
        COLORS.ink,
        24,
        COLORS.paperDark,
      );
    });

    this.addTextAction(screen, '返回轮回空间（稍后再选）', 0, -565, () => this.renderHome());
  }

  private selectStageFocus(focusId: string): void {
    try {
      this.service.chooseCurrentStageFocus(focusId);
      this.renderLife();
    } catch (error) {
      this.renderError(error);
    }
  }

  private renderDecision(): void {
    const run = this.service.getCurrentRun();
    if (!run || run.status !== 'active' || run.turnState !== 'awaiting-choice' || !run.pendingDecision) {
      this.renderLife();
      return;
    }
    const content = this.service.getContent();
    const event = getPendingEvent(run, content);
    const choices = run.pendingDecision.choiceIds
      .map((choiceId) => event.choices?.find((choice) => choice.id === choiceId))
      .filter((choice): choice is NonNullable<typeof choice> => Boolean(choice));
    const screen = this.createScreen('Decision');
    const sourceText = run.pendingDecision.sourceChoiceId
      ? '这是往日选择的回响，无法改写'
      : '关键时刻 · 由你决定接下来怎么走';

    this.addSectionTitle(screen, `${run.age} 岁 · 需要你的选择`, sourceText);
    this.addPanel(screen, 0, 342, 610, 150, COLORS.paperLight, 24, COLORS.paperDark);
    this.addLabel(screen, event.text, 0, 342, 550, 112, 27, COLORS.ink, true, true, 38, true);

    const choiceHeight = choices.length >= 4 ? 126 : 146;
    const spacing = choices.length >= 4 ? 138 : 162;
    const firstY = 202;
    choices.forEach((choice, index) => {
      this.addButton(
        screen,
        getChoiceDisplayText(run, choice),
        0,
        firstY - index * spacing,
        610,
        choiceHeight,
        COLORS.paperLight,
        () => this.selectEventChoice(choice.id),
        true,
        COLORS.ink,
        22,
        COLORS.paperDark,
      );
    });

    const canReroll = run.fate.eventRerollsRemaining > 0 && !run.pendingDecision.sourceChoiceId;
    if (canReroll) {
      this.addTextAction(
        screen,
        `改写这次遭遇（本世剩余 ${run.fate.eventRerollsRemaining} 次）`,
        0,
        -500,
        () => this.rerollDecision(),
      );
    }
    this.addTextAction(screen, '返回轮回空间（选择已保存）', 0, -570, () => this.renderHome());
  }

  private selectEventChoice(choiceId: string): void {
    try {
      this.service.resolveCurrentChoice(choiceId);
      this.renderLife();
    } catch (error) {
      this.renderError(error);
    }
  }

  private rerollDecision(): void {
    try {
      this.service.rerollCurrentDecision();
      this.renderDecision();
    } catch (error) {
      this.renderError(error);
    }
  }

  private advanceOneYear(): void {
    if (this.advancing) {
      return;
    }
    this.advancing = true;
    try {
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

  private renderResult(): void {
    this.stopAutoPlay();
    const run = this.service.getCurrentRun();
    if (!run?.settlement || !run.endingId) {
      this.renderError(new Error('当前没有可展示的人生结算。'));
      return;
    }
    const screen = this.createScreen('Result');
    const profile = this.service.getProfile();
    const content = this.service.getContent();
    const ending = content.endings.find((item) => item.id === run.endingId);
    const settlement = run.settlement;
    const progress = getLevelProgress(profile, content);

    this.addLabel(screen, '本世已终', 0, 520, 580, 55, 25, COLORS.muted, true);
    this.addLabel(screen, ending?.title ?? '人生落幕', 0, 448, 610, 80, 48, COLORS.ink, true, true);
    this.addLabel(screen, ending?.description ?? '', 0, 370, 570, 80, 23, COLORS.muted, true, false, 34);

    this.addPanel(screen, 0, 55, 610, 500, COLORS.paperLight, 28, COLORS.paperDark);
    this.addLabel(screen, `${run.age} 岁`, -185, 230, 180, 60, 35, COLORS.ink, true, true);
    this.addLabel(screen, `人生评价 ${settlement.score}`, 140, 230, 250, 60, 28, COLORS.ink, true, true);
    this.addLabel(screen, run.endReason ?? '', 0, 160, 520, 62, 22, COLORS.muted, true, false, 31);
    this.addDivider(screen, 0, 112, 500);

    this.addLabel(screen, `本世获得　+${settlement.earnedExp} 轮回经验`, 0, 58, 530, 52, 29, COLORS.accentDark, true, true);
    const expDetails = [
      `基础 ${settlement.baseExp}`,
      `人生评价 ${settlement.performanceExp}`,
      settlement.firstDiscoveryExp > 0 ? `新结局 ${settlement.firstDiscoveryExp}` : null,
    ].filter(Boolean).join('　');
    this.addLabel(screen, expDetails, 0, 12, 520, 36, 20, COLORS.muted, true);

    const levelText = settlement.newLevel > settlement.previousLevel
      ? `轮回者升级　${settlement.previousLevel} → ${settlement.newLevel}`
      : `轮回者等级　${profile.level}`;
    this.addLabel(screen, levelText, 0, -55, 520, 46, 27, COLORS.ink, true, true);
    const rewardText = settlement.newRewardTexts.length > 0
      ? settlement.newRewardTexts.join('\n')
      : progress.nextThreshold === null
        ? '本版本轮回等级已满'
        : `再获得 ${Math.max(0, progress.nextThreshold - profile.totalExp)} 经验可解锁：${progress.nextRewardText}`;
    this.addLabel(screen, rewardText, 0, -135, 520, 100, 21, COLORS.positive, true, false, 32);

    if (run.status === 'reward-pending') {
      this.addButton(
        screen,
        '选择轮回传承',
        0,
        -310,
        560,
        92,
        COLORS.accent,
        () => this.renderRewardSelection(),
      );
    } else {
      const selectedReward = content.legacies.find((legacy) => legacy.id === settlement.selectedRewardId);
      if (selectedReward) {
        this.addLabel(
          screen,
          `本世传承：${selectedReward.name} · ${this.getLegacyCategoryLabel(selectedReward.category)}`,
          0,
          -245,
          540,
          42,
          21,
          COLORS.positive,
          true,
          true,
        );
      }
      this.addButton(
        screen,
        '带着传承再活一世',
        0,
        -330,
        560,
        92,
        COLORS.accent,
        () => this.openTalentSelection(),
      );
    }
    this.addButton(
      screen,
      '返回轮回空间',
      0,
      -450,
      560,
      74,
      COLORS.paperDark,
      () => this.renderHome(),
      true,
      COLORS.ink,
    );
  }

  private renderRewardSelection(): void {
    const run = this.service.getCurrentRun();
    if (!run?.settlement || run.status !== 'reward-pending') {
      this.renderResult();
      return;
    }
    const content = this.service.getContent();
    const rewards = run.settlement.rewardOfferIds
      .map((rewardId) => content.legacies.find((legacy) => legacy.id === rewardId))
      .filter((legacy): legacy is NonNullable<typeof legacy> => Boolean(legacy));
    const profile = this.service.getProfile();
    const screen = this.createScreen('RewardSelection');

    this.addSectionTitle(screen, '选择一份轮回传承', '三选一 · 不同传承会改变下一世的玩法');
    rewards.forEach((legacy, index) => {
      const currentRank = profile.legacyRanks[legacy.id] ?? 0;
      const persistence = legacy.persistence === 'permanent'
        ? `永久 · 获得后 ${currentRank + 1}/${legacy.maxRank} 阶`
        : '祝福 · 仅下一世生效';
      this.addButton(
        screen,
        `${this.getLegacyCategoryLabel(legacy.category)}｜${legacy.name}\n${legacy.description}\n${persistence}`,
        0,
        270 - index * 245,
        610,
        210,
        COLORS.paperLight,
        () => this.claimReward(legacy.id),
        true,
        COLORS.ink,
        22,
        index === 0 ? COLORS.accent : COLORS.paperDark,
      );
    });
    this.addTextAction(screen, '返回查看本世结算', 0, -565, () => this.renderResult());
  }

  private claimReward(rewardId: string): void {
    try {
      this.service.claimCurrentReward(rewardId);
      this.renderResult();
    } catch (error) {
      this.renderError(error);
    }
  }

  private renderLegacyLoadout(): void {
    const profile = this.service.getProfile();
    const legacies = this.service.getOwnedLegacies();
    const slotCount = this.service.getLegacySlotCount();
    const pageSize = 3;
    const pageCount = Math.max(1, Math.ceil(legacies.length / pageSize));
    this.legacyPage = Math.max(0, Math.min(this.legacyPage, pageCount - 1));
    const pageItems = legacies.slice(this.legacyPage * pageSize, (this.legacyPage + 1) * pageSize);
    const screen = this.createScreen('LegacyLoadout');

    this.addSectionTitle(
      screen,
      '装配轮回传承',
      `已装备 ${profile.equippedLegacyIds.length}/${slotCount} · 新人生开始前可随时调整`,
    );
    pageItems.forEach((legacy, index) => {
      const equipped = profile.equippedLegacyIds.includes(legacy.id);
      const hasRoom = profile.equippedLegacyIds.length < slotCount;
      this.addButton(
        screen,
        `${equipped ? '◆ 已装备' : '◇ 未装备'}　${this.getLegacyCategoryLabel(legacy.category)}｜${legacy.name}　${profile.legacyRanks[legacy.id]}/${legacy.maxRank} 阶\n${legacy.description}`,
        0,
        270 - index * 225,
        610,
        190,
        equipped ? new Color(237, 217, 199, 255) : COLORS.paperLight,
        () => this.toggleLegacy(legacy.id),
        equipped || hasRoom,
        equipped ? COLORS.accentDark : COLORS.ink,
        22,
        equipped ? COLORS.accent : COLORS.paperDark,
      );
    });

    if (pageCount > 1) {
      this.addButton(
        screen,
        '上一页',
        -190,
        -440,
        190,
        64,
        this.legacyPage > 0 ? COLORS.paperDark : COLORS.disabled,
        () => {
          this.legacyPage -= 1;
          this.renderLegacyLoadout();
        },
        this.legacyPage > 0,
        COLORS.ink,
        22,
      );
      this.addLabel(screen, `${this.legacyPage + 1} / ${pageCount}`, 0, -440, 120, 50, 21, COLORS.muted, true);
      this.addButton(
        screen,
        '下一页',
        190,
        -440,
        190,
        64,
        this.legacyPage < pageCount - 1 ? COLORS.paperDark : COLORS.disabled,
        () => {
          this.legacyPage += 1;
          this.renderLegacyLoadout();
        },
        this.legacyPage < pageCount - 1,
        COLORS.ink,
        22,
      );
    }
    this.addTextAction(screen, '返回轮回空间', 0, -565, () => this.renderHome());
  }

  private toggleLegacy(legacyId: string): void {
    try {
      this.service.toggleEquippedLegacy(legacyId);
      this.renderLegacyLoadout();
    } catch (error) {
      this.renderError(error);
    }
  }

  private getLegacyCategoryLabel(category: LegacyCategory): string {
    const labels: Record<LegacyCategory, string> = {
      origin: '出身',
      fate: '命运',
      path: '道路',
      story: '故事',
      boon: '下世祝福',
    };
    return labels[category];
  }

  private renderError(error: unknown): void {
    this.stopAutoPlay();
    const screen = this.createScreen('Error');
    const message = error instanceof Error ? error.message : String(error);
    console.error(error);
    this.addLabel(screen, '这一世暂时停住了', 0, 220, 590, 80, 42, COLORS.ink, true, true);
    this.addPanel(screen, 0, 10, 590, 250, COLORS.paperLight, 24, COLORS.paperDark);
    this.addLabel(screen, message, 0, 10, 510, 180, 23, COLORS.accentDark, true, false, 34);
    this.addButton(screen, '返回轮回空间', 0, -220, 520, 86, COLORS.accent, () => this.renderHome());
  }

  private createScreen(name: string): Node {
    if (this.screen?.isValid) {
      this.screen.destroy();
    }
    const screen = new Node(`RuntimeScreen:${name}`);
    screen.layer = Layers.Enum.UI_2D;
    const transform = screen.addComponent(UITransform);
    transform.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
    this.node.addChild(screen);
    this.screen = screen;
    this.addPanel(screen, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLORS.paper, 0);
    this.addTimelineMark(screen);
    return screen;
  }

  private addSectionTitle(parent: Node, title: string, subtitle: string): void {
    this.addLabel(parent, title, 0, 535, 620, 70, 43, COLORS.ink, true, true);
    this.addLabel(parent, subtitle, 0, 475, 620, 45, 22, COLORS.muted, true);
    this.addDivider(parent, 0, 438, 570);
  }

  private addTimelineMark(parent: Node): void {
    const node = this.createNode(parent, 'TimelineMark', -328, 0, 4, DESIGN_HEIGHT);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(201, 187, 162, 150);
    graphics.rect(-2, -DESIGN_HEIGHT / 2, 4, DESIGN_HEIGHT);
    graphics.fill();
  }

  private addRings(parent: Node, x: number, y: number): void {
    const node = this.createNode(parent, 'Rings', x, y, 300, 220);
    const graphics = node.addComponent(Graphics);
    graphics.lineWidth = 2;
    graphics.strokeColor = new Color(174, 67, 47, 35);
    for (let radius = 48; radius <= 138; radius += 22) {
      graphics.circle(0, 0, radius);
      graphics.stroke();
    }
  }

  private addPanel(
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: Color,
    radius: number,
    border?: Color,
  ): Node {
    const node = this.createNode(parent, 'Panel', x, y, width, height);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = fill;
    if (radius > 0) {
      graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    } else {
      graphics.rect(-width / 2, -height / 2, width, height);
    }
    graphics.fill();
    if (border) {
      graphics.lineWidth = 2;
      graphics.strokeColor = border;
      if (radius > 0) {
        graphics.roundRect(-width / 2, -height / 2, width, height, radius);
      } else {
        graphics.rect(-width / 2, -height / 2, width, height);
      }
      graphics.stroke();
    }
    return node;
  }

  private addButton(
    parent: Node,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: Color,
    onClick: () => void,
    enabled = true,
    textColor: Color = COLORS.white,
    fontSize = 27,
    border?: Color,
  ): Node {
    const node = this.addPanel(parent, x, y, width, height, fill, 20, border);
    node.name = `Button:${text.split('\n')[0]}`;
    const button = node.addComponent(Button);
    button.interactable = enabled;
    button.transition = Button.Transition.NONE;
    if (enabled) {
      node.on(Button.EventType.CLICK, onClick, this);
    }
    this.addLabel(node, text, 0, 0, width - 34, height - 18, fontSize, textColor, true, true, Math.round(fontSize * 1.42), true);
    return node;
  }

  private addTextAction(parent: Node, text: string, x: number, y: number, onClick: () => void): void {
    const node = this.createNode(parent, `TextAction:${text}`, x, y, 590, 48);
    const button = node.addComponent(Button);
    button.transition = Button.Transition.NONE;
    node.on(Button.EventType.CLICK, onClick, this);
    this.addLabel(node, text, 0, 0, 580, 46, 20, COLORS.muted, true);
  }

  private addLabel(
    parent: Node,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    color: Color,
    centered: boolean,
    bold = false,
    lineHeight = Math.round(fontSize * 1.35),
    shrink = false,
  ): Label {
    const node = this.createNode(parent, `Label:${text.slice(0, 12)}`, x, y, width, height);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = lineHeight;
    label.color = color;
    label.isBold = bold;
    label.enableWrapText = true;
    label.horizontalAlign = centered ? Label.HorizontalAlign.CENTER : Label.HorizontalAlign.LEFT;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = shrink ? Label.Overflow.SHRINK : Label.Overflow.CLAMP;
    label.useSystemFont = true;
    label.fontFamily = 'Arial';
    return label;
  }

  private addProgressBar(parent: Node, x: number, y: number, width: number, height: number, progress: number): void {
    const node = this.createNode(parent, 'ProgressBar', x, y, width, height);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = COLORS.paperDark;
    graphics.roundRect(-width / 2, -height / 2, width, height, height / 2);
    graphics.fill();
    const fillWidth = Math.max(height, Math.min(width, width * progress));
    graphics.fillColor = COLORS.accent;
    graphics.roundRect(-width / 2, -height / 2, fillWidth, height, height / 2);
    graphics.fill();
  }

  private addDivider(parent: Node, x: number, y: number, width: number): void {
    const node = this.createNode(parent, 'Divider', x, y, width, 2);
    const graphics = node.addComponent(Graphics);
    graphics.strokeColor = COLORS.paperDark;
    graphics.lineWidth = 2;
    graphics.moveTo(-width / 2, 0);
    graphics.lineTo(width / 2, 0);
    graphics.stroke();
  }

  private createNode(
    parent: Node,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    node.setPosition(x, y, 0);
    parent.addChild(node);
    return node;
  }

  private truncate(text: string, maxLength: number): string {
    return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
  }

  private createSeed(): number {
    const timePart = Date.now() >>> 0;
    const randomPart = Math.floor(Math.random() * 0xffff_ffff) >>> 0;
    const seed = (timePart ^ randomPart) >>> 0;
    return seed === 0 ? 1 : seed;
  }
}
