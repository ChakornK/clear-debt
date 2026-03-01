import plaid
from plaid.api import plaid_api
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.transactions_get_request_options import TransactionsGetRequestOptions
from plaid.model.liabilities_get_request import LiabilitiesGetRequest
from dotenv import load_dotenv
from datetime import date, timedelta
import os

load_dotenv()

def get_plaid_client():
    configuration = plaid.Configuration(
        host=plaid.Environment.Sandbox,
        api_key={
            'clientId': os.getenv('PLAID_CLIENT_ID'),
            'secret': os.getenv('PLAID_SECRET'),
        }
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)

def create_link_token(user_id: str):
    client = get_plaid_client()
    request = LinkTokenCreateRequest(
        products=[Products('transactions'), Products('liabilities')],
        client_name='ClearDebt',
        country_codes=[CountryCode('CA'), CountryCode('US')],
        language='en',
        user=LinkTokenCreateRequestUser(client_user_id=user_id)
    )
    response = client.link_token_create(request)
    return response['link_token']

def exchange_public_token(public_token: str):
    client = get_plaid_client()
    request = ItemPublicTokenExchangeRequest(public_token=public_token)
    response = client.item_public_token_exchange(request)
    return response['access_token'], response['item_id']

def get_accounts(access_token: str):
    client = get_plaid_client()
    request = AccountsGetRequest(access_token=access_token)
    response = client.accounts_get(request)
    accounts = []
    for a in response['accounts']:
        accounts.append({
            'id': a['account_id'],
            'name': a['name'],
            'type': str(a['type']),
            'subtype': str(a['subtype']),
            'balance': a['balances']['current'] or 0,
        })
    return accounts

def get_transactions(access_token: str, days: int = 90, offset: int = 0, count: int = 100):
    client = get_plaid_client()
    end = date.today()
    start = end - timedelta(days=days)
    request = TransactionsGetRequest(
        access_token=access_token,
        start_date=start,
        end_date=end,
        options=TransactionsGetRequestOptions(
            count=count,
            offset=offset
        )
    )
    response = client.transactions_get(request)
    transactions = []
    for t in response['transactions']:
        amt = t['amount']
        transactions.append({
            'id': t['transaction_id'],
            'date': str(t['date']),
            'category': t['category'][0] if t['category'] else 'Other',
            'amount': abs(amt),
            'is_income': amt < 0,
            'description': t['name']
        })
    return transactions, response['total_transactions']

def get_liabilities(access_token: str):
    client = get_plaid_client()
    request = LiabilitiesGetRequest(access_token=access_token)
    response = client.liabilities_get(request)
    debts = []
    liabilities = response['liabilities']

    for cc in liabilities.get('credit', []):
        debts.append({
            'id': cc['account_id'],
            'name': cc['account_id'],
            'type': 'Credit Card',
            'balance': cc['last_statement_balance'] or 0,
            'apr': cc['aprs'][0]['apr_percentage'] if cc['aprs'] else 19.99,
            'minimum': cc['minimum_payment_amount'] or 25,
            'due': cc['next_payment_due_date'].day if cc['next_payment_due_date'] else 1,
            'source': 'plaid'
        })

    for sl in liabilities.get('student', []):
        debts.append({
            'id': sl['account_id'],
            'name': 'Student Loan',
            'type': 'Student Loan',
            'balance': sl['outstanding_interest_amount'] or 0,
            'apr': sl['interest_rate_percentage'] or 5.5,
            'minimum': sl['minimum_payment_amount'] or 100,
            'due': sl['next_payment_due_date'].day if sl['next_payment_due_date'] else 1,
            'source': 'plaid'
        })

    return debts