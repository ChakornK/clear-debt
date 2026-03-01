import snowflake.connector
from dotenv import load_dotenv
import os, json

load_dotenv()

def get_connection():
    return snowflake.connector.connect(
        account=os.getenv('SF_ACCOUNT'),
        user=os.getenv('SF_USER'),
        password=os.getenv('SF_PASSWORD'),
        warehouse=os.getenv('SF_WAREHOUSE'),
        database=os.getenv('SF_DATABASE'),
        schema=os.getenv('SF_SCHEMA'),
        role=os.getenv('SF_ROLE'),
        login_timeout=30,
        network_timeout=30
    )

def save_access_token(user_id, access_token, item_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM PLAID_TOKENS WHERE USER_ID = %s", (user_id,))
    cur.execute(
        "INSERT INTO PLAID_TOKENS (USER_ID, ACCESS_TOKEN, ITEM_ID) VALUES (%s, %s, %s)",
        (user_id, access_token, item_id)
    )
    conn.commit()
    cur.close(); conn.close()

def get_access_token(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT ACCESS_TOKEN FROM PLAID_TOKENS WHERE USER_ID = %s", (user_id,))
    row = cur.fetchone()
    cur.close(); conn.close()
    return row[0] if row else None

def save_debts(user_id, debts):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM USER_DEBTS WHERE USER_ID = %s", (user_id,))
    for d in debts:
        cur.execute("""
            INSERT INTO USER_DEBTS 
            (USER_ID, DEBT_ID, NAME, TYPE, BALANCE, APR, MINIMUM, DUE_DAY, SOURCE)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (user_id, d['id'], d['name'], d['type'],
              d['balance'], d['apr'], d['minimum'], d['due'], d.get('source','manual')))
    conn.commit()
    cur.close(); conn.close()

def get_debts(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT DEBT_ID, NAME, TYPE, BALANCE, APR, MINIMUM, DUE_DAY, SOURCE FROM USER_DEBTS WHERE USER_ID = %s", (user_id,))
    rows = cur.fetchall()
    cols = ['id','name','type','balance','apr','minimum','due','source']
    cur.close(); conn.close()
    return [dict(zip(cols, row)) for row in rows]

def get_transactions_raw(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT TX_DATE, CATEGORY, AMOUNT, DESCRIPTION 
        FROM TRANSACTIONS
        WHERE USER_ID = %s
        ORDER BY TX_DATE DESC
    """, (user_id,))
    rows = cur.fetchall()
    cur.close(); conn.close()
    return [{'date': str(r[0]), 'category': r[1], 'amount': r[2], 'description': r[3]} for r in rows]

def save_transactions(user_id, transactions):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM TRANSACTIONS WHERE USER_ID = %s", (user_id,))
    for t in transactions:
        cur.execute("""
            INSERT INTO TRANSACTIONS (USER_ID, TX_DATE, CATEGORY, AMOUNT, DESCRIPTION)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, t['date'], t['category'], t['amount'], t['description']))
    conn.commit()
    cur.close(); conn.close()

def get_spending_summary(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT CATEGORY, ROUND(SUM(AMOUNT), 2) as TOTAL,
               ROUND(AVG(AMOUNT), 2) as AVG_TX
        FROM TRANSACTIONS
        WHERE USER_ID = %s
        AND TX_DATE >= DATEADD(day, -90, CURRENT_DATE)
        GROUP BY CATEGORY
        ORDER BY TOTAL DESC
    """, (user_id,))
    rows = cur.fetchall()
    cur.close(); conn.close()
    return [{'category': r[0], 'total': r[1], 'avg_tx': r[2]} for r in rows]

def save_calendar_events(user_id, events):
    conn = get_connection()
    cur = conn.cursor()
    for e in events:
        cur.execute("""
            MERGE INTO CALENDAR_EVENTS AS target
            USING (SELECT %s AS USER_ID, %s AS EVENT_DATE, %s AS TYPE, 
                          %s AS LABEL, %s AS AMOUNT) AS source
            ON target.USER_ID = source.USER_ID 
               AND target.EVENT_DATE = source.EVENT_DATE
               AND target.LABEL = source.LABEL
            WHEN MATCHED THEN UPDATE SET 
                TYPE = source.TYPE, AMOUNT = source.AMOUNT
            WHEN NOT MATCHED THEN INSERT 
                (USER_ID, EVENT_DATE, TYPE, LABEL, AMOUNT)
            VALUES (source.USER_ID, source.EVENT_DATE, source.TYPE, 
                    source.LABEL, source.AMOUNT)
        """, (user_id, e['date'], e['type'], e['label'], e['amount']))
    conn.commit()
    cur.close(); conn.close()

def get_calendar_events(user_id, future_only=False):
    conn = get_connection()
    cur = conn.cursor()
    query = """
        SELECT EVENT_DATE, TYPE, LABEL, AMOUNT FROM CALENDAR_EVENTS
        WHERE USER_ID = %s
    """
    if future_only:
        query += " AND EVENT_DATE >= CURRENT_DATE"
    query += " ORDER BY EVENT_DATE ASC"
    cur.execute(query, (user_id,))
    rows = cur.fetchall()
    cur.close(); conn.close()
    return [{'date': str(r[0]), 'type': r[1], 'label': r[2], 'amount': r[3]} for r in rows]

def save_plan(user_id, plan):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO REPAYMENT_PLANS (USER_ID, PLAN_JSON)
        SELECT %s, PARSE_JSON(%s)
    """, (user_id, json.dumps(plan)))
    conn.commit()
    cur.close(); conn.close()

