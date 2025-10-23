/**
 * Приклад TypeScript класів для тестування генератора діаграм
 */

// Інтерфейс для фігури
interface IShape {
  area(): number;
  perimeter(): number;
  getColor(): string;
}

// Абстрактний базовий клас
abstract class Shape implements IShape {
  protected color: string;
  protected name: string;
  
  constructor(color: string, name: string) {
    this.color = color;
    this.name = name;
  }
  
  abstract area(): number;
  abstract perimeter(): number;
  
  getColor(): string {
    return this.color;
  }
  
  getName(): string {
    return this.name;
  }
}

// Клас для кола
class Circle extends Shape {
  private radius: number;
  
  constructor(color: string, radius: number) {
    super(color, 'Circle');
    this.radius = radius;
  }
  
  area(): number {
    return Math.PI * this.radius ** 2;
  }
  
  perimeter(): number {
    return 2 * Math.PI * this.radius;
  }
  
  getRadius(): number {
    return this.radius;
  }
}

// Клас для прямокутника
class Rectangle extends Shape {
  private width: number;
  private height: number;
  
  constructor(color: string, width: number, height: number) {
    super(color, 'Rectangle');
    this.width = width;
    this.height = height;
  }
  
  area(): number {
    return this.width * this.height;
  }
  
  perimeter(): number {
    return 2 * (this.width + this.height);
  }
  
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}

// Клас для колекції фігур
class ShapeCollection {
  private shapes: IShape[] = [];
  
  addShape(shape: IShape): void {
    this.shapes.push(shape);
  }
  
  getTotalArea(): number {
    return this.shapes.reduce((sum, shape) => sum + shape.area(), 0);
  }
  
  getTotalPerimeter(): number {
    return this.shapes.reduce((sum, shape) => sum + shape.perimeter(), 0);
  }
}

