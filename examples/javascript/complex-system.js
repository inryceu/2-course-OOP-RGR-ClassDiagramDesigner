/**
 * Складний приклад системи управління підприємством
 * Тестує: extends, множинні рівні успадкування, композицію
 */

// Базовий клас для всіх людей
class Person {
  constructor(firstName, lastName, birthDate) {
    this.firstName = firstName;
    this.lastName = lastName;
    this.birthDate = birthDate;
    this.address = null;
    this.phoneNumber = null;
    this.email = null;
  }

  getFullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  getAge() {
    const today = new Date();
    const birth = new Date(this.birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  }

  setAddress(address) {
    this.address = address;
  }

  setContactInfo(phone, email) {
    this.phoneNumber = phone;
    this.email = email;
  }

  getContactInfo() {
    return {
      phone: this.phoneNumber,
      email: this.email,
      address: this.address,
    };
  }
}

// Співробітник
class Employee extends Person {
  constructor(firstName, lastName, birthDate, employeeId, department) {
    super(firstName, lastName, birthDate);
    this.employeeId = employeeId;
    this.department = department;
    this.salary = 0;
    this.hireDate = new Date();
    this.position = "Employee";
    this.isActive = true;
  }

  setSalary(salary) {
    if (salary > 0) {
      this.salary = salary;
    }
  }

  getSalary() {
    return this.salary;
  }

  setPosition(position) {
    this.position = position;
  }

  getYearsOfService() {
    const today = new Date();
    return today.getFullYear() - this.hireDate.getFullYear();
  }

  terminate() {
    this.isActive = false;
    console.log(`Employee ${this.getFullName()} has been terminated.`);
  }

  getEmployeeInfo() {
    return {
      id: this.employeeId,
      name: this.getFullName(),
      department: this.department,
      position: this.position,
      salary: this.salary,
      yearsOfService: this.getYearsOfService(),
    };
  }
}

// Менеджер
class Manager extends Employee {
  constructor(firstName, lastName, birthDate, employeeId, department) {
    super(firstName, lastName, birthDate, employeeId, department);
    this.position = "Manager";
    this.subordinates = [];
    this.managementLevel = 1;
    this.bonus = 0;
  }

  addSubordinate(employee) {
    if (employee instanceof Employee && !this.subordinates.includes(employee)) {
      this.subordinates.push(employee);
    }
  }

  removeSubordinate(employee) {
    const index = this.subordinates.indexOf(employee);
    if (index > -1) {
      this.subordinates.splice(index, 1);
    }
  }

  getTeamSize() {
    return this.subordinates.length;
  }

  setBonus(bonus) {
    this.bonus = bonus;
  }

  getTotalCompensation() {
    return this.salary + this.bonus;
  }

  approveTimeOff(employee, days) {
    if (this.subordinates.includes(employee)) {
      console.log(
        `${this.getFullName()} approved ${days} days off for ${employee.getFullName()}`
      );
      return true;
    }
    return false;
  }

  conductPerformanceReview(employee) {
    if (this.subordinates.includes(employee)) {
      console.log(
        `${this.getFullName()} is reviewing ${employee.getFullName()}'s performance`
      );
    }
  }
}

// Директор
class Director extends Manager {
  constructor(firstName, lastName, birthDate, employeeId, division) {
    super(firstName, lastName, birthDate, employeeId, division);
    this.position = "Director";
    this.managementLevel = 2;
    this.division = division;
    this.budget = 0;
    this.stockOptions = 0;
  }

  setBudget(budget) {
    this.budget = budget;
  }

  getBudget() {
    return this.budget;
  }

  setStockOptions(options) {
    this.stockOptions = options;
  }

  getTotalCompensation() {
    return super.getTotalCompensation() + this.stockOptions * 100; // спрощено
  }

  approveBudgetRequest(amount, purpose) {
    if (amount <= this.budget) {
      console.log(
        `Budget request of ${amount} for ${purpose} approved by ${this.getFullName()}`
      );
      this.budget -= amount;
      return true;
    }
    console.log(`Budget request denied - insufficient funds`);
    return false;
  }

  hireEmployee(employee) {
    console.log(
      `${this.getFullName()} hired ${employee.getFullName()} for ${this.division}`
    );
    this.addSubordinate(employee);
  }
}

// Виконавчий директор (CEO)
class CEO extends Director {
  constructor(firstName, lastName, birthDate, employeeId) {
    super(firstName, lastName, birthDate, employeeId, "Executive");
    this.position = "CEO";
    this.managementLevel = 3;
    this.boardMembers = [];
    this.companyShares = 0;
  }

  setCompanyShares(shares) {
    this.companyShares = shares;
  }

  addBoardMember(person) {
    if (person instanceof Person) {
      this.boardMembers.push(person);
    }
  }

  callBoardMeeting(agenda) {
    console.log(`CEO ${this.getFullName()} called a board meeting:`);
    console.log(`Agenda: ${agenda}`);
    console.log(`Attendees: ${this.boardMembers.length} board members`);
  }

  makeStrategicDecision(decision) {
    console.log(
      `CEO ${this.getFullName()} made strategic decision: ${decision}`
    );
  }

  getTotalCompensation() {
    const baseCompensation = super.getTotalCompensation();
    const sharesValue = this.companyShares * 500; // спрощено
    return baseCompensation + sharesValue;
  }
}

// Інші типи співробітників

// Розробник
class Developer extends Employee {
  constructor(
    firstName,
    lastName,
    birthDate,
    employeeId,
    department,
    programmingLanguages
  ) {
    super(firstName, lastName, birthDate, employeeId, department);
    this.position = "Developer";
    this.programmingLanguages = programmingLanguages || [];
    this.projects = [];
    this.githubUsername = null;
  }

  addProgrammingLanguage(language) {
    if (!this.programmingLanguages.includes(language)) {
      this.programmingLanguages.push(language);
    }
  }

  assignToProject(project) {
    this.projects.push(project);
  }

  completeProject(project) {
    const index = this.projects.indexOf(project);
    if (index > -1) {
      this.projects.splice(index, 1);
      console.log(`${this.getFullName()} completed project: ${project}`);
    }
  }

  setGithubUsername(username) {
    this.githubUsername = username;
  }

  getSkills() {
    return {
      languages: this.programmingLanguages,
      projectCount: this.projects.length,
      github: this.githubUsername,
    };
  }
}

// Старший розробник
class SeniorDeveloper extends Developer {
  constructor(
    firstName,
    lastName,
    birthDate,
    employeeId,
    department,
    programmingLanguages
  ) {
    super(
      firstName,
      lastName,
      birthDate,
      employeeId,
      department,
      programmingLanguages
    );
    this.position = "Senior Developer";
    this.mentorees = [];
    this.codeReviewsCompleted = 0;
  }

  mentorDeveloper(developer) {
    if (developer instanceof Developer && !this.mentorees.includes(developer)) {
      this.mentorees.push(developer);
      console.log(
        `${this.getFullName()} is now mentoring ${developer.getFullName()}`
      );
    }
  }

  reviewCode(developer, feedback) {
    this.codeReviewsCompleted++;
    console.log(
      `${this.getFullName()} reviewed code for ${developer.getFullName()}`
    );
  }

  leadTechnicalDesign(projectName) {
    console.log(
      `${this.getFullName()} is leading technical design for ${projectName}`
    );
  }
}

// Архітектор
class SoftwareArchitect extends SeniorDeveloper {
  constructor(
    firstName,
    lastName,
    birthDate,
    employeeId,
    department,
    programmingLanguages
  ) {
    super(
      firstName,
      lastName,
      birthDate,
      employeeId,
      department,
      programmingLanguages
    );
    this.position = "Software Architect";
    this.architecturePatterns = [];
    this.systemsDesigned = [];
  }

  addArchitecturePattern(pattern) {
    if (!this.architecturePatterns.includes(pattern)) {
      this.architecturePatterns.push(pattern);
    }
  }

  designSystem(systemName, pattern) {
    this.systemsDesigned.push({
      name: systemName,
      pattern: pattern,
      date: new Date(),
    });
    console.log(
      `${this.getFullName()} designed system: ${systemName} using ${pattern}`
    );
  }

  conductArchitectureReview(system) {
    console.log(
      `${this.getFullName()} is conducting architecture review for ${system}`
    );
  }

  getTotalCompensation() {
    // Architects get higher compensation
    return this.salary + this.systemsDesigned.length * 5000;
  }
}

// Класи для підтримки

// Відділ
class Department {
  constructor(name, code) {
    this.name = name;
    this.code = code;
    this.employees = [];
    this.manager = null;
    this.budget = 0;
  }

  setManager(manager) {
    if (manager instanceof Manager) {
      this.manager = manager;
    }
  }

  addEmployee(employee) {
    if (employee instanceof Employee) {
      this.employees.push(employee);
    }
  }

  removeEmployee(employee) {
    const index = this.employees.indexOf(employee);
    if (index > -1) {
      this.employees.splice(index, 1);
    }
  }

  getEmployeeCount() {
    return this.employees.length;
  }

  getTotalSalaryExpense() {
    return this.employees.reduce((total, emp) => {
      return total + emp.getSalary();
    }, 0);
  }

  getDepartmentInfo() {
    return {
      name: this.name,
      code: this.code,
      manager: this.manager ? this.manager.getFullName() : "None",
      employeeCount: this.getEmployeeCount(),
      totalSalary: this.getTotalSalaryExpense(),
      budget: this.budget,
    };
  }
}

// Компанія
class Company {
  constructor(name, industry) {
    this.name = name;
    this.industry = industry;
    this.departments = [];
    this.ceo = null;
    this.foundedDate = new Date();
    this.revenue = 0;
  }

  setCEO(ceo) {
    if (ceo instanceof CEO) {
      this.ceo = ceo;
    }
  }

  addDepartment(department) {
    if (department instanceof Department) {
      this.departments.push(department);
    }
  }

  getTotalEmployees() {
    return this.departments.reduce((total, dept) => {
      return total + dept.getEmployeeCount();
    }, 0);
  }

  getTotalPayroll() {
    return this.departments.reduce((total, dept) => {
      return total + dept.getTotalSalaryExpense();
    }, 0);
  }

  setRevenue(revenue) {
    this.revenue = revenue;
  }

  getCompanyAge() {
    const today = new Date();
    return today.getFullYear() - this.foundedDate.getFullYear();
  }

  getFinancialSummary() {
    return {
      revenue: this.revenue,
      payroll: this.getTotalPayroll(),
      profit: this.revenue - this.getTotalPayroll(),
      employeeCount: this.getTotalEmployees(),
    };
  }
}

// Проект
class Project {
  constructor(name, description, budget) {
    this.name = name;
    this.description = description;
    this.budget = budget;
    this.startDate = new Date();
    this.endDate = null;
    this.status = "Planning";
    this.team = [];
    this.projectManager = null;
  }

  setProjectManager(manager) {
    if (manager instanceof Manager) {
      this.projectManager = manager;
    }
  }

  addTeamMember(employee) {
    if (employee instanceof Employee) {
      this.team.push(employee);
    }
  }

  setStatus(status) {
    this.status = status;
    if (status === "Completed") {
      this.endDate = new Date();
    }
  }

  getProjectDuration() {
    const end = this.endDate || new Date();
    const days = Math.floor((end - this.startDate) / (1000 * 60 * 60 * 24));
    return days;
  }

  getProjectInfo() {
    return {
      name: this.name,
      status: this.status,
      budget: this.budget,
      teamSize: this.team.length,
      manager: this.projectManager ? this.projectManager.getFullName() : "None",
      duration: this.getProjectDuration(),
    };
  }
}
