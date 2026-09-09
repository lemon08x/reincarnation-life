import {
  Button,
  BlockInputEvents,
  Color,
  Component,
  Graphics,
  Label,
  Layers,
  Mask,
  Node,
  ScrollView,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
  Vec2,
  tween,
} from 'cc';
import { TruncatedText } from '../app/presentation/uiModels';
import { textHeight } from '../app/presentation/journalLayout';
import { DESIGN_HEIGHT, DESIGN_WIDTH, SafeLayout, THEME, TYPE, computeLayout } from './theme';

export type ClickHandler = () => void;

export class UiKit {
  public host: Node;
  public layout: SafeLayout;
  public screen: Node | null = null;
  public sceneLayer: Node | null = null;
  public hudLayer: Node | null = null;
  public pageName = '';
  private readonly owner: Component;
  private readonly ticks: Array<(time: number) => void> = [];
  private elapsed = 0;
  private looping = false;
  private currentScroll: ScrollView | null = null;
  private scrollOffsets = new Map<string, number>();

  public constructor(owner: Component, host: Node) {
    this.owner = owner;
    this.host = host;
    this.layout = computeLayout();
  }

  public beginPage(name: string, keepScene = false): { screen: Node; scene: Node; hud: Node } {
    if (this.currentScroll?.isValid) this.scrollOffsets.set(this.pageName, Math.max(0, this.currentScroll.getScrollOffset().y));
    this.currentScroll = null;
    this.layout = computeLayout();
    const reuse = keepScene && this.pageName === name && this.screen?.isValid && this.sceneLayer?.isValid && this.hudLayer?.isValid;
    if (!reuse) {
      this.stopMotion();
      if (this.screen?.isValid) {
        this.screen.destroy();
      }
      const screen = this.createNode(this.host, `RuntimeScreen:${name}`, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
      this.fillPanel(screen, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, THEME.cream, 0);
      this.sceneLayer = this.createNode(screen, 'SceneLayer', 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
      this.hudLayer = this.createNode(screen, 'HudLayer', 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
      this.screen = screen;
    } else if (this.hudLayer) {
      Tween.stopAllByTarget(this.hudLayer);
      this.hudLayer.children.slice().forEach(child => child.destroy());
    }
    this.pageName = name;
    this.startLoop();
    return {
      screen: this.screen as Node,
      scene: this.sceneLayer as Node,
      hud: this.hudLayer as Node,
    };
  }

  public clearPage(): void {
    this.stopMotion();
    if (this.screen?.isValid) {
      this.screen.destroy();
    }
    this.screen = null;
    this.sceneLayer = null;
    this.hudLayer = null;
    this.pageName = '';
  }

  public animate(tick: (time: number) => void): void {
    this.ticks.push(tick);
  }

  public floatLabel(parent: Node, text: string, x: number, y: number, color: Color): void {
    const label = this.label(parent, text, x, y, 220, 36, TYPE.caption, color, true, true);
    const opacity = label.node.addComponent(UIOpacity);
    opacity.opacity = 255;
    const start = label.node.position;
    tween(label.node)
      .to(0.7, { position: new Vec3(start.x, start.y + 36, start.z) })
      .start();
    tween(opacity).delay(0.15).to(0.55, { opacity: 0 }).start();
  }

  public panel(
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
    fill = THEME.panel,
    radius = 22,
    border = THEME.panelBorder,
  ): Node {
    return this.fillPanel(parent, x, y, width, height, fill, radius, border);
  }

  public label(
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
  ): Label {
    const node = this.createNode(parent, `Label:${text.slice(0, 10)}`, x, y, width, height);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = lineHeight;
    label.color = color;
    label.isBold = bold;
    label.enableWrapText = true;
    label.horizontalAlign = centered ? Label.HorizontalAlign.CENTER : Label.HorizontalAlign.LEFT;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.CLAMP;
    label.useSystemFont = true;
    label.fontFamily = 'Arial';
    return label;
  }

  public button(
    parent: Node,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: Color,
    onClick: ClickHandler,
    enabled = true,
    textColor: Color = THEME.white,
    fontSize = 24,
  ): Node {
    const touchH = Math.max(height, this.layout.minTouch);
    const node = this.panel(parent, x, y, width, touchH, enabled ? fill : THEME.disabled, 20, enabled ? undefined : THEME.panelBorder);
    node.name = `Button:${text.split('\n')[0]}`;
    const button = node.addComponent(Button);
    button.interactable = enabled;
    button.transition = Button.Transition.NONE;
    if (enabled) {
      node.on(Button.EventType.CLICK, onClick, this.owner);
    }
    this.label(node, text, 0, 0, width - 28, touchH - 16, fontSize, enabled ? textColor : THEME.muted, true, true);
    return node;
  }

  public textAction(parent: Node, text: string, x: number, y: number, onClick: ClickHandler, width = 240): Node {
    const height = Math.max(48, this.layout.minTouch);
    const node = this.createNode(parent, `TextAction:${text}`, x, y, width, height);
    const button = node.addComponent(Button);
    button.transition = Button.Transition.NONE;
    node.on(Button.EventType.CLICK, onClick, this.owner);
    this.label(node, text, 0, 0, width - 8, height - 4, 24, THEME.muted, true);
    return node;
  }

  public progress(parent: Node, x: number, y: number, width: number, height: number, value: number, fill = THEME.coral): void {
    const node = this.createNode(parent, 'Progress', x, y, width, height);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = THEME.creamDeep;
    graphics.roundRect(-width / 2, -height / 2, width, height, height / 2);
    graphics.fill();
    const fillWidth = Math.max(height, Math.min(width, width * Math.max(0, Math.min(1, value))));
    graphics.fillColor = fill;
    graphics.roundRect(-width / 2, -height / 2, fillWidth, height, height / 2);
    graphics.fill();
  }

  public expandable(
    parent: Node,
    story: TruncatedText,
    x: number,
    y: number,
    width: number,
    height: number,
    onExpand: ClickHandler,
  ): void {
    this.label(parent, story.preview, x, y + (story.expandable ? 12 : 0), width, height - (story.expandable ? 24 : 0), TYPE.body, THEME.ink, true, false, 32);
    if (story.expandable) {
      this.textAction(parent, '展开全文', x, y - height / 2 + 18, onExpand);
    }
  }

  public overlay(parent: Node, title: string, body: string, onClose: ClickHandler): void {
    const veil = this.createNode(parent, 'Overlay', 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    veil.addComponent(BlockInputEvents);
    const graphics = veil.addComponent(Graphics);
    graphics.fillColor = new Color(43, 38, 31, 140);
    graphics.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
    graphics.fill();
    const card = this.panel(veil, 0, 20, 620, 760, THEME.white, 28, THEME.coral);
    this.label(card, title, 0, 320, 540, 48, TYPE.subtitle, THEME.ink, true, true);
    this.scrollText(card, body, 0, 20, 540, 560);
    this.button(card, '收起', 0, -320, 280, 64, THEME.coralDeep, () => { veil.destroy(); onClose(); });
  }

  public scrollArea(parent: Node, x: number, y: number, width: number, height: number, contentHeight: number): Node {
    const root = this.createNode(parent, 'Scroll', x, y, width, height);
    const mask = root.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;
    const content = this.createNode(root, 'Content', 0, (height - contentHeight) / 2, width, contentHeight);
    const scroll = root.addComponent(ScrollView);
    scroll.horizontal = false;
    scroll.vertical = true;
    scroll.inertia = false;
    scroll.elastic = false;
    scroll.brake = 0.5;
    scroll.content = content;
    if (parent === this.hudLayer) {
      this.currentScroll = scroll;
      const offset = Math.min(this.scrollOffsets.get(this.pageName) ?? 0, Math.max(0, contentHeight - height));
      scroll.scrollToOffset(new Vec2(0, offset), 0);
    }
    return content;
  }

  public createNode(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    node.setPosition(x, y, 0);
    parent.addChild(node);
    return node;
  }

  private fillPanel(
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

  private scrollText(parent: Node, text: string, x: number, y: number, width: number, height: number): void {
    const contentHeight = Math.max(height, textHeight(text, width - 12, 30, 44));
    const content = this.scrollArea(parent, x, y, width, height, contentHeight);
    const label = this.label(content, text, 0, 0, width - 12, contentHeight, 30, THEME.ink, false, false, 44);
    label.verticalAlign = Label.VerticalAlign.TOP;
  }

  private startLoop(): void {
    if (this.looping) {
      return;
    }
    this.looping = true;
    this.elapsed = 0;
    this.owner.schedule(this.onTick, 0);
  }

  private stopMotion(): void {
    this.ticks.length = 0;
    this.owner.unschedule(this.onTick);
    this.looping = false;
    if (this.screen?.isValid) {
      Tween.stopAllByTarget(this.screen);
    }
  }

  private readonly onTick = (dt: number): void => {
    this.elapsed += dt;
    for (const tick of this.ticks) {
      tick(this.elapsed);
    }
  };
}
