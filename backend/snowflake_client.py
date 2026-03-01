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
        SELECT TX_DATE, CATEGORY, AMOUNT, DESCRIPTION, TRANSACTION_ID, IS_INCOME 
        FROM TRANSACTIONS
        WHERE USER_ID = %s
        ORDER BY TX_DATE DESC
    """, (user_id,))
    rows = cur.fetchall()
    cur.close(); conn.close()
    return [{'date': str(r[0]), 'category': r[1], 'amount': r[2], 'description': r[3], 'id': r[4], 'is_income': r[5]} for r in rows]

def save_transactions(user_id, transactions):
    conn = get_connection()
    cur = conn.cursor()
    # Try to add TRANSACTION_ID and IS_INCOME columns if they don't exist
    try:
        cur.execute("ALTER TABLE TRANSACTIONS ADD COLUMN TRANSACTION_ID STRING")
    except:
        pass
    try:
        cur.execute("ALTER TABLE TRANSACTIONS ADD COLUMN IS_INCOME BOOLEAN DEFAULT FALSE")
    except:
        pass

    for t in transactions:
        is_inc = t.get('is_income', False)
        cur.execute("""
            MERGE INTO TRANSACTIONS AS target
            USING (SELECT %s AS USER_ID, %s AS TX_DATE, %s AS CATEGORY, 
                          %s AS AMOUNT, %s AS DESCRIPTION, %s AS TRANSACTION_ID, %s AS IS_INCOME) AS source
            ON target.USER_ID = source.USER_ID 
               AND (target.TRANSACTION_ID = source.TRANSACTION_ID OR 
                   (target.TX_DATE = source.TX_DATE AND target.AMOUNT = source.AMOUNT AND target.DESCRIPTION = source.DESCRIPTION))
            WHEN MATCHED THEN UPDATE SET 
                CATEGORY = source.CATEGORY, AMOUNT = source.AMOUNT, DESCRIPTION = source.DESCRIPTION, IS_INCOME = source.IS_INCOME
            WHEN NOT MATCHED THEN INSERT 
                (USER_ID, TX_DATE, CATEGORY, AMOUNT, DESCRIPTION, TRANSACTION_ID, IS_INCOME)
            VALUES (source.USER_ID, source.TX_DATE, source.CATEGORY, 
                    source.AMOUNT, source.DESCRIPTION, source.TRANSACTION_ID, source.IS_INCOME)
        """, (user_id, t['date'], t['category'], t['amount'], t['description'], t.get('id'), is_inc))
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
        AND IS_INCOME = FALSE
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

def get_dashboard_data(user_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        # 1. Debts
        cur.execute("SELECT DEBT_ID, NAME, TYPE, BALANCE, APR, MINIMUM, DUE_DAY, SOURCE FROM USER_DEBTS WHERE USER_ID = %s", (user_id,))
        debt_rows = cur.fetchall()
        cols = ['id','name','type','balance','apr','minimum','due','source']
        debts = [dict(zip(cols, row)) for row in debt_rows]

        # 2. Spending Summary (90 days)
        cur.execute("""
            SELECT CATEGORY, ROUND(SUM(AMOUNT), 2) as TOTAL, ROUND(AVG(AMOUNT), 2) as AVG_TX
            FROM TRANSACTIONS
            WHERE USER_ID = %s AND TX_DATE >= DATEADD(day, -90, CURRENT_DATE)
            GROUP BY CATEGORY ORDER BY TOTAL DESC
        """, (user_id,))
        spending = [{'category': r[0], 'total': r[1], 'avg_tx': r[2]} for r in cur.fetchall()]

        # 3. Calendar Events
        cur.execute("SELECT EVENT_DATE, TYPE, LABEL, AMOUNT FROM CALENDAR_EVENTS WHERE USER_ID = %s ORDER BY EVENT_DATE ASC", (user_id,))
        events = [{'date': str(r[0]), 'type': r[1], 'label': r[2], 'amount': r[3]} for r in cur.fetchall()]

        # 4. Raw Transactions
        cur.execute("SELECT TX_DATE, CATEGORY, AMOUNT, DESCRIPTION, TRANSACTION_ID, IS_INCOME FROM TRANSACTIONS WHERE USER_ID = %s ORDER BY TX_DATE DESC", (user_id,))
        raw_txns = [{'date': str(r[0]), 'category': r[1], 'amount': r[2], 'description': r[3], 'id': r[4], 'is_income': r[5]} for r in cur.fetchall()]

        # 5. Category Mappings
        cat_map = {}
        try:
            cur.execute("SELECT RAW_CATEGORY, BUCKET_NAME FROM CATEGORY_MAPPINGS")
            cat_map = {row[0]: row[1] for row in cur.fetchall()}
        except:
            pass # Table might not exist yet

        return {
            "debts": debts,
            "spending": spending,
            "events": events,
            "raw_txns": raw_txns,
            "cat_map": cat_map
        }
    finally:
        cur.close(); conn.close()

def get_cached_milestone(user_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT MILESTONE_JSON FROM USER_MILESTONES
            WHERE USER_ID = %s
            AND CREATED_AT >= DATEADD(day, -1, CURRENT_TIMESTAMP)
            ORDER BY CREATED_AT DESC LIMIT 1
        """, (user_id,))
        row = cur.fetchone()
        return json.loads(row[0]) if row else None
    except:
        return None
    finally:
        cur.close(); conn.close()

def save_milestone(user_id, milestone):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS USER_MILESTONES (
                USER_ID STRING,
                MILESTONE_JSON VARIANT,
                CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
            )
        """)
        cur.execute("""
            INSERT INTO USER_MILESTONES (USER_ID, MILESTONE_JSON)
            SELECT %s, PARSE_JSON(%s)
        """, (user_id, json.dumps(milestone)))
        conn.commit()
    finally:
        cur.close(); conn.close()

def get_cached_category_mappings():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT RAW_CATEGORY, BUCKET_NAME FROM CATEGORY_MAPPINGS")
        rows = cur.fetchall()
        return {row[0]: row[1] for row in rows}
    except:
        return {}
    finally:
        cur.close(); conn.close()

def save_category_mappings(mappings):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("CREATE TABLE IF NOT EXISTS CATEGORY_MAPPINGS (RAW_CATEGORY STRING PRIMARY KEY, BUCKET_NAME STRING)")
        for raw, bucket in mappings.items():
            cur.execute("""
                MERGE INTO CATEGORY_MAPPINGS AS target
                USING (SELECT %s AS RAW_CATEGORY, %s AS BUCKET_NAME) AS source
                ON target.RAW_CATEGORY = source.RAW_CATEGORY
                WHEN MATCHED THEN UPDATE SET BUCKET_NAME = source.BUCKET_NAME
                WHEN NOT MATCHED THEN INSERT (RAW_CATEGORY, BUCKET_NAME) VALUES (source.RAW_CATEGORY, source.BUCKET_NAME)
            """, (raw, bucket))
        conn.commit()
    finally:
        cur.close(); conn.close()


def save_user_preferences(user_id, income, limit, savings_pct):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS USER_PREFERENCES (
                USER_ID STRING PRIMARY KEY,
                MONTHLY_INCOME FLOAT,
                MONTHLY_LIMIT FLOAT,
                SAVINGS_PCT FLOAT
            )
        """)
        cur.execute("""
            MERGE INTO USER_PREFERENCES AS target
            USING (SELECT %s AS USER_ID, %s AS MONTHLY_INCOME, %s AS MONTHLY_LIMIT, %s AS SAVINGS_PCT) AS source
            ON target.USER_ID = source.USER_ID
            WHEN MATCHED THEN UPDATE SET 
                MONTHLY_INCOME = source.MONTHLY_INCOME,
                MONTHLY_LIMIT = source.MONTHLY_LIMIT,
                SAVINGS_PCT = source.SAVINGS_PCT
            WHEN NOT MATCHED THEN INSERT 
                (USER_ID, MONTHLY_INCOME, MONTHLY_LIMIT, SAVINGS_PCT)
            VALUES (source.USER_ID, source.MONTHLY_INCOME, source.MONTHLY_LIMIT, source.SAVINGS_PCT)
        """, (user_id, income, limit, savings_pct))
        conn.commit()
    finally:
        cur.close(); conn.close()

def get_user_preferences(user_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT MONTHLY_INCOME, MONTHLY_LIMIT, SAVINGS_PCT FROM USER_PREFERENCES WHERE USER_ID = %s", (user_id,))
        row = cur.fetchone()
        if row:
            return {
                "monthly_income": row[0],
                "monthly_limit": row[1],
                "savings_pct": row[2]
            }
        return None
    finally:
        cur.close(); conn.close()
