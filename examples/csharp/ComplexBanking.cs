/**
 * Складна банківська система з множинними рівнями успадкування
 * Тестує: extends, implements, абстрактні класи, інтерфейси
 */

using System;
using System.Collections.Generic;
using System.Linq;

namespace BankingSystem
{
    // Інтерфейси
    public interface IAccount
    {
        string AccountNumber { get; }
        decimal Balance { get; }
        void Deposit(decimal amount);
        bool Withdraw(decimal amount);
        decimal GetBalance();
    }

    public interface ITransferable
    {
        bool Transfer(IAccount toAccount, decimal amount);
        List<Transaction> GetTransactionHistory();
    }

    public interface IInterestBearing
    {
        decimal InterestRate { get; set; }
        void ApplyInterest();
        decimal CalculateInterest();
    }

    public interface IOverdraftProtection
    {
        decimal OverdraftLimit { get; set; }
        bool IsOverdraftAllowed();
    }

    public interface IRewardable
    {
        int RewardPoints { get; }
        void AddRewardPoints(int points);
        void RedeemRewardPoints(int points);
    }

    // Допоміжні класи
    public class Transaction
    {
        public string TransactionId { get; private set; }
        public DateTime Date { get; private set; }
        public string Type { get; private set; }
        public decimal Amount { get; private set; }
        public decimal BalanceAfter { get; private set; }
        public string Description { get; private set; }

        public Transaction(string type, decimal amount, decimal balanceAfter, string description)
        {
            TransactionId = Guid.NewGuid().ToString();
            Date = DateTime.Now;
            Type = type;
            Amount = amount;
            BalanceAfter = balanceAfter;
            Description = description;
        }
    }

    public class Address
    {
        public string Street { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string ZipCode { get; set; }
        public string Country { get; set; }

        public override string ToString()
        {
            return $"{Street}, {City}, {State} {ZipCode}, {Country}";
        }
    }

    // Базова персона
    public abstract class Person
    {
        public string FirstName { get; protected set; }
        public string LastName { get; protected set; }
        public DateTime DateOfBirth { get; protected set; }
        public string SocialSecurityNumber { get; protected set; }
        public Address Address { get; set; }
        public string PhoneNumber { get; set; }
        public string Email { get; set; }

        protected Person(string firstName, string lastName, DateTime dateOfBirth, string ssn)
        {
            FirstName = firstName;
            LastName = lastName;
            DateOfBirth = dateOfBirth;
            SocialSecurityNumber = ssn;
        }

        public string GetFullName()
        {
            return $"{FirstName} {LastName}";
        }

        public int GetAge()
        {
            var today = DateTime.Today;
            var age = today.Year - DateOfBirth.Year;
            if (DateOfBirth.Date > today.AddYears(-age)) age--;
            return age;
        }

        public abstract string GetPersonType();
    }

    // Клієнт банку
    public class Customer : Person
    {
        public string CustomerId { get; private set; }
        public DateTime CustomerSince { get; private set; }
        public List<IAccount> Accounts { get; private set; }
        public string CustomerTier { get; set; }
        public bool IsActive { get; set; }

        public Customer(string firstName, string lastName, DateTime dateOfBirth, string ssn)
            : base(firstName, lastName, dateOfBirth, ssn)
        {
            CustomerId = Guid.NewGuid().ToString();
            CustomerSince = DateTime.Now;
            Accounts = new List<IAccount>();
            CustomerTier = "Standard";
            IsActive = true;
        }

        public void AddAccount(IAccount account)
        {
            Accounts.Add(account);
        }

        public void RemoveAccount(IAccount account)
        {
            Accounts.Remove(account);
        }

        public decimal GetTotalBalance()
        {
            return Accounts.Sum(acc => acc.GetBalance());
        }

        public int GetAccountCount()
        {
            return Accounts.Count;
        }

        public override string GetPersonType()
        {
            return "Customer";
        }
    }

    // VIP клієнт
    public class VIPCustomer : Customer
    {
        public string PersonalBanker { get; set; }
        public decimal MinimumBalance { get; set; }
        public List<string> ExclusiveServices { get; private set; }

        public VIPCustomer(string firstName, string lastName, DateTime dateOfBirth, string ssn)
            : base(firstName, lastName, dateOfBirth, ssn)
        {
            CustomerTier = "VIP";
            MinimumBalance = 100000m;
            ExclusiveServices = new List<string>();
        }

        public void AddExclusiveService(string service)
        {
            if (!ExclusiveServices.Contains(service))
            {
                ExclusiveServices.Add(service);
            }
        }

        public bool QualifiesForVIP()
        {
            return GetTotalBalance() >= MinimumBalance;
        }

        public override string GetPersonType()
        {
            return "VIP Customer";
        }
    }

    // Базовий рахунок
    public abstract class BankAccount : IAccount, ITransferable
    {
        public string AccountNumber { get; protected set; }
        public decimal Balance { get; protected set; }
        public Customer Owner { get; protected set; }
        public DateTime OpenDate { get; protected set; }
        public bool IsActive { get; set; }
        protected List<Transaction> transactions;

        protected BankAccount(Customer owner)
        {
            AccountNumber = GenerateAccountNumber();
            Owner = owner;
            Balance = 0m;
            OpenDate = DateTime.Now;
            IsActive = true;
            transactions = new List<Transaction>();
        }

        protected string GenerateAccountNumber()
        {
            return $"ACC{DateTime.Now.Ticks}";
        }

        public virtual void Deposit(decimal amount)
        {
            if (amount <= 0)
                throw new ArgumentException("Deposit amount must be positive");

            Balance += amount;
            AddTransaction("Deposit", amount, "Deposit to account");
        }

        public virtual bool Withdraw(decimal amount)
        {
            if (amount <= 0)
                throw new ArgumentException("Withdrawal amount must be positive");

            if (Balance >= amount)
            {
                Balance -= amount;
                AddTransaction("Withdrawal", -amount, "Withdrawal from account");
                return true;
            }
            return false;
        }

        public decimal GetBalance()
        {
            return Balance;
        }

        public virtual bool Transfer(IAccount toAccount, decimal amount)
        {
            if (Withdraw(amount))
            {
                toAccount.Deposit(amount);
                AddTransaction("Transfer Out", -amount, $"Transfer to {toAccount.AccountNumber}");
                return true;
            }
            return false;
        }

        public List<Transaction> GetTransactionHistory()
        {
            return new List<Transaction>(transactions);
        }

        protected void AddTransaction(string type, decimal amount, string description)
        {
            transactions.Add(new Transaction(type, amount, Balance, description));
        }

        public abstract string GetAccountType();
    }

    // Чековий рахунок
    public class CheckingAccount : BankAccount, IOverdraftProtection
    {
        public decimal OverdraftLimit { get; set; }
        public decimal MonthlyFee { get; set; }
        public int FreeTransactions { get; set; }
        private int transactionCount;

        public CheckingAccount(Customer owner, decimal overdraftLimit = 0m)
            : base(owner)
        {
            OverdraftLimit = overdraftLimit;
            MonthlyFee = 10m;
            FreeTransactions = 20;
            transactionCount = 0;
        }

        public bool IsOverdraftAllowed()
        {
            return OverdraftLimit > 0;
        }

        public override bool Withdraw(decimal amount)
        {
            transactionCount++;
            
            if (Balance + OverdraftLimit >= amount)
            {
                Balance -= amount;
                AddTransaction("Withdrawal", -amount, "Withdrawal with overdraft protection");
                
                if (transactionCount > FreeTransactions)
                {
                    Balance -= 2m; // Комісія за транзакцію
                }
                
                return true;
            }
            return false;
        }

        public void ChargeMonthlyFee()
        {
            Balance -= MonthlyFee;
            AddTransaction("Fee", -MonthlyFee, "Monthly account maintenance fee");
        }

        public void ResetTransactionCount()
        {
            transactionCount = 0;
        }

        public override string GetAccountType()
        {
            return "Checking Account";
        }
    }

    // Ощадний рахунок
    public class SavingsAccount : BankAccount, IInterestBearing
    {
        public decimal InterestRate { get; set; }
        public int WithdrawalLimit { get; set; }
        private int withdrawalCount;
        public decimal MinimumBalance { get; set; }

        public SavingsAccount(Customer owner, decimal interestRate = 0.02m)
            : base(owner)
        {
            InterestRate = interestRate;
            WithdrawalLimit = 6;
            withdrawalCount = 0;
            MinimumBalance = 100m;
        }

        public void ApplyInterest()
        {
            decimal interest = CalculateInterest();
            Balance += interest;
            AddTransaction("Interest", interest, "Monthly interest payment");
        }

        public decimal CalculateInterest()
        {
            return Balance * InterestRate / 12; // Місячний відсоток
        }

        public override bool Withdraw(decimal amount)
        {
            if (withdrawalCount >= WithdrawalLimit)
            {
                Console.WriteLine("Withdrawal limit reached for this period");
                return false;
            }

            if (Balance - amount < MinimumBalance)
            {
                Console.WriteLine("Withdrawal would violate minimum balance requirement");
                return false;
            }

            withdrawalCount++;
            return base.Withdraw(amount);
        }

        public void ResetWithdrawalCount()
        {
            withdrawalCount = 0;
        }

        public override string GetAccountType()
        {
            return "Savings Account";
        }
    }

    // Інвестиційний рахунок
    public class InvestmentAccount : BankAccount, IInterestBearing
    {
        public decimal InterestRate { get; set; }
        public string InvestmentType { get; set; }
        public decimal RiskLevel { get; set; }
        public List<Investment> Investments { get; private set; }

        public InvestmentAccount(Customer owner, string investmentType, decimal riskLevel)
            : base(owner)
        {
            InvestmentType = investmentType;
            RiskLevel = riskLevel;
            InterestRate = 0.05m + (riskLevel * 0.02m); // Вищий ризик = вища ставка
            Investments = new List<Investment>();
        }

        public void AddInvestment(Investment investment)
        {
            Investments.Add(investment);
            Balance -= investment.Amount;
            AddTransaction("Investment", -investment.Amount, $"Invested in {investment.Name}");
        }

        public decimal GetTotalInvestmentValue()
        {
            return Investments.Sum(inv => inv.CurrentValue);
        }

        public void ApplyInterest()
        {
            decimal interest = CalculateInterest();
            Balance += interest;
            AddTransaction("Interest", interest, "Investment returns");
        }

        public decimal CalculateInterest()
        {
            return GetTotalInvestmentValue() * InterestRate / 12;
        }

        public override string GetAccountType()
        {
            return $"Investment Account ({InvestmentType})";
        }
    }

    // Кредитна карта
    public class CreditCard : BankAccount, IRewardable, IInterestBearing
    {
        public decimal CreditLimit { get; set; }
        public decimal InterestRate { get; set; }
        public int RewardPoints { get; private set; }
        public decimal RewardRate { get; set; }
        public DateTime DueDate { get; set; }
        public decimal MinimumPayment { get; private set; }

        public CreditCard(Customer owner, decimal creditLimit, decimal interestRate)
            : base(owner)
        {
            CreditLimit = creditLimit;
            InterestRate = interestRate;
            RewardPoints = 0;
            RewardRate = 0.01m; // 1% cash back
            Balance = 0m; // Для кредитки баланс це борг
            DueDate = DateTime.Now.AddMonths(1);
        }

        public override void Deposit(decimal amount)
        {
            // Депозит = платіж по карті
            Balance -= amount;
            if (Balance < 0) Balance = 0; // Не можна переплатити
            AddTransaction("Payment", amount, "Credit card payment");
        }

        public override bool Withdraw(decimal amount)
        {
            // Withdraw = використання кредиту
            if (Balance + amount <= CreditLimit)
            {
                Balance += amount;
                int pointsEarned = (int)(amount * RewardRate * 100);
                AddRewardPoints(pointsEarned);
                AddTransaction("Purchase", amount, "Credit card purchase");
                return true;
            }
            return false;
        }

        public void AddRewardPoints(int points)
        {
            RewardPoints += points;
        }

        public void RedeemRewardPoints(int points)
        {
            if (RewardPoints >= points)
            {
                RewardPoints -= points;
                decimal cashBack = points / 100m;
                Balance -= cashBack;
                AddTransaction("Reward Redemption", -cashBack, $"Redeemed {points} points");
            }
        }

        public void ApplyInterest()
        {
            if (Balance > 0)
            {
                decimal interest = CalculateInterest();
                Balance += interest;
                AddTransaction("Interest Charge", interest, "Monthly interest charge");
            }
        }

        public decimal CalculateInterest()
        {
            return Balance * InterestRate / 12;
        }

        public void CalculateMinimumPayment()
        {
            MinimumPayment = Math.Max(25m, Balance * 0.02m);
        }

        public override string GetAccountType()
        {
            return "Credit Card";
        }
    }

    // Преміум кредитна карта
    public class PremiumCreditCard : CreditCard
    {
        public bool AirportLoungeAccess { get; set; }
        public bool TravelInsurance { get; set; }
        public decimal AnnualFee { get; set; }
        public List<string> BonusCategories { get; private set; }

        public PremiumCreditCard(Customer owner, decimal creditLimit, decimal interestRate)
            : base(owner, creditLimit, interestRate)
        {
            AirportLoungeAccess = true;
            TravelInsurance = true;
            AnnualFee = 450m;
            RewardRate = 0.02m; // 2% cash back
            BonusCategories = new List<string>();
        }

        public void AddBonusCategory(string category)
        {
            BonusCategories.Add(category);
        }

        public void ChargeAnnualFee()
        {
            Balance += AnnualFee;
            AddTransaction("Fee", AnnualFee, "Annual card fee");
        }

        public override string GetAccountType()
        {
            return "Premium Credit Card";
        }
    }

    // Інвестиція
    public class Investment
    {
        public string Name { get; set; }
        public decimal Amount { get; set; }
        public decimal CurrentValue { get; set; }
        public DateTime PurchaseDate { get; set; }
        public string Type { get; set; }

        public Investment(string name, decimal amount, string type)
        {
            Name = name;
            Amount = amount;
            CurrentValue = amount;
            PurchaseDate = DateTime.Now;
            Type = type;
        }

        public decimal GetReturn()
        {
            return CurrentValue - Amount;
        }

        public decimal GetReturnPercentage()
        {
            return (CurrentValue - Amount) / Amount * 100;
        }
    }

    // Банк
    public class Bank
    {
        public string Name { get; set; }
        public string SwiftCode { get; set; }
        public List<Customer> Customers { get; private set; }
        public List<IAccount> Accounts { get; private set; }
        public decimal TotalAssets { get; private set; }

        public Bank(string name, string swiftCode)
        {
            Name = name;
            SwiftCode = swiftCode;
            Customers = new List<Customer>();
            Accounts = new List<IAccount>();
            TotalAssets = 0m;
        }

        public void AddCustomer(Customer customer)
        {
            Customers.Add(customer);
        }

        public void AddAccount(IAccount account)
        {
            Accounts.Add(account);
            TotalAssets += account.GetBalance();
        }

        public int GetTotalCustomers()
        {
            return Customers.Count;
        }

        public int GetTotalAccounts()
        {
            return Accounts.Count;
        }

        public decimal GetTotalDeposits()
        {
            return Accounts.Sum(acc => acc.GetBalance());
        }
    }
}

