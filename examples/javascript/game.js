/**
 * Приклад JavaScript класів для тестування генератора діаграм
 */

// Базовий клас для ігрового об'єкту
class GameObject {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.active = true;
  }

  update(deltaTime) {
    // Override in subclasses
  }

  render(context) {
    // Override in subclasses
  }

  destroy() {
    this.active = false;
  }
}

// Клас для гравця
class Player extends GameObject {
  constructor(x, y, name) {
    super(x, y);
    this.name = name;
    this.health = 100;
    this.score = 0;
  }

  update(deltaTime) {
    // Update player logic
  }

  render(context) {
    // Render player
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.destroy();
    }
  }

  addScore(points) {
    this.score += points;
  }
}

// Клас для ворога
class Enemy extends GameObject {
  constructor(x, y, type) {
    super(x, y);
    this.type = type;
    this.health = 50;
    this.speed = 2;
  }

  update(deltaTime) {
    // Move towards player
    this.x += this.speed * deltaTime;
  }

  render(context) {
    // Render enemy
  }

  attack(target) {
    if (target instanceof Player) {
      target.takeDamage(10);
    }
  }
}

// Клас для бонусу
class PowerUp extends GameObject {
  constructor(x, y, effect) {
    super(x, y);
    this.effect = effect;
  }

  update(deltaTime) {
    // Optional animation
  }

  render(context) {
    // Render power-up
  }

  apply(player) {
    switch (this.effect) {
      case "health":
        player.health = Math.min(100, player.health + 25);
        break;
      case "score":
        player.addScore(100);
        break;
    }
    this.destroy();
  }
}

// Клас для керування грою
class GameManager {
  constructor() {
    this.players = [];
    this.enemies = [];
    this.powerUps = [];
    this.gameOver = false;
  }

  addPlayer(player) {
    this.players.push(player);
  }

  spawnEnemy(x, y, type) {
    const enemy = new Enemy(x, y, type);
    this.enemies.push(enemy);
    return enemy;
  }

  spawnPowerUp(x, y, effect) {
    const powerUp = new PowerUp(x, y, effect);
    this.powerUps.push(powerUp);
    return powerUp;
  }

  update(deltaTime) {
    if (this.gameOver) return;

    this.players.forEach((p) => p.update(deltaTime));
    this.enemies.forEach((e) => e.update(deltaTime));
    this.powerUps.forEach((p) => p.update(deltaTime));

    this.checkCollisions();
  }

  checkCollisions() {
    // Collision detection logic
  }

  endGame() {
    this.gameOver = true;
  }
}
