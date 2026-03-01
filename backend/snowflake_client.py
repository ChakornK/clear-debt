import snowflake.connector
from dotenv import load_dotenv
import os, json, threading, queue
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
from time import time

load_dotenv()

_POOL_SIZE = 10
_conn_pool: queue.Queue = queue.Queue(maxsize=_POOL_SIZE)
_pool_lock = threading.Lock()
_pool_initialized = False

def _make_conn():
  return snowflake.connector.connect(
    account=os.getenv('SF_ACCOUNT'),
    user=os.getenv('SF_USER'),
    password=os.getenv('SF_PASSWORD'),
    warehouse=os.getenv('SF_WAREHOUSE'),
    database=os.getenv('SF_DATABASE'),
    schema=os.getenv('SF_SCHEMA'),
    role=os.getenv('SF_ROLE'),
    login_timeout=30,
    network_timeout=30,
    client_session_keep_alive=True,
  )

def _init_pool():
  global _pool_initialized
  with _pool_lock:
    if not _pool_initialized:
      for _ in range(_POOL_SIZE):
        _conn_pool.put(_make_conn())
      _pool_initialized = True

@contextmanager
def get_connection():
  _init_pool()
  conn = _conn_pool.get()  # blocks until a connection is available
  try:
    # Reconnect if session has gone stale
    if conn.is_closed():
      conn = _make_conn()
    yield conn
  except Exception:
    # On error, replace the connection rather than returning a broken one
    try:
      conn.close()
    except Exception:
      pass
    conn = _make_conn()
    raise
  finally:
    _conn_pool.put(conn)  # return to pool

def ensure_schema():
  """Call once at app startup to avoid redundant DDL on every save."""
  with get_connection() as conn:
    cur = conn.cursor()
    for stmt in [
      "ALTER TABLE TRANSACTIONS ADD COLUMN IF NOT EXISTS TRANSACTION_ID STRING",
      "ALTER TABLE TRANSACTIONS ADD COLUMN IF NOT EXISTS IS_INCOME BOOLEAN DEFAULT FALSE",
      "CREATE TABLE IF NOT EXISTS USER_MILESTONES (USER_ID STRING, MILESTONE_JSON VARIANT, CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP())",
      "CREATE TABLE IF NOT EXISTS CATEGORY_MAPPINGS (RAW_CATEGORY STRING PRIMARY KEY, BUCKET_NAME STRING)",
      "CREATE TABLE IF NOT EXISTS USER_PREFERENCES (USER_ID STRING PRIMARY KEY, MONTHLY_INCOME FLOAT, MONTHLY_LIMIT FLOAT, SAVINGS_PCT FLOAT)",
    ]:
      cur.execute(stmt)
    conn.commit()

def save_access_token(user_id, access_token, item_id):
  with get_connection() as conn:
    cur = conn.cursor()
    cur.execute("DELETE FROM PLAID_TOKENS WHERE USER_ID = %s", (user_id,))
    cur.execute(
      "INSERT INTO PLAID_TOKENS (USER_ID, ACCESS_TOKEN, ITEM_ID) VALUES (%s, %s, %s)",
      (user_id, access_token, item_id)
    )
    conn.commit()

def get_access_token(user_id):
  with get_connection() as conn:
    cur = conn.cursor()
    cur.execute("SELECT ACCESS_TOKEN FROM PLAID_TOKENS WHERE USER_ID = %s", (user_id,))
    row = cur.fetchone()
    return row[0] if row else None

def save_debts(user_id, debts):
  with get_connection() as conn:
    cur = conn.cursor()
    cur.execute("DELETE FROM USER_DEBTS WHERE USER_ID = %s", (user_id,))
    cur.executemany("""
      INSERT INTO USER_DEBTS 
      (USER_ID, DEBT_ID, NAME, TYPE, BALANCE, APR, MINIMUM, DUE_DAY, SOURCE)
      VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, [
      (user_id, d['id'], d['name'], d['type'],
       d['balance'], d['apr'], d['minimum'], d['due'], d.get('source', 'manual'))
      for d in debts
    ])
    conn.commit()

def get_debts(user_id):
  with get_connection() as conn:
    cur = conn.cursor(snowflake.connector.DictCursor)
    cur.execute("SELECT DEBT_ID, NAME, TYPE, BALANCE, APR, MINIMUM, DUE_DAY, SOURCE FROM USER_DEBTS WHERE USER_ID = %s", (user_id,))
    rows = cur.fetchall()
    return [{k.lower(): v for k, v in row.items()} for row in rows]

def get_transactions_raw(user_id):
  with get_connection() as conn:
    cur = conn.cursor()
    cur.execute("""
      SELECT TX_DATE, CATEGORY, AMOUNT, DESCRIPTION, TRANSACTION_ID, IS_INCOME 
      FROM TRANSACTIONS
      WHERE USER_ID = %s
      ORDER BY TX_DATE DESC
    """, (user_id,))
    return [{'date': str(r[0]), 'category': r[1], 'amount': r[2], 'description': r[3], 'id': r[4], 'is_income': r[5]} for r in cur.fetchall()]

def save_transactions(user_id, transactions):
  with get_connection() as conn:
    cur = conn.cursor()
    cur.executemany("""
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
    """, [
      (user_id, t['date'], t['category'], t['amount'], t['description'], t.get('id'), t.get('is_income', False))
      for t in transactions
    ])
    conn.commit()

def get_spending_summary(user_id):
  with get_connection() as conn:
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
    return [{'category': r[0], 'total': r[1], 'avg_tx': r[2]} for r in cur.fetchall()]

def save_calendar_events(user_id, events):
  with get_connection() as conn:
    cur = conn.cursor()
    cur.executemany("""
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
    """, [(user_id, e['date'], e['type'], e['label'], e['amount']) for e in events])
    conn.commit()

def get_calendar_events(user_id, future_only=False):
  with get_connection() as conn:
    cur = conn.cursor()
    query = "SELECT EVENT_DATE, TYPE, LABEL, AMOUNT FROM CALENDAR_EVENTS WHERE USER_ID = %s"
    if future_only:
      query += " AND EVENT_DATE >= CURRENT_DATE"
    query += " ORDER BY EVENT_DATE ASC"
    cur.execute(query, (user_id,))
    return [{'date': str(r[0]), 'type': r[1], 'label': r[2], 'amount': r[3]} for r in cur.fetchall()]

def delete_calendar_event(user_id, date, label):
    with get_connection() as conn:
        cur = conn.cursor()
        clean_date = date.split("T")[0]
        cur.execute("""
            DELETE FROM CALENDAR_EVENTS 
            WHERE USER_ID = %s 
            AND EVENT_DATE = %s 
            AND LABEL = %s
        """, (user_id, clean_date, label))
        conn.commit()
        return cur.rowcount  

def save_plan(user_id, plan):
  with get_connection() as conn:
    cur = conn.cursor()
    cur.execute("""
      INSERT INTO REPAYMENT_PLANS (USER_ID, PLAN_JSON)
      SELECT %s, PARSE_JSON(%s)
    """, (user_id, json.dumps(plan)))
    conn.commit()

def get_dashboard_data(user_id):
  def fetch_debts():
    with get_connection() as conn:
      cur = conn.cursor()
      cur.execute("SELECT DEBT_ID, NAME, TYPE, BALANCE, APR, MINIMUM, DUE_DAY, SOURCE FROM USER_DEBTS WHERE USER_ID = %s", (user_id,))
      cols = ['id', 'name', 'type', 'balance', 'apr', 'minimum', 'due', 'source']
      return [dict(zip(cols, row)) for row in cur.fetchall()]

  def fetch_spending():
    with get_connection() as conn:
      cur = conn.cursor()
      cur.execute("""
        SELECT CATEGORY, ROUND(SUM(AMOUNT), 2), ROUND(AVG(AMOUNT), 2)
        FROM TRANSACTIONS
        WHERE USER_ID = %s AND TX_DATE >= DATEADD(day, -90, CURRENT_DATE)
          AND IS_INCOME = FALSE
        GROUP BY CATEGORY ORDER BY 2 DESC
      """, (user_id,))
      return [{'category': r[0], 'total': r[1], 'avg_tx': r[2]} for r in cur.fetchall()]

  def fetch_events():
    with get_connection() as conn:
      cur = conn.cursor()
      cur.execute("SELECT EVENT_DATE, TYPE, LABEL, AMOUNT FROM CALENDAR_EVENTS WHERE USER_ID = %s ORDER BY EVENT_DATE ASC", (user_id,))
      return [{'date': str(r[0]), 'type': r[1], 'label': r[2], 'amount': r[3]} for r in cur.fetchall()]

  def fetch_txns():
    with get_connection() as conn:
      cur = conn.cursor()
      cur.execute("SELECT TX_DATE, CATEGORY, AMOUNT, DESCRIPTION, TRANSACTION_ID, IS_INCOME FROM TRANSACTIONS WHERE USER_ID = %s ORDER BY TX_DATE DESC", (user_id,))
      return [{'date': str(r[0]), 'category': r[1], 'amount': r[2], 'description': r[3], 'id': r[4], 'is_income': r[5]} for r in cur.fetchall()]

  def fetch_prefs():
    with get_connection() as conn:
      cur = conn.cursor()
      try:
        cur.execute("SELECT MONTHLY_LIMIT FROM USER_PREFERENCES WHERE USER_ID = %s", (user_id,))
        row = cur.fetchone()
        return row[0] if row else 500
      except:
        return 500

  def fetch_cat_map():
    with get_connection() as conn:
      cur = conn.cursor()
      try:
        cur.execute("SELECT RAW_CATEGORY, BUCKET_NAME FROM CATEGORY_MAPPINGS")
        return {row[0]: row[1] for row in cur.fetchall()}
      except:
        return {}

  with ThreadPoolExecutor(max_workers=6) as ex:
    f_debts   = ex.submit(fetch_debts)
    f_spend   = ex.submit(fetch_spending)
    f_events  = ex.submit(fetch_events)
    f_txns   = ex.submit(fetch_txns)
    f_prefs   = ex.submit(fetch_prefs)
    f_cat_map = ex.submit(fetch_cat_map)

  return {
    "debts":       f_debts.result(),
    "spending":     f_spend.result(),
    "events":      f_events.result(),
    "raw_txns":     f_txns.result(),
    "cat_map":      f_cat_map.result(),
    "monthly_limit": f_prefs.result(),
  }

def get_cached_milestone(user_id):
  with get_connection() as conn:
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

def save_milestone(user_id, milestone):
  with get_connection() as conn:
    cur = conn.cursor()
    cur.execute("""
      INSERT INTO USER_MILESTONES (USER_ID, MILESTONE_JSON)
      SELECT %s, PARSE_JSON(%s)
    """, (user_id, json.dumps(milestone)))
    conn.commit()

# In-process cache for category mappings (rarely change, frequently read)
_cat_cache = {"data": {}, "ts": 0}
_CAT_TTL = 300  # 5 minutes

def get_cached_category_mappings():
  now = time()
  if now - _cat_cache["ts"] < _CAT_TTL:
    return _cat_cache["data"]
  with get_connection() as conn:
    cur = conn.cursor()
    try:
      cur.execute("SELECT RAW_CATEGORY, BUCKET_NAME FROM CATEGORY_MAPPINGS")
      result = {row[0]: row[1] for row in cur.fetchall()}
      _cat_cache.update({"data": result, "ts": now})
      return result
    except:
      return {}

def save_category_mappings(mappings):
  with get_connection() as conn:
    cur = conn.cursor()
    cur.executemany("""
      MERGE INTO CATEGORY_MAPPINGS AS target
      USING (SELECT %s AS RAW_CATEGORY, %s AS BUCKET_NAME) AS source
      ON target.RAW_CATEGORY = source.RAW_CATEGORY
      WHEN MATCHED THEN UPDATE SET BUCKET_NAME = source.BUCKET_NAME
      WHEN NOT MATCHED THEN INSERT (RAW_CATEGORY, BUCKET_NAME) VALUES (source.RAW_CATEGORY, source.BUCKET_NAME)
    """, list(mappings.items()))
    conn.commit()
  # Invalidate cache
  _cat_cache["ts"] = 0

def save_user_preferences(user_id, income, limit, savings_pct):
  with get_connection() as conn:
    cur = conn.cursor()
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

def get_user_preferences(user_id):
  with get_connection() as conn:
    cur = conn.cursor()
    cur.execute("SELECT MONTHLY_INCOME, MONTHLY_LIMIT, SAVINGS_PCT FROM USER_PREFERENCES WHERE USER_ID = %s", (user_id,))
    row = cur.fetchone()
    if row:
      return {"monthly_income": row[0], "monthly_limit": row[1], "savings_pct": row[2]}
    return None