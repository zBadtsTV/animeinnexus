import * as Phaser from 'phaser';
import type { Controls } from '../input';
import { PowerState } from '../forms';
import { OVERRIDE_ANCHOR } from '../spriteOverrides';
import { LUFFY_ATTACKS } from '../combatRules';
import { SCALE } from './Player';

type LuffyForm = 'normal' | 'haki' | 'gear';
type Action = 'none' | 'punch' | 'special-a' | 'special-b' | 'transform-a' | 'transform-b';
const ALL = [0,1,2,3,4,5,6,7];
export class Luffy extends Phaser.Physics.Arcade.Sprite {
  readonly character = 'luffy' as const;
  readonly power = new PowerState();
  facing: -1 | 1 = 1;
  form: LuffyForm = 'normal';
  private action: Action = 'none';
  private pending: LuffyForm = 'normal';
  private dead = false;
  private stun = 0;
  private prefix() { return this.form === 'normal' ? 'luffy' : `luffy_${this.form}`; }
  get hp() { return this.power.hp; }
  get energy() { return this.power.ki; }
  static createAnimations(scene: Phaser.Scene) {
    const make = (key: string, texture: string, frames: number[], fps: number, repeat = 0) => {
      if (!scene.anims.exists(key)) scene.anims.create({key, frames: frames.map(frame => ({key: texture, frame})), frameRate: fps, repeat});
    };
    for (const p of ['luffy','luffy_haki','luffy_gear']) {
      for (const a of ['idle','walk','run']) make(`${p}:${a}`,`${p}_${a}`,ALL,a==='run'?14:9,-1);
      make(`${p}:jump`,`${p}_air`,[1,2,3,4],12);
      make(`${p}:fall`,`${p}_air`,[5,6],8);
      make(`${p}:punch`,`${p}_punch`,ALL,18);
      make(`${p}:charge`,'luffy_charge',ALL,10,-1);
    }
    make('luffy:special-a','luffy_bazooka_a',ALL,14);
    make('luffy:special-b','luffy_bazooka_b',ALL,16);
    make('luffy_haki:special-a','luffy_haki_gatling_a',ALL,15);
    make('luffy_haki:special-b','luffy_haki_gatling_b',ALL,13);
    make('luffy_gear:special-a','luffy_gear_elastic',[0,1,2],14);
    make('luffy_gear:special-b','luffy_gear_elastic',[3,4,5,6,7],14);
    make('luffy:transform-haki','luffy_haki_transform',ALL,12);
    make('luffy:transform-gear-a','luffy_gear_transform_a',ALL,12);
    make('luffy:transform-gear-b','luffy_gear_transform_b',ALL,12);
    make('luffy:death','luffy_death',[0,1,2,3,4,5,6,7,8,9,10],13);
  }
  constructor(scene: Phaser.Scene,x: number,y: number,private controls: Controls) {
    super(scene,x,y,'luffy_idle',0); scene.add.existing(this); scene.physics.add.existing(this);
    this.setScale(SCALE).setCollideWorldBounds(true); this.syncAnchor();
    this.on(Phaser.Animations.Events.ANIMATION_UPDATE,(anim: Phaser.Animations.Animation,frame: Phaser.Animations.AnimationFrame)=>{
      if (this.dead) return;
      if (this.action==='punch' && frame.index===5) this.attack('punch');
      if (this.action==='special-b') {
        if (this.form==='haki' && frame.index>=2 && frame.index<=7) this.attack('gatling');
        else if (frame.index===4) this.attack(this.form==='gear'?'elastic':'bazooka');
      }
    });
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE,(anim: Phaser.Animations.Animation)=>{
      if (this.dead) return;
      if (anim.key==='luffy:transform-gear-a') { this.anims.play('luffy:transform-gear-b'); return; }
      if (anim.key.startsWith('luffy:transform-')) { this.form=this.pending; this.action='none'; return; }
      if (this.action==='special-a') { this.action='special-b'; this.anims.play(`${this.prefix()}:special-b`); }
      else this.action='none';
    });
  }
  private attack(name: keyof typeof LUFFY_ATTACKS) {
    const a=LUFFY_ATTACKS[name];
    const rect=new Phaser.Geom.Rectangle(this.facing>0?this.x:this.x-a.reach,this.y-95,a.reach,75);
    this.emit('melee',rect,a.damage,this.facing,a.knockback);
  }
  takeHit(dmg: number,dir: number,knockback=260) {
    const ko=this.power.damage(dmg);this.stun=260;this.action='none';this.setVelocity(dir*knockback,-180);return ko;
  }
  die() { this.dead=true;this.form='normal';this.pending='normal';this.power.hp=0;this.action='none';this.setVelocityX(0);this.anims.play('luffy:death');this.syncAnchor(); }
  respawn(x: number,y: number,hp: number) { this.dead=false;this.form='normal';this.action='none';this.stun=0;this.power.hp=hp;this.setPosition(x,y).setVelocity(0,0); }
  override update(delta: number) {
    if(this.dead){this.syncAnchor();return;}
    const b=this.body as Phaser.Physics.Arcade.Body; const ground=b.blocked.down||b.touching.down;const c=this.controls;
    if(c.pressed('restore'))this.power.restore();
    if(this.stun>0){this.stun-=delta;this.syncAnchor();return;}
    if(this.action==='none') {
      const target=c.pressed('kaioken')?'haki':c.pressed('ssj')?'gear':null;
      if(target&&ground){
        if(this.form===target){this.form='normal';}
        else if(this.form==='normal'){this.pending=target;this.action='transform-a';this.anims.play(target==='haki'?'luffy:transform-haki':'luffy:transform-gear-a');}
      } else if(c.pressed('punch')){this.action='punch';this.anims.play(`${this.prefix()}:punch`);}
      else if(c.pressed('shoot')){this.action='special-a';this.anims.play(`${this.prefix()}:special-a`);}
    }
    if(this.action!=='none'){this.setVelocityX(0);this.syncAnchor();return;}
    if(c.down('charge')&&ground){this.power.charge(delta);this.setVelocityX(0);this.play(`${this.prefix()}:charge`,true);}
    else {
      const dir=(Number(c.down('right'))-Number(c.down('left'))) as -1|0|1;
      if(dir)this.facing=dir;this.setFlipX(this.facing<0);
      this.setVelocityX(dir*(c.down('run')?320:160)*(this.form==='gear'?1.25:1));
      if(c.down('jump')&&ground)this.setVelocityY(-660);
      const key=`${this.prefix()}:${!ground?(b.velocity.y<0?'jump':'fall'):dir?(c.down('run')?'run':'walk'):'idle'}`;
      if(this.anims.currentAnim?.key!==key)this.anims.play(key);
    }
    this.syncAnchor();
  }
  private syncAnchor(){const a=OVERRIDE_ANCHOR;this.setScale(SCALE).setOrigin(.5,a.feetY/a.h);const b=this.body as Phaser.Physics.Arcade.Body;b.setSize(55,180,false);b.setOffset(a.ax-27.5,a.feetY-180);}
}
