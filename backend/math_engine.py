def calc_strategy(debts, extra_payment, method):
    accounts = [{
        'id': d['id'], 'name': d['name'],
        'remaining': float(d['balance']),
        'apr': float(d['apr']),
        'minimum': float(d['minimum'])
    } for d in debts if float(d['balance']) > 0]

    if method == 'avalanche':
        accounts.sort(key=lambda x: x['apr'], reverse=True)
    elif method == 'snowball':
        accounts.sort(key=lambda x: x['remaining'])

    months, total_interest = 0, 0.0
    breakdown = []

    while any(a['remaining'] > 0 for a in accounts) and months < 360:
        months += 1
        extra = float(extra_payment)
        month_data = {'month': months, 'balances': {}}

        for a in accounts:
            if a['remaining'] <= 0:
                month_data['balances'][a['id']] = 0
                continue
            interest = (a['remaining'] * a['apr'] / 100) / 12
            total_interest += interest
            available = a['minimum'] + extra
            payment = min(a['remaining'] + interest, available)
            freed = max(0, payment - (a['remaining'] + interest))
            extra = max(0, extra - (payment - a['minimum'])) + freed
            a['remaining'] = max(0, a['remaining'] + interest - payment)
            month_data['balances'][a['id']] = round(a['remaining'], 2)

        breakdown.append(month_data)

    return {
        'total_interest': round(total_interest, 2),
        'months_to_payoff': months,
        'priority_order': [a['name'] for a in accounts],
        'breakdown': breakdown
    }

def calc_all_strategies(debts, extra_payment=200):
    return {
        'avalanche': calc_strategy(debts, extra_payment, 'avalanche'),
        'snowball': calc_strategy(debts, extra_payment, 'snowball'),
        'minimum': calc_strategy(debts, 0, 'minimum')
    }