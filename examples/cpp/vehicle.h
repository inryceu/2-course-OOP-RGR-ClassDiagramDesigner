/**
 * Приклад C++ класів для тестування генератора діаграм
 */

#ifndef VEHICLE_H
#define VEHICLE_H

#include <string>

// Базовий клас для транспортного засобу
class Vehicle {
private:
  std::string model;
  int year;
  std::string color;

protected:
  double currentSpeed;

public:
  Vehicle(std::string m, int y, std::string c);
  virtual ~Vehicle();

  virtual void start() = 0;
  virtual void stop() = 0;
  virtual void accelerate(double amount);

  std::string getModel() const;
  int getYear() const;
  double getCurrentSpeed() const;
};

// Клас для автомобіля
class Car : public Vehicle {
private:
  int numberOfDoors;
  int numberOfSeats;

public:
  Car(std::string m, int y, std::string c, int doors, int seats);
  ~Car();

  void start() override;
  void stop() override;

  int getNumberOfDoors() const;
  int getNumberOfSeats() const;
};

// Клас для мотоцикла
class Motorcycle : public Vehicle {
private:
  bool hasSidecar;

public:
  Motorcycle(std::string m, int y, std::string c, bool sidecar);
  ~Motorcycle();

  void start() override;
  void stop() override;

  bool getHasSidecar() const;
};

// Клас для електричного автомобіля
class ElectricCar : public Car {
private:
  double batteryCapacity;
  double currentCharge;

public:
  ElectricCar(std::string m, int y, std::string c, int doors, int seats,
              double capacity);

  void charge(double amount);
  double getRemainingRange() const;
  double getBatteryLevel() const;
};

#endif // VEHICLE_H
