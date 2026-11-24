import * as Phaser from 'phaser';
import type { Controls } from '../input';
import { OVERRIDE_ANCHOR } from '../spriteOverrides';
import { KYUBI_CHAKRA_DRAIN_PER_SEC, KYUBI_DAMAGE_MULT, KYUBI_MIN_CHAKRA, KYUBI_RASENGAN_COST, KYUBI_SPEED_MULT, PowerState, PUNCH_DAMAGE, RASENGAN_COST, RASENGAN_DAMAGE } from '../forms';
import { SCALE } from './Player';
import { rasenganContact } from '../combatRules';
import { spriteSizeCorrection } from '../spriteGeometry';

const WALK_SPEED = 160;
const RUN_SPEED = 320;
const JUMP_SPEED = 660;
const DASH_SPEED = 520;
const BODY_W = 55;
const BODY_H = 180;
const HITSTUN_MS = 260;
const ALL = [0, 1, 2, 3, 4, 5, 6, 7];

type Action = 'none' | 'punch' | 'ras-charge' | 'ras-dash' | 'ras-hit' | 'transform' | 'untransform' | 'sage-transform-a' | 'sage-transform-b' | 'rasen-charge' | 'rasen-throw';
export type NarutoForm = 'normal' | 'kyubi' | 'sage';

/** Naruto: chakra no lugar do ki, soco (E) e Rasengan (Q). Todas as tiras olham para a direita. */
export class Naruto extends Phaser.Physics.Arcade.Sprite {
  readonly character = 'naruto' as const;
  readonly power = new PowerState();
  facing: -1 | 1 = 1;
  private action: Action = 'none';
  private hitDone = false;
  private stun = 0;
  private chargeIntroDone = false;
  private wasOnGround = false;
  private landTimer = 0;
  private kyubi = false;
  private sage = false;
  private dead = false;
  private transformTimer = 0;

  get hp(): number {
    return this.power.hp;
  }
  get energy(): number {
    return this.power.ki;
  }
  get form(): NarutoForm {
    return this.kyubi ? 'kyubi' : this.sage ? 'sage' : 'normal';
  }

  /** Prefixo das animações da forma atual. */
  private get p(): string {
    return this.kyubi ? 'kyubi' : this.sage ? 'sage' : 'naruto';
  }
  private get dmgMult(): number {
    return this.kyubi ? KYUBI_DAMAGE_MULT : 1;
  }

  static createAnimations(scene: Phaser.Scene): void {
    const make = (key: string, tex: string, frames: number[], frameRate: number, repeat: number) => {
      if (!scene.anims.exists(key))
        scene.anims.create({ key, frames: frames.map((frame) => ({ key: tex, frame })), frameRate, repeat });
    };
    for (const [action, tex, frames, fps, repeat] of [
      ['idle','sage_idle',ALL,7,-1], ['walk','sage_walk',ALL,10,-1], ['run','sage_run',ALL,14,-1],
      ['jump','sage_air',[1,2,3,4],12,0], ['fall','sage_air',[5],8,0], ['land','sage_air',[6,7],14,0],
      ['punch','sage_punch',ALL,18,0], ['charge-start','sage_charge_start',ALL,12,0], ['charge-loop','sage_charge_loop',ALL,12,-1],
      ['rasen-charge','sage_rasen_charge',[0,1,2,3,4,5,6,7,8,9],14,0], ['rasen-throw','sage_rasen_throw',[0,1,2,3,4,5,6,7,8],14,0],
    ] as const) make(`sage:${action}`, tex, [...frames], fps, repeat);
    make('naruto:sage-transform-a','sage_transform_a',ALL,12,0);
    make('naruto:sage-transform-b','sage_transform_b',ALL,12,0);
    make('naruto:death','naruto_death',[0,1,2,3,4,5,6,7,8,9,10],13,0);
    make('naruto:idle', 'naruto_idle', ALL, 7, -1);
    make('naruto:walk', 'naruto_walk', ALL, 10, -1);
    make('naruto:run', 'naruto_run', ALL, 14, -1);
    make('naruto:jump', 'naruto_air', [2, 3], 10, 0);
    make('naruto:fall', 'naruto_air', [4, 5], 8, 0);
    make('naruto:land', 'naruto_air', [6, 7], 14, 0);
    make('naruto:punch', 'naruto_punch', ALL, 18, 0);
    make('naruto:ras-charge', 'naruto_rasengan_a', ALL, 14, 0);
    make('naruto:ras-dash', 'naruto_rasengan_b', ALL, 18, 0);
    make('naruto:ras-hit', 'naruto_rasengan_c', ALL, 16, 0);
    make('naruto:charge-start', 'naruto_charge_a', ALL, 12, 0);
    make('naruto:charge-loop', 'naruto_charge_b', ALL, 12, -1);
    make('kyubi:idle', 'naruto_kyubi_idle', ALL, 8, -1);
    make('kyubi:walk', 'naruto_kyubi_walk', ALL, 11, -1);
    make('kyubi:run', 'naruto_kyubi_run', ALL, 16, -1);
    make('kyubi:jump', 'naruto_kyubi_air', [1, 2, 3], 12, 0);
    make('kyubi:fall', 'naruto_kyubi_air', [4, 5], 8, 0);
    make('kyubi:land', 'naruto_kyubi_air', [6, 7], 14, 0);
    make('kyubi:punch', 'naruto_kyubi_punch', ALL, 20, 0);
    make('kyubi:ras-charge', 'naruto_kyubi_ras_a', ALL, 16, 0);
    make('kyubi:ras-dash', 'naruto_kyubi_ras_b', ALL, 20, 0);
    make('kyubi:ras-hit', 'naruto_kyubi_ras_c', ALL, 16, 0);
    make('kyubi:charge-start', 'naruto_kyubi_charge', [0, 1, 2, 3], 10, 0);
    make('kyubi:charge-loop', 'naruto_kyubi_charge', [4, 5, 6, 7], 10, -1);
    make('naruto:transform', 'naruto_kyubi_transform', [0, 1, 2, 3, 4, 5, 6, 7, 7], 9, 0);
    make('kyubi:untransform', 'naruto_kyubi_transform', [7, 6, 5, 4, 3, 2, 1, 0], 12, 0);
  }

  constructor(scene: Phaser.Scene, x: number, y: number, private controls: Controls) {
    super(scene, x, y, 'naruto_idle', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(SCALE);
    (this.body as Phaser.Physics.Arcade.Body).setSize(BODY_W, BODY_H);
    this.setCollideWorldBounds(true);
    this.syncAnchor();

    this.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (this.action === 'rasen-throw' && frame.index === 7) this.emit('fire', this.x + this.facing * 65, this.y - 70, this.facing, 1, 'rasenshuriken');
      if (this.action === 'punch' && anim.key.endsWith(':punch') && frame.index === 5) this.melee(95, PUNCH_DAMAGE * this.dmgMult);
      if (this.action === 'ras-hit' && !this.hitDone && frame.index >= 5) {
        this.hitDone = true;
        this.melee(130, RASENGAN_DAMAGE * this.dmgMult);
        this.scene.cameras.main.shake(140, 0.006);
      }
    });
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      const k = anim.key.split(':')[1];
      if (this.dead) return;
      if (k === 'sage-transform-a') this.setAction('sage-transform-b');
      if (k === 'sage-transform-b') { this.sage = true; this.action = 'none'; }
      if (k === 'rasen-charge') this.setAction('rasen-throw');
      if (k === 'rasen-throw') this.action = 'none';
      if (k === 'charge-start') this.chargeIntroDone = true;
      if (k === 'punch' || k === 'ras-hit') this.action = 'none';
      if (k === 'ras-charge') this.setAction('ras-dash');
      if (k === 'ras-dash') this.setAction('ras-hit');
      if (k === 'transform') this.finishTransform();
      if (k === 'untransform') this.action = 'none';
    });
  }

  private melee(reach: number, dmg: number): void {
    const rect = new Phaser.Geom.Rectangle(this.facing === 1 ? this.x : this.x - reach, this.y - 95, reach, 70);
    this.emit('melee', rect, dmg, this.facing);
  }

  private setAction(a: Exclude<Action, 'none'>): void {
    this.action = a;
    this.hitDone = false;
    this.setFlipX(this.facing === -1);
    this.anims.play(`${this.p}:${a}`);
  }

  private startTransform(): void {
    this.setVelocityX(0);
    this.setAction('transform');
    this.scene.cameras.main.shake(900, 0.004);
    this.emit('hint', 'MODO 1 CAUDA!');
  }

  private finishTransform(): void {
    this.action = 'none';
    this.kyubi = true;
    this.scene.cameras.main.flash(180, 255, 80, 60);
  }

  private endKyubi(msg = 'O chakra acabou: voltou ao normal'): void {
    if (!this.kyubi) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded && (this.action === 'none' || this.action === 'punch')) {
      this.setVelocityX(0);
      this.setAction('untransform'); // usa o prefixo 'kyubi' antes de desligar
    }
    this.kyubi = false;
    this.emit('hint', msg);
  }

  takeHit(dmg: number, dir: number, knockback = 260): boolean {
    const ko = this.power.damage(dmg);
    this.stun = HITSTUN_MS;
    this.action = 'none';
    this.setVelocity(dir * knockback, -220);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    return ko;
  }

  die(): void {
    this.dead = true; this.kyubi = false; this.sage = false; this.power.form = 'normal'; this.power.hp = 0; this.action = 'none';
    this.setVelocityX(0); this.clearTint(); this.anims.play('naruto:death'); this.syncAnchor();
  }

  /** Contact immediately commits the impact; there is no end-of-dash requirement. */
  tryRasenganContact(target: { x: number; y: number; width: number; height: number }): boolean {
    if (this.action !== 'ras-dash') return false;
    if (!rasenganContact(this, target)) return false;
    this.setAction('ras-hit'); this.hitDone = true; this.setVelocityX(0);
    this.melee(130, RASENGAN_DAMAGE * this.dmgMult);
    this.scene.cameras.main.shake(140, 0.006); return true;
  }

  respawn(x: number, y: number, hp: number): void {
    this.dead = false; this.kyubi = false; this.sage = false; this.chargeIntroDone = false;
    this.setPosition(x, y);
    this.setVelocity(0, 0);
    this.power.hp = hp;
    this.action = 'none';
  }

  private playAnim(key: string): void {
    if (this.anims.currentAnim?.key !== key) this.anims.play(key);
  }

  override update(delta: number): void {
    if (this.dead) { this.syncAnchor(); return; }
    const body = this.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    const c = this.controls;
    if (c.pressed('restore')) this.power.restore();
    if (this.kyubi) {
      this.power.ki = Math.max(0, this.power.ki - (KYUBI_CHAKRA_DRAIN_PER_SEC * delta) / 1000);
      if (this.power.ki <= 0) this.endKyubi();
    }
    if (!c.down('charge')) this.chargeIntroDone = false;
    if (onGround && !this.wasOnGround) this.landTimer = 140;
    this.wasOnGround = onGround;
    if (this.landTimer > 0) this.landTimer -= delta;

    if (this.stun > 0) {
      this.stun -= delta;
      this.syncAnchor();
      return;
    }

    if (this.action === 'none') {
      const cost = this.kyubi ? KYUBI_RASENGAN_COST : RASENGAN_COST;
      if (c.pressed('kaioken') && onGround) {
        if (this.sage) { this.sage = false; this.anims.play('naruto:idle'); }
        else if (!this.kyubi && this.power.ki >= KYUBI_MIN_CHAKRA) this.setAction('sage-transform-a');
        else this.emit('no-ki');
      } else if (c.pressed('ssj') && onGround) {
        if (this.kyubi) this.endKyubi('Voltou ao normal');
        else if (!this.sage && this.power.ki >= KYUBI_MIN_CHAKRA) this.startTransform();
        else {
          this.emit('no-ki');
          this.emit('hint', 'Modo 1 cauda precisa de chakra cheio: segure C');
        }
      } else if (c.pressed('punch')) this.setAction('punch');
      else if (c.pressed('shoot') && onGround) {
        if (this.power.ki >= cost) {
          this.power.spendKi(cost);
          this.setAction(this.sage ? 'rasen-charge' : 'ras-charge');
        } else {
          this.emit('no-ki');
          this.emit('hint', `Rasengan precisa de ${cost}% de chakra: segure C`);
        }
      }
    }

    if (this.action !== 'none') {
      const dashing = this.action === 'ras-dash';
      if (dashing) this.setVelocityX(this.facing * DASH_SPEED);
      else if (onGround) this.setVelocityX(0);
      this.syncAnchor();
      return;
    }

    const charging = c.down('charge') && onGround;
    if (charging) {
      this.power.charge(delta);
      this.setVelocityX(0);
      this.setFlipX(this.facing === -1);
      this.playAnim(`${this.p}:${this.chargeIntroDone ? 'charge-loop' : 'charge-start'}`);
      this.syncAnchor();
      return;
    }

    const dir = (Number(c.down('right')) - Number(c.down('left'))) as -1 | 0 | 1;
    const running = c.down('run');
    this.setVelocityX(dir * (running ? RUN_SPEED : WALK_SPEED) * (this.kyubi ? KYUBI_SPEED_MULT : 1));
    if (dir !== 0) this.facing = dir;
    if (c.down('jump') && onGround) this.setVelocityY(-JUMP_SPEED);
    this.setFlipX(this.facing === -1);
    const p = this.p;
    if (!onGround) this.playAnim(body.velocity.y < 0 ? `${p}:jump` : `${p}:fall`);
    else if (dir !== 0) this.playAnim(running ? `${p}:run` : `${p}:walk`);
    else if (this.landTimer > 0) this.playAnim(`${p}:land`);
    else this.playAnim(`${p}:idle`);
    this.syncAnchor();
  }

  private syncAnchor(): void {
    const a = OVERRIDE_ANCHOR;
    const ox = this.flipX ? 1 - a.ax / a.w : a.ax / a.w;
    this.setOrigin(ox, a.feetY / a.h);
    // Folhas do modo 1 cauda são desenhadas maiores; reduz para bater com o Naruto normal.
    const key = this.texture.key;
    const k = spriteSizeCorrection(key);
    if (this.scaleX !== SCALE * k) this.setScale(SCALE * k);
    const bw = BODY_W / k, bh = BODY_H / k;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.sourceWidth !== bw) body.setSize(bw, bh, false);
    body.setOffset(ox * a.w - bw / 2, a.feetY - bh);
  }
}
