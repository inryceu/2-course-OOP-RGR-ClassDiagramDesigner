/**
 * Складний приклад ігрової системи з багаторівневою ієрархією
 * Тестує: extends, implements, множинні інтерфейси, успадкування
 */

// Базові інтерфейси
interface IRenderable {
  render(): void;
  setVisible(visible: boolean): void;
}

interface ICollidable {
  checkCollision(other: ICollidable): boolean;
  getBoundingBox(): Rectangle;
}

interface IUpdateable {
  update(deltaTime: number): void;
}

interface IHealthable {
  health: number;
  maxHealth: number;
  takeDamage(amount: number): void;
  heal(amount: number): void;
  isDead(): boolean;
}

// Допоміжний клас
class Rectangle {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number
  ) {}
  
  public intersects(other: Rectangle): boolean {
    return true; // Спрощена логіка
  }
}

// Абстрактний базовий клас для всіх ігрових об'єктів
abstract class GameObject implements IRenderable, IUpdateable {
  protected x: number = 0;
  protected y: number = 0;
  protected width: number = 32;
  protected height: number = 32;
  protected visible: boolean = true;
  
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  
  public abstract render(): void;
  
  public update(deltaTime: number): void {
    // Базова логіка оновлення
  }
  
  public setVisible(visible: boolean): void {
    this.visible = visible;
  }
  
  public getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
  
  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
}

// Клас для фізичних об'єктів
abstract class PhysicalObject extends GameObject implements ICollidable {
  protected velocityX: number = 0;
  protected velocityY: number = 0;
  protected mass: number = 1;
  
  constructor(x: number, y: number, mass: number) {
    super(x, y);
    this.mass = mass;
  }
  
  public checkCollision(other: ICollidable): boolean {
    const myBox = this.getBoundingBox();
    const otherBox = other.getBoundingBox();
    return myBox.intersects(otherBox);
  }
  
  public getBoundingBox(): Rectangle {
    return new Rectangle(this.x, this.y, this.width, this.height);
  }
  
  public applyForce(forceX: number, forceY: number): void {
    this.velocityX += forceX / this.mass;
    this.velocityY += forceY / this.mass;
  }
  
  public override update(deltaTime: number): void {
    super.update(deltaTime);
    this.x += this.velocityX * deltaTime;
    this.y += this.velocityY * deltaTime;
  }
}

// Клас для живих об'єктів
abstract class LivingEntity extends PhysicalObject implements IHealthable {
  public health: number;
  public maxHealth: number;
  protected defense: number = 0;
  
  constructor(x: number, y: number, mass: number, maxHealth: number) {
    super(x, y, mass);
    this.health = maxHealth;
    this.maxHealth = maxHealth;
  }
  
  public takeDamage(amount: number): void {
    const actualDamage = Math.max(0, amount - this.defense);
    this.health = Math.max(0, this.health - actualDamage);
    if (this.isDead()) {
      this.onDeath();
    }
  }
  
  public heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }
  
  public isDead(): boolean {
    return this.health <= 0;
  }
  
  protected abstract onDeath(): void;
}

// Клас гравця
class Player extends LivingEntity {
  private score: number = 0;
  private inventory: Item[] = [];
  private level: number = 1;
  private experience: number = 0;
  
  constructor(x: number, y: number) {
    super(x, y, 70, 100);
    this.defense = 5;
  }
  
  public render(): void {
    console.log(`Rendering player at (${this.x}, ${this.y})`);
  }
  
  public addScore(points: number): void {
    this.score += points;
  }
  
  public addItem(item: Item): void {
    this.inventory.push(item);
  }
  
  public useItem(index: number): void {
    if (index >= 0 && index < this.inventory.length) {
      const item = this.inventory[index];
      item.use(this);
      this.inventory.splice(index, 1);
    }
  }
  
  public addExperience(exp: number): void {
    this.experience += exp;
    if (this.experience >= this.level * 100) {
      this.levelUp();
    }
  }
  
  private levelUp(): void {
    this.level++;
    this.maxHealth += 10;
    this.health = this.maxHealth;
    this.defense += 2;
  }
  
  protected onDeath(): void {
    console.log('Game Over!');
    this.setVisible(false);
  }
  
  public override update(deltaTime: number): void {
    super.update(deltaTime);
    // Логіка гравця
  }
}

// Базовий клас для ворогів
abstract class Enemy extends LivingEntity {
  protected damage: number;
  protected attackCooldown: number = 1.0;
  protected currentCooldown: number = 0;
  
  constructor(x: number, y: number, mass: number, health: number, damage: number) {
    super(x, y, mass, health);
    this.damage = damage;
  }
  
  public attack(target: IHealthable): void {
    if (this.currentCooldown <= 0) {
      target.takeDamage(this.damage);
      this.currentCooldown = this.attackCooldown;
    }
  }
  
  protected onDeath(): void {
    console.log(`Enemy defeated at (${this.x}, ${this.y})`);
    this.setVisible(false);
  }
  
  public override update(deltaTime: number): void {
    super.update(deltaTime);
    if (this.currentCooldown > 0) {
      this.currentCooldown -= deltaTime;
    }
  }
}

// Конкретний тип ворога - зомбі
class Zombie extends Enemy {
  private speed: number = 50;
  
  constructor(x: number, y: number) {
    super(x, y, 80, 50, 10);
    this.defense = 2;
  }
  
  public render(): void {
    console.log(`Rendering zombie at (${this.x}, ${this.y})`);
  }
  
  public moveTowards(targetX: number, targetY: number, deltaTime: number): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      this.velocityX = (dx / distance) * this.speed;
      this.velocityY = (dy / distance) * this.speed;
    }
  }
}

// Інший тип ворога - літаючий
class FlyingEnemy extends Enemy {
  private altitude: number = 100;
  private flySpeed: number = 80;
  
  constructor(x: number, y: number) {
    super(x, y, 40, 30, 15);
    this.defense = 1;
  }
  
  public render(): void {
    console.log(`Rendering flying enemy at (${this.x}, ${this.y}, ${this.altitude})`);
  }
  
  public setAltitude(altitude: number): void {
    this.altitude = Math.max(0, altitude);
  }
  
  public override checkCollision(other: ICollidable): boolean {
    // Літаючі вороги рідше стикаються
    if (this.altitude > 50) {
      return false;
    }
    return super.checkCollision(other);
  }
}

// Система предметів
abstract class Item {
  protected name: string;
  protected description: string;
  
  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }
  
  public abstract use(player: Player): void;
  
  public getName(): string {
    return this.name;
  }
}

// Зілля здоров'я
class HealthPotion extends Item {
  private healAmount: number;
  
  constructor(healAmount: number = 50) {
    super('Health Potion', 'Restores health');
    this.healAmount = healAmount;
  }
  
  public use(player: Player): void {
    player.heal(this.healAmount);
  }
}

// Зілля досвіду
class ExperiencePotion extends Item {
  private expAmount: number;
  
  constructor(expAmount: number = 100) {
    super('Experience Potion', 'Grants experience');
    this.expAmount = expAmount;
  }
  
  public use(player: Player): void {
    player.addExperience(this.expAmount);
  }
}

// Менеджер гри
class GameManager {
  private static instance: GameManager;
  private player: Player | null = null;
  private enemies: Enemy[] = [];
  private items: Item[] = [];
  private gameObjects: GameObject[] = [];
  
  private constructor() {}
  
  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }
  
  public setPlayer(player: Player): void {
    this.player = player;
    this.gameObjects.push(player);
  }
  
  public addEnemy(enemy: Enemy): void {
    this.enemies.push(enemy);
    this.gameObjects.push(enemy);
  }
  
  public update(deltaTime: number): void {
    for (const obj of this.gameObjects) {
      obj.update(deltaTime);
    }
  }
  
  public render(): void {
    for (const obj of this.gameObjects) {
      obj.render();
    }
  }
}

