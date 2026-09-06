from dataclasses import dataclass, field
from typing import List


MICRO_FINANCE_MAX_PROJECT_COST = 140_000
TERM_LOAN_MAX_PROJECT_COST = 5_000_000

MARGIN_PERCENT = 0.10
LOAN_PERCENT = 0.90

SCHEMES = {
    "Micro Finance Scheme": {
        "interest_rate_annual": 0.065,
        "tenure_years": 3,
        "moratorium_months": 3,
        "max_loan": 125_000,
    },
    "Term Loan Scheme": {
        "interest_rate_annual": 0.08,
        "tenure_years": 7,
        "moratorium_months": 6,
        "max_loan": 4_500_000,
    },
}


@dataclass
class EMIInstallment:
    quarter: int
    opening_balance: float
    emi: float
    interest_component: float
    principal_component: float
    closing_balance: float


@dataclass
class FinancialPlan:
    available_capital: float
    project_cost: float
    loan_amount: float
    scheme_name: str
    interest_rate_annual: float
    tenure_years: int
    moratorium_months: int
    quarterly_emi: float
    total_interest_payable: float
    total_repayment: float
    emi_schedule: List[EMIInstallment] = field(default_factory=list)


class FinancialEngineError(ValueError):
    pass


def calculate_project_cost(available_capital: float) -> float:
    if available_capital <= 0:
        raise FinancialEngineError("Available capital must be greater than zero.")
    return round(available_capital / MARGIN_PERCENT, 2)


def calculate_loan_amount(project_cost: float) -> float:
    return round(project_cost * LOAN_PERCENT, 2)


def select_scheme(project_cost: float) -> str:
    if project_cost <= MICRO_FINANCE_MAX_PROJECT_COST:
        return "Micro Finance Scheme"
    elif project_cost <= TERM_LOAN_MAX_PROJECT_COST:
        return "Term Loan Scheme"
    else:
        raise FinancialEngineError(
            f"Project cost Rs. {project_cost:,.2f} exceeds Rs. 50,00,000 - no matching scheme."
        )


def generate_emi_schedule(loan_amount: float, scheme_name: str):
    scheme = SCHEMES[scheme_name]
    annual_rate = scheme["interest_rate_annual"]
    tenure_years = scheme["tenure_years"]
    moratorium_months = scheme["moratorium_months"]

    quarterly_rate = annual_rate / 4
    total_quarters = tenure_years * 4
    moratorium_quarters = round(moratorium_months / 3)
    repayment_quarters = total_quarters - moratorium_quarters

    if repayment_quarters <= 0:
        raise FinancialEngineError("Moratorium period exceeds total tenure.")

    schedule: List[EMIInstallment] = []
    balance = loan_amount
    quarter_num = 0

    for _ in range(moratorium_quarters):
        quarter_num += 1
        interest = round(balance * quarterly_rate, 2)
        schedule.append(EMIInstallment(
            quarter=quarter_num,
            opening_balance=round(balance, 2),
            emi=0.0,
            interest_component=interest,
            principal_component=0.0,
            closing_balance=round(balance + interest, 2),
        ))
        balance += interest

    r = quarterly_rate
    n = repayment_quarters
    if r == 0:
        emi = balance / n
    else:
        emi = balance * r * (1 + r) ** n / ((1 + r) ** n - 1)
    emi = round(emi, 2)

    for _ in range(repayment_quarters):
        quarter_num += 1
        interest_component = round(balance * quarterly_rate, 2)
        principal_component = round(emi - interest_component, 2)
        closing_balance = round(balance - principal_component, 2)
        schedule.append(EMIInstallment(
            quarter=quarter_num,
            opening_balance=round(balance, 2),
            emi=emi,
            interest_component=interest_component,
            principal_component=principal_component,
            closing_balance=max(closing_balance, 0.0),
        ))
        balance = closing_balance

    total_repayment = round(sum(i.emi for i in schedule), 2)
    total_interest = round(sum(i.interest_component for i in schedule), 2)

    return emi, schedule, total_interest, total_repayment


def build_financial_plan(available_capital: float) -> FinancialPlan:
    project_cost = calculate_project_cost(available_capital)
    loan_amount = calculate_loan_amount(project_cost)
    scheme_name = select_scheme(project_cost)
    scheme = SCHEMES[scheme_name]

    loan_amount = min(loan_amount, scheme["max_loan"])

    emi, schedule, total_interest, total_repayment = generate_emi_schedule(loan_amount, scheme_name)

    return FinancialPlan(
        available_capital=available_capital,
        project_cost=project_cost,
        loan_amount=loan_amount,
        scheme_name=scheme_name,
        interest_rate_annual=scheme["interest_rate_annual"],
        tenure_years=scheme["tenure_years"],
        moratorium_months=scheme["moratorium_months"],
        quarterly_emi=emi,
        total_interest_payable=total_interest,
        total_repayment=total_repayment,
        emi_schedule=schedule,
    )
