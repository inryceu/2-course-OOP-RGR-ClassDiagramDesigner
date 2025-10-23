/**
 * Приклад C# класів для тестування генератора діаграм
 */

using System;
using System.Collections.Generic;

// Інтерфейс для репозиторію
public interface IRepository<T> where T : class {
    T GetById(int id);
    IEnumerable<T> GetAll();
    void Add(T entity);
    void Update(T entity);
    void Delete(int id);
}

// Базова модель
public abstract class BaseEntity {
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    protected BaseEntity() {
        CreatedAt = DateTime.Now;
        UpdatedAt = DateTime.Now;
    }
    
    public abstract void Validate();
}

// Модель користувача
public class User : BaseEntity {
    public string Username { get; set; }
    public string Email { get; set; }
    public string Password { get; set; }
    
    public User() : base() { }
    
    public override void Validate() {
        if (string.IsNullOrEmpty(Username)) {
            throw new Exception("Username is required");
        }
    }
}

// Модель продукту
public class Product : BaseEntity {
    public string Name { get; set; }
    public decimal Price { get; set; }
    public int StockQuantity { get; set; }
    
    public Product() : base() { }
    
    public override void Validate() {
        if (Price < 0) {
            throw new Exception("Price cannot be negative");
        }
    }
}

// Базовий репозиторій
public abstract class BaseRepository<T> : IRepository<T> where T : BaseEntity {
    protected readonly List<T> data;
    
    protected BaseRepository() {
        data = new List<T>();
    }
    
    public virtual T GetById(int id) {
        return data.Find(e => e.Id == id);
    }
    
    public virtual IEnumerable<T> GetAll() {
        return data;
    }
    
    public virtual void Add(T entity) {
        data.Add(entity);
    }
    
    public abstract void Update(T entity);
    
    public virtual void Delete(int id) {
        var entity = GetById(id);
        if (entity != null) {
            data.Remove(entity);
        }
    }
}

// Репозиторій користувачів
public class UserRepository : BaseRepository<User> {
    public UserRepository() : base() { }
    
    public override void Update(User entity) {
        var existing = GetById(entity.Id);
        if (existing != null) {
            existing.Username = entity.Username;
            existing.Email = entity.Email;
            existing.UpdatedAt = DateTime.Now;
        }
    }
    
    public User FindByUsername(string username) {
        return data.Find(u => u.Username == username);
    }
}

// Репозиторій продуктів
public class ProductRepository : BaseRepository<Product> {
    public ProductRepository() : base() { }
    
    public override void Update(Product entity) {
        var existing = GetById(entity.Id);
        if (existing != null) {
            existing.Name = entity.Name;
            existing.Price = entity.Price;
            existing.StockQuantity = entity.StockQuantity;
            existing.UpdatedAt = DateTime.Now;
        }
    }
    
    public IEnumerable<Product> FindByPriceRange(decimal min, decimal max) {
        return data.FindAll(p => p.Price >= min && p.Price <= max);
    }
}

