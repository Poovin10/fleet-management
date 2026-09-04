import streamlit as st
import pandas as pd
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from datetime import date
import io
import time
import os
import tempfile

# --- Safely Import FPDF ---
try:
    from fpdf import FPDF
    HAS_FPDF = True
except ImportError:
    HAS_FPDF = False

# ==============================================================================
# 1. PAGE CONFIGURATION & ENTERPRISE UI STYLING
# ==============================================================================
st.set_page_config(
    page_title="KSS Roadways ERP",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    html, body, [class*="css"] { font-family: 'Inter', -apple-system, sans-serif !important; color: #1E293B !important; }
    .stApp { background: #F8FAFC !important; }
    header, #MainMenu, footer { visibility: hidden; display: none !important; }
    
    @keyframes fadeInScale {
        0% { opacity: 0; transform: translateY(10px) scale(0.99); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    .main .block-container {
        animation: fadeInScale 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        padding-top: 1.5rem !important; padding-bottom: 2rem !important;
        padding-left: 2rem !important; padding-right: 2rem !important;
        max-width: 1500px !important;
    }

    div[data-testid="stForm"] {
        background: #FFFFFF !important;
        border: 1px solid #E2E8F0 !important;
        border-radius: 12px !important;
        padding: 24px !important;
        box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.05) !important;
    }

    div[data-testid="metric-container"] {
        background: #FFFFFF !important;
        border: 1px solid #E2E8F0 !important;
        border-radius: 10px !important;
        padding: 16px 20px !important;
        border-left: 4px solid #4F46E5 !important;
        box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.04) !important;
    }
    div[data-testid="stMetricValue"] { font-size: 1.5rem !important; font-weight: 800 !important; color: #0F172A !important; }
    div[data-testid="stMetricLabel"] { font-size: 0.75rem !important; font-weight: 700 !important; color: #64748B !important; text-transform: uppercase !important; }

    .section-header {
        font-size: 1.05rem !important; font-weight: 800 !important; color: #1E293B !important;
        border-bottom: 2px solid #E2E8F0 !important; padding-bottom: 6px !important;
        margin: 20px 0 16px 0 !important; text-transform: uppercase !important; letter-spacing: 0.5px !important;
    }

    .stTextInput>div>div>input, .stNumberInput>div>div>input, .stSelectbox>div>div>div {
        height: 44px !important; font-size: 0.92rem !important; font-weight: 500 !important;
        border-radius: 8px !important; background-color: #F8FAFC !important;
        border: 1px solid #CBD5E1 !important; color: #1E293B !important; 
    }
    .stTextInput>div>div>input:focus, .stNumberInput>div>div>input:focus, .stSelectbox>div>div>div:focus {
        background-color: #FFFFFF !important; border-color: #4F46E5 !important; 
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15) !important;
    }
    .stTextInput>div>div>input:disabled { background-color: #F1F5F9 !important; color: #64748B !important; font-weight: 700 !important; border-color: #E2E8F0 !important; }

    .stButton>button { height: 46px !important; font-weight: 600 !important; border-radius: 8px !important; }
    .stButton>button[kind="primary"] { background: #4F46E5 !important; color: #FFFFFF !important; border: none !important; }
    .stButton>button[kind="primary"]:hover { background: #4338CA !important; }

    div[data-testid="stDataFrame"] > div { border-radius: 10px !important; border: 1px solid #E2E8F0 !important; }
    div[data-testid="stToast"] { font-size: 0.92rem !important; font-weight: 600 !important; border-radius: 8px !important; padding: 14px !important; }
</style>
""", unsafe_allow_html=True)

# ==============================================================================
# 2. CORE SYSTEM FUNCTIONS & DATABASE MANAGEMENT
# ==============================================================================
def show_success_toast(msg: str): st.toast(f"✅ {msg}", icon="✅")
def show_error_toast(msg: str): st.toast(f"❌ {msg}", icon="❌")

if "pending_toast" in st.session_state and st.session_state.pending_toast:
    t_type, t_msg = st.session_state.pending_toast
    show_success_toast(t_msg) if t_type == "SUCCESS" else show_error_toast(t_msg)
    st.session_state.pending_toast = None

def trigger_toast_and_rerun(toast_type: str, message: str, delay_sec: float = 0.5):
    st.session_state.pending_toast = (toast_type, message)
    time.sleep(delay_sec)
    st.rerun()

@st.dialog("⚠️ Action Confirmation")
def confirm_action_dialog(message: str, action_callback):
    st.markdown(f"You are about to **{message}**.")
    c1, c2 = st.columns(2)
    if c1.button("✅ Confirm", use_container_width=True, type="primary"):
        action_callback()
        if "pending_toast" not in st.session_state or not st.session_state.pending_toast: st.rerun()
    if c2.button("❌ Cancel", use_container_width=True): st.rerun()

@st.cache_resource
def init_connection_pool():
    creds = {"host": "aws-0-ap-south-1.pooler.supabase.com", "port": 6543, "dbname": "postgres", "user": "postgres.eobweyciqwoojwnsonor", "password": "Poovin@2809"}
    try:
        if len(st.secrets) > 0 and "postgres" in st.secrets: creds = dict(st.secrets["postgres"])
    except Exception: pass
    return psycopg2.pool.ThreadedConnectionPool(minconn=1, maxconn=10, **creds, sslmode="require")

db_pool = init_connection_pool()

def run_query(query, params=None, fetch=True):
    conn = db_pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params or ())
            result = cur.fetchall() if fetch else None
            conn.commit()
        return result
    except Exception as e: conn.rollback(); raise e
    finally: db_pool.putconn(conn)

def ensure_schema_updates():
    try:
        run_query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS odometer_working BOOLEAN DEFAULT TRUE;", fetch=False)
        run_query("ALTER TABLE diesel_fuel_logs ADD COLUMN IF NOT EXISTS is_tank_full BOOLEAN DEFAULT FALSE;", fetch=False)
        run_query("ALTER TABLE trips ADD COLUMN IF NOT EXISTS is_tank_full BOOLEAN DEFAULT FALSE;", fetch=False)
        run_query("ALTER TABLE driver_bata_master ADD COLUMN IF NOT EXISTS origin VARCHAR(100) DEFAULT 'ALL';", fetch=False)
    except Exception: pass
ensure_schema_updates()

def generate_settlement_pdf(driver_name, start_d, end_d, trips_df, adv_df, totals):
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.add_page()
    pdf.set_font("Arial", 'B', 18); pdf.cell(0, 10, "KSS Roadways - Settlement Statement", ln=True, align='C')
    pdf.set_font("Arial", '', 12); pdf.cell(0, 6, f"Driver Name: {driver_name}", ln=True, align='C')
    pdf.cell(0, 6, f"Period: {start_d} to {end_d}", ln=True, align='C'); pdf.ln(5)
    
    pdf.set_font("Arial", 'B', 12); pdf.set_fill_color(240, 245, 255); pdf.cell(0, 10, " Overall Cycle Position", ln=True, fill=True)
    pdf.set_font("Arial", '', 11)
    pdf.cell(95, 8, f" Total Diesel Issued: {totals['diesel']:.1f} L", border=1); pdf.cell(95, 8, f" Total Bata Earned: Rs {totals['bata']:.2f}", border=1, ln=True)
    pdf.cell(95, 8, f" Total Advances Deducted: Rs {totals['adv']:.2f}", border=1)
    pdf.set_font("Arial", 'B', 11); pdf.cell(95, 8, f" Grand Balance Payable: Rs {totals['bal']:.2f}", border=1, ln=True); pdf.ln(10)
    
    pdf.set_font("Arial", 'B', 12); pdf.cell(0, 10, " Trip Details", ln=True)
    if not trips_df.empty:
        pdf.set_font("Arial", 'B', 9)
        cols = ["Date", "LR No", "Truck", "Source", "Dest", "Diesel", "Bata", "Adv", "Bal"]
        col_widths = [20, 18, 22, 22, 25, 15, 18, 20, 30]
        for i in range(len(cols)): pdf.cell(col_widths[i], 8, cols[i], border=1, align='C')
        pdf.ln()
        pdf.set_font("Arial", '', 8)
        for idx, row in trips_df.iterrows():
            pdf.cell(col_widths[0], 8, str(row.get('trip_start_date', ''))[:10], border=1)
            pdf.cell(col_widths[1], 8, str(row.get('lr_no', ''))[:8], border=1)
            pdf.cell(col_widths[2], 8, str(row.get('vehicle_number', ''))[:10], border=1)
            pdf.cell(col_widths[3], 8, str(row.get('source', ''))[:10], border=1)
            pdf.cell(col_widths[4], 8, str(row.get('destination', ''))[:10], border=1)
            pdf.cell(col_widths[5], 8, f"{row.get('diesel_litres', 0):.1f}", border=1, align='R')
            pdf.cell(col_widths[6], 8, f"{row.get('total_bata', 0):.0f}", border=1, align='R')
            pdf.cell(col_widths[7], 8, f"{row.get('advance_issued', 0):.0f}", border=1, align='R')
            pdf.cell(col_widths[8], 8, f"{row.get('balance_amount', 0):.0f}", border=1, align='R'); pdf.ln()
    else: pdf.set_font("Arial", '', 10); pdf.cell(0, 8, "No trips logged in this period.", ln=True)
    pdf.ln(5)
    
    pdf.set_font("Arial", 'B', 12); pdf.cell(0, 10, " Direct Cash & Salary Advances", ln=True)
    if not adv_df.empty:
        pdf.set_font("Arial", 'B', 9)
        pdf.cell(30, 8, "Date", border=1, align='C'); pdf.cell(40, 8, "Amount (Rs)", border=1, align='C')
        pdf.cell(50, 8, "Category", border=1, align='C'); pdf.cell(70, 8, "Remarks", border=1, align='C'); pdf.ln()
        pdf.set_font("Arial", '', 9)
        for idx, row in adv_df.iterrows():
            pdf.cell(30, 8, str(row.get('advance_date', ''))[:10], border=1); pdf.cell(40, 8, f"{row.get('amount_inr', 0):.2f}", border=1, align='R')
            pdf.cell(50, 8, str(row.get('advance_type', ''))[:20], border=1); pdf.cell(70, 8, str(row.get('reference_remarks', ''))[:35], border=1); pdf.ln()
    else: pdf.set_font("Arial", '', 10); pdf.cell(0, 8, "No direct advances in this period.", ln=True)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        pdf.output(tmp.name); tmp.seek(0); data = tmp.read()
    os.remove(tmp.name)
    return data

# ==============================================================================
# 3. BUSINESS LOGIC & CACHING
# ==============================================================================
STATUS_OPTIONS = {"AVAILABLE_FOR_LOAD": "Available", "WAITING_FOR_LOAD": "Plant Loading", "IN_TRANSIT": "In Transit", "WAITING_FOR_UNLOAD": "Site Unloading", "WORKSHOP_MAINTENANCE": "Workshop", "DRIVER_UNAVAILABLE": "Driver Leave"}
STANDARD_SOURCES = ["COCHIN", "POTTANERI", "METTUR", "UDUPPI", "COCHIN-ACC", "TUTICORIN"]
BATA_SLAB_DEFINITIONS = {
    "25MT Body (Bag)": {"cargo_type": "BAG", "capacity_tons": 25.0}, "30MT Body (Bag)": {"cargo_type": "BAG", "capacity_tons": 30.0},
    "25MT Bulk (Bulker)": {"cargo_type": "BULK", "capacity_tons": 25.0}, "30MT Bulk (Bulker)": {"cargo_type": "BULK", "capacity_tons": 30.0},
    "35MT Bulk (Bulker)": {"cargo_type": "BULK", "capacity_tons": 35.0}
}

@st.cache_data(ttl=60)
def get_cached_vehicles(): return run_query("SELECT vehicle_id, vehicle_number, truck_type, carrying_capacity_tons, current_status, status_remarks, odometer_working FROM vehicles WHERE is_active = TRUE ORDER BY vehicle_number")

@st.cache_data(ttl=60)
def get_cached_drivers(include_inactive=False):
    cond = "" if include_inactive else "WHERE is_active = TRUE"
    return run_query(f"SELECT driver_id, driver_code, full_name, phone_number, license_number, license_expiry_date, is_active FROM drivers {cond} ORDER BY full_name ASC")

@st.cache_data(ttl=60)
def get_cached_routes(cargo_type=None, capacity=None, origin=None):
    query, params = "SELECT * FROM destinations_freight_master WHERE is_active = TRUE", []
    if cargo_type: query += " AND cargo_type = %s"; params.append(cargo_type)
    if origin: query += " AND UPPER(origin) = UPPER(%s)"; params.append(origin.strip())
    if cargo_type == "BAG" and capacity in [25.0, 30.0]: query += " AND capacity_tons IN (25.0, 30.0)"
    elif capacity: query += " AND capacity_tons = %s"; params.append(capacity)
    query += " ORDER BY destination_name ASC, capacity_tons ASC"
    routes = run_query(query, tuple(params))
    if cargo_type == "BAG" and routes:
        seen, deduped = set(), []
        for r in routes:
            key = (r['origin'].upper(), r['destination_name'].upper())
            if key not in seen: seen.add(key); deduped.append(r)
        return deduped
    return routes

@st.cache_data(ttl=60)
def get_cached_bata_rules():
    try: return run_query("SELECT bata_rule_id, origin, destination_name, cargo_type, capacity_tons, standard_bata_inr FROM driver_bata_master ORDER BY origin ASC, destination_name ASC, cargo_type ASC, capacity_tons ASC;")
    except Exception: return run_query("SELECT bata_rule_id, destination_name, cargo_type, capacity_tons, standard_bata_inr FROM driver_bata_master ORDER BY destination_name ASC, cargo_type ASC, capacity_tons ASC;")

@st.cache_data(ttl=300)
def get_cached_diesel_rate():
    res = run_query("SELECT setting_value FROM system_settings WHERE setting_key = 'diesel_rate_per_litre'")
    return float(res[0]['setting_value']) if res else 95.00

def set_saved_diesel_rate(new_rate):
    run_query("INSERT INTO system_settings (setting_key, setting_value, updated_at) VALUES ('diesel_rate_per_litre', %s, CURRENT_TIMESTAMP) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP;", (str(new_rate),), fetch=False)
    get_cached_diesel_rate.clear()

def get_last_driver_and_weight_for_vehicle(vehicle_id):
    res = run_query("SELECT t.primary_driver_id, t.loaded_weight_mt, d.full_name FROM trips t JOIN drivers d ON t.primary_driver_id = d.driver_id WHERE t.vehicle_id = %s AND t.primary_driver_id IS NOT NULL ORDER BY t.trip_id DESC LIMIT 1;", (vehicle_id,))
    return (res[0]['primary_driver_id'], float(res[0]['loaded_weight_mt'] or 0.0), res[0]['full_name']) if res else (None, 0.0, None)

def get_latest_odometer_for_truck(vehicle_id):
    res1 = run_query("SELECT start_km FROM trips WHERE vehicle_id = %s AND trip_status != 'COMPLETED' ORDER BY trip_id DESC LIMIT 1", (vehicle_id,))
    if res1 and res1[0].get('start_km'): return float(res1[0]['start_km'])
    res2 = run_query("SELECT filling_odometer_km FROM diesel_fuel_logs WHERE vehicle_id = %s ORDER BY fuel_date DESC, fuel_log_id DESC LIMIT 1", (vehicle_id,))
    if res2 and res2[0].get('filling_odometer_km'): return float(res2[0]['filling_odometer_km'])
    res3 = run_query("SELECT end_km FROM trips WHERE vehicle_id = %s AND trip_status = 'COMPLETED' ORDER BY trip_id DESC LIMIT 1", (vehicle_id,))
    return float(res3[0]['end_km']) if res3 and res3[0].get('end_km') else 0.0

def check_lr_exists(trip_no):
    if not trip_no or not trip_no.strip(): return None
    res = run_query("SELECT t.trip_id, t.trip_number, t.trip_status, t.trip_start_date, t.start_km, v.vehicle_number, d.full_name AS driver_name FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id WHERE LOWER(t.trip_number) = LOWER(%s) LIMIT 1;", (trip_no.strip(),))
    return res[0] if res else None

def check_vehicle_has_open_trip(vehicle_id):
    res = run_query("SELECT trip_id, trip_number FROM trips WHERE vehicle_id = %s AND trip_status != 'COMPLETED' LIMIT 1;", (vehicle_id,))
    return res[0] if res else None

def check_duplicate_diesel_entry(vehicle_id, fuel_date, litres, filling_km=None, lr_number=None, exclude_fuel_log_id=None):
    query, params = "SELECT fuel_log_id FROM diesel_fuel_logs WHERE vehicle_id = %s AND fuel_date::date = %s AND ABS(litres_filled - %s) < 0.01", [vehicle_id, fuel_date, litres]
    if exclude_fuel_log_id: query += " AND fuel_log_id != %s"; params.append(exclude_fuel_log_id)
    if filling_km and filling_km > 0: query += " AND ABS(COALESCE(filling_odometer_km, 0) - %s) < 0.1"; params.append(filling_km)
    elif lr_number and lr_number.strip() and lr_number.strip().upper() != "SUNDRY": query += " AND UPPER(COALESCE(lr_number, '')) = UPPER(%s)"; params.append(lr_number.strip())
    return len(run_query(query, tuple(params))) > 0

def lookup_driver_bata_slab(origin, dest_name, cargo_type, capacity_tons):
    if not origin or not dest_name: return 0.00
    try:
        res = run_query("SELECT standard_bata_inr FROM driver_bata_master WHERE UPPER(origin) = UPPER(%s) AND UPPER(destination_name) = UPPER(%s) AND cargo_type = %s AND capacity_tons = %s LIMIT 1;", (origin.strip(), dest_name.strip(), cargo_type, capacity_tons))
        if res: return float(res[0]['standard_bata_inr'])
    except Exception: pass
    return 0.00

# ==============================================================================
# 4. AUTHENTICATION & TOP-BAR NAVIGATION
# ==============================================================================
USER_CREDENTIALS = {"admin": {"password": "admin123", "role": "MASTER"}, "user": {"password": "user123", "role": "VIEWER"}}

if "authenticated" not in st.session_state:
    st.session_state.authenticated, st.session_state.username, st.session_state.user_role = False, None, None

if not st.session_state.authenticated:
    st.markdown("<br><br><br>", unsafe_allow_html=True)
    _, col, _ = st.columns([3, 4, 3])
    with col:
        st.markdown("<h1 style='text-align: center; color: #0F172A; font-weight: 800;'>KSS Roadways ERP</h1>", unsafe_allow_html=True)
        with st.form("login_form"):
            in_user = st.text_input("Username").strip().lower()
            in_pass = st.text_input("Password", type="password").strip()
            if st.form_submit_button("Sign In", type="primary", use_container_width=True):
                if in_user in USER_CREDENTIALS and USER_CREDENTIALS[in_user]["password"] == in_pass:
                    st.session_state.update({"authenticated": True, "username": in_user, "user_role": USER_CREDENTIALS[in_user]["role"]})
                    st.rerun()
                else: show_error_toast("Invalid Credentials.")
    st.stop()

# --- Responsive Top-Bar Navigation ---
nav1, nav2, nav3 = st.columns([3.0, 6.0, 1.0])
with nav1:
    role_badge = "👑 MASTER" if st.session_state.user_role == "MASTER" else "👁️ REPORTS ONLY"
    st.markdown(f"<h3 style='margin:0; padding:0; font-size:1.45rem; color:#0F172A; font-weight:800;'>KSS Roadways <span style='font-size:0.75rem; background:#DBEAFE; color:#1E40AF; padding:4px 10px; border-radius:8px; margin-left:8px; vertical-align: middle;'>{role_badge}</span></h3>", unsafe_allow_html=True)

with nav2:
    MODULE_LIST = ["Trip Dispatch Entry", "POD Receive & Close", "Fleet Status Board", "Diesel Logs", "Driver Advances", "Modify Trips & Claims", "Driver Settlement", "Master Configuration", "Executive Retention Analytics", "Audit Log"] if st.session_state.user_role == "MASTER" else ["Fleet Status Board", "Driver Settlement", "Executive Retention Analytics"]
    menu = st.selectbox("Module Navigation", MODULE_LIST, index=0, label_visibility="collapsed")

with nav3:
    if st.button("Logout", use_container_width=True):
        st.session_state.update({"authenticated": False, "username": None, "user_role": None})
        st.rerun()

st.markdown("<hr style='margin: 10px 0 20px 0; border: none; border-top: 2px solid #E2E8F0;' />", unsafe_allow_html=True)

# ==============================================================================
# MODULE VIEWS
# ==============================================================================

if menu == "Trip Dispatch Entry":
    st.markdown('<div class="section-header">Initiate New Trip Dispatch</div>', unsafe_allow_html=True)
    vehicles, drivers = get_cached_vehicles(), get_cached_drivers()
    if not vehicles or not drivers: st.error("Configure vehicles and drivers in Master Configuration first."); st.stop()
    
    driver_dict = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers}
    
    with st.form("dispatch_form"):
        c1, c2, c3, c4 = st.columns([1.5, 2, 2, 1.5])
        with c1: start_date = st.date_input("Start Date*", date.today())
        with c2: lr_no = st.text_input("LR Number*").strip().upper()
        with c3: cargo_category = st.selectbox("Cargo Type*", ["BULK", "BAG"])
        with c4: d_rate_fast = st.number_input("Diesel Rate (₹/L)*", value=get_cached_diesel_rate(), step=0.1)

        v_map = {f"{v['vehicle_number']} [{v['truck_type']}]": v for v in vehicles if ("BULK" if cargo_category == "BULK" else "BAG") in str(v.get('truck_type', '')).upper() or (cargo_category == "BAG" and "BODY" in str(v.get('truck_type', '')).upper())}
        
        c5, c6, c7 = st.columns([2.5, 2.5, 2.5])
        with c5: 
            sel_veh_label = st.selectbox("Assigned Truck*", ["-- SELECT TRUCK --"] + list(v_map.keys()))
            active_veh = v_map.get(sel_veh_label)
        with c6: chosen_source = st.selectbox("Source Hub*", ["-- SELECT SOURCE --"] + STANDARD_SOURCES + ["CUSTOM"])
        
        origin_terminal = st.text_input("Enter Custom Source") if chosen_source == "CUSTOM" else chosen_source

        dest_options = {}
        if active_veh and origin_terminal != "-- SELECT SOURCE --":
            rts = run_query("SELECT * FROM destinations_freight_master WHERE is_active=TRUE AND cargo_type=%s AND capacity_tons=%s AND UPPER(origin)=UPPER(%s)", (cargo_category, float(active_veh['carrying_capacity_tons']), origin_terminal))
            if rts: dest_options = {f"{r['destination_name']} ➔ [₹{r['freight_rate_per_ton']}/MT]": r for r in rts}
        dest_options["-- MANUAL / SPOT ROUTE --"] = {}
        
        with c7: sel_dest_label = st.selectbox("Destination*", ["-- SELECT DESTINATION --"] + list(dest_options.keys()))

        dest_terminal, rate_mt, std_km = "", 0.0, 0.0
        if sel_dest_label == "-- MANUAL / SPOT ROUTE --":
            sc1, sc2, sc3 = st.columns(3)
            with sc1: dest_terminal = st.text_input("Custom Destination*").strip().upper()
            with sc2: rate_mt = st.number_input("Spot Rate/MT*", min_value=0.0, step=25.0)
            with sc3: std_km = st.number_input("Standard KM", min_value=0.0, step=10.0)
        elif sel_dest_label != "-- SELECT DESTINATION --":
            rt = dest_options[sel_dest_label]
            dest_terminal, rate_mt, std_km = rt['destination_name'], float(rt['freight_rate_per_ton']), float(rt['standard_km'])

        st.markdown("<hr style='margin:10px 0;'>", unsafe_allow_html=True)
        fc1, fc2, fc3, fc4 = st.columns(4)
        with fc1: chosen_drv = st.selectbox("Driver*", ["-- SELECT DRIVER --"] + list(driver_dict.keys()))
        with fc2: wmt = st.number_input("Loaded MT*", value=float(active_veh['carrying_capacity_tons']) if active_veh else 30.0)
        with fc3: 
            bata = st.number_input("Driver Bata (₹)*", value=lookup_driver_bata_slab(origin_terminal, dest_terminal, cargo_category, float(active_veh['carrying_capacity_tons']) if active_veh else 0.0), step=100.0)
        with fc4: adv = st.number_input("Advance (₹)", min_value=0.0, step=500.0)

        oc1, oc2, oc3, oc4 = st.columns(4)
        with oc1: start_km = st.number_input("Start KM*", value=get_latest_odometer_for_truck(active_veh['vehicle_id']) if active_veh else 0.0)
        with oc2: end_km = st.number_input("Expected End KM", min_value=0.0, step=10.0)
        with oc3: fuel_l = st.number_input("Diesel (L)", min_value=0.0, step=10.0)
        with oc4: is_tank_full = st.checkbox("⛽ Mark Tank Full", value=False)

        st.write("")
        if st.form_submit_button("🚀 Dispatch Trip", type="primary"):
            if not all([active_veh, lr_no, dest_terminal, origin_terminal != "-- SELECT SOURCE --", chosen_drv != "-- SELECT DRIVER --"]): show_error_toast("Fill all mandatory fields.")
            elif check_vehicle_has_open_trip(active_veh['vehicle_id']): show_error_toast(f"Truck has an active trip already.")
            elif check_lr_exists(lr_no): show_error_toast(f"LR '{lr_no}' already exists.")
            else:
                def run_dispatch():
                    calc_km = (end_km - start_km) if end_km > start_km else std_km
                    gross = round(wmt * rate_mt, 2)
                    f_cost = round(fuel_l * d_rate_fast, 2)
                    new_t = run_query("INSERT INTO trips (trip_number, branch_id, vehicle_id, primary_driver_id, trip_start_date, trip_end_date, origin, destination, start_km, end_km, total_km_run, tonnage_loaded, loaded_weight_mt, unloaded_weight_mt, freight_revenue, fuel_litres, fuel_expense, driver_bata, cash_advance_issued, trip_status, is_tank_full) VALUES (%s, 1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'IN_TRANSIT', %s) RETURNING trip_id;", (lr_no, active_veh['vehicle_id'], driver_dict[chosen_drv]['driver_id'], start_date, start_date, origin_terminal, dest_terminal, start_km, end_km, calc_km, wmt, wmt, wmt, gross, fuel_l, f_cost, bata, adv, is_tank_full))
                    if fuel_l > 0 and new_t: run_query("INSERT INTO diesel_fuel_logs (fuel_date, vehicle_id, trip_id, lr_number, diesel_category, litres_filled, diesel_rate_per_litre, total_fuel_cost, filling_odometer_km, is_tank_full) VALUES (%s, %s, %s, %s, 'TRIP_DIESEL', %s, %s, %s, %s, %s);", (start_date, active_veh['vehicle_id'], new_t[0]['trip_id'], lr_no, fuel_l, d_rate_fast, f_cost, start_km, is_tank_full), fetch=False)
                    run_query("UPDATE vehicles SET current_status = 'IN_TRANSIT', status_remarks = %s WHERE vehicle_id = %s", (f"Trip {lr_no}: {origin_terminal} ➔ {dest_terminal}", active_veh['vehicle_id']), fetch=False)
                    get_cached_vehicles.clear(); trigger_toast_and_rerun("SUCCESS", "Trip dispatched.")
                confirm_action_dialog("Dispatch this trip", run_dispatch)

elif menu == "POD Receive & Close":
    col_main, col_side = st.columns([6, 4])
    
    with col_side:
        st.markdown('<div class="section-header">📞 Pending POD List</div>', unsafe_allow_html=True)
        pending = run_query("SELECT t.trip_number AS lr_no, v.vehicle_number, d.phone_number, t.destination, CURRENT_DATE - t.trip_start_date::date AS days FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id WHERE t.trip_status != 'COMPLETED' ORDER BY t.trip_start_date ASC;")
        if pending: st.dataframe(pd.DataFrame(pending), hide_index=True, use_container_width=True, height=500)
        else: st.success("All PODs settled.")

    with col_main:
        st.markdown('<div class="section-header">Record POD & Settle Trip</div>', unsafe_allow_html=True)
        active_trips = run_query("SELECT * FROM trips WHERE trip_status != 'COMPLETED' ORDER BY trip_id DESC;")
        if not active_trips: st.info("No trips pending closure.")
        else:
            t_opts = {f"LR: {t['trip_number']}": t for t in active_trips}
            sel_lr = st.selectbox("Search & Select Active LR*", ["-- SELECT LR --"] + list(t_opts.keys()), index=0)
            
            if sel_lr != "-- SELECT LR --":
                t_cur = t_opts[sel_lr]
                with st.form("pod_form"):
                    p1, p2, p3 = st.columns(3)
                    with p1: pod_no = st.text_input("POD No*").strip().upper()
                    with p2: close_d = st.date_input("Closing Date*", date.today())
                    with p3: unloaded_wt = st.number_input("Unloaded MT", value=float(t_cur['loaded_weight_mt'] or 0.0), step=0.01)
                    
                    p4, p5, p6 = st.columns(3)
                    with p4: final_km = st.number_input("Closing KM*", value=float(t_cur['start_km'] or 0.0), step=10.0)
                    with p5: halt_bata = st.number_input("Halt Bata (₹)", min_value=0.0, step=100.0)
                    with p6: claims = st.number_input("Claims (₹)", min_value=0.0, step=50.0)

                    has_fuel = float(t_cur['fuel_litres'] or 0.0) > 0
                    pod_fuel = st.number_input("Closing Top-up (L)" if has_fuel else "Trip Diesel (L)*", min_value=0.0, step=5.0)
                    pod_tf = st.checkbox("⛽ Mark Tank Full")

                    st.write("")
                    if st.form_submit_button("✅ Settle POD", type="primary"):
                        if not pod_no: show_error_toast("POD No required.")
                        else:
                            def execute_pod():
                                f_cost = round(pod_fuel * get_cached_diesel_rate(), 2)
                                tot_km = max(0.0, final_km - float(t_cur['start_km'] or 0.0))
                                short = max(0.0, float(t_cur['loaded_weight_mt']) - unloaded_wt)
                                run_query("UPDATE trips SET pod_number=%s, trip_end_date=%s, end_km=%s, total_km_run=%s, unloaded_weight_mt=%s, shortage_mt=%s, halt_bata=%s, enroute_repairs_maintenance=%s, fuel_litres=fuel_litres+%s, fuel_expense=fuel_expense+%s, trip_status='COMPLETED', trip_closed_at=CURRENT_TIMESTAMP WHERE trip_id=%s;", (pod_no, close_d, final_km, tot_km, unloaded_wt, short, halt_bata, claims, pod_fuel, f_cost, t_cur['trip_id']), fetch=False)
                                if pod_fuel > 0: run_query("INSERT INTO diesel_fuel_logs (fuel_date, vehicle_id, trip_id, lr_number, diesel_category, litres_filled, total_fuel_cost, filling_odometer_km, is_tank_full) VALUES (%s, %s, %s, %s, 'TRIP_DIESEL', %s, %s, %s, %s);", (close_d, t_cur['vehicle_id'], t_cur['trip_id'], t_cur['trip_number'], pod_fuel, f_cost, final_km, pod_tf), fetch=False)
                                run_query("UPDATE vehicles SET current_status = 'AVAILABLE_FOR_LOAD' WHERE vehicle_id = %s", (t_cur['vehicle_id'],), fetch=False)
                                get_cached_vehicles.clear(); trigger_toast_and_rerun("SUCCESS", "POD Closed.")
                            confirm_action_dialog(f"Close POD for {t_cur['trip_number']}", execute_pod)

elif menu == "Fleet Status Board":
    vehicles = get_cached_vehicles()
    if vehicles:
        df_v = pd.DataFrame(vehicles)
        df_v['status_lbl'] = df_v['current_status'].map(lambda x: STATUS_OPTIONS.get(x, x))
        c1, c2, c3, c4, c5, c6 = st.columns(6)
        c1.metric("🟢 Ready", len(df_v[df_v['current_status'] == 'AVAILABLE_FOR_LOAD']))
        c2.metric("🟡 Plant Loading", len(df_v[df_v['current_status'] == 'WAITING_FOR_LOAD']))
        c3.metric("🚚 In Transit", len(df_v[df_v['current_status'] == 'IN_TRANSIT']))
        c4.metric("⏳ Site Unloading", len(df_v[df_v['current_status'] == 'WAITING_FOR_UNLOAD']))
        c5.metric("🛠️ Workshop", len(df_v[df_v['current_status'] == 'WORKSHOP_MAINTENANCE']))
        c6.metric("🚫 Leave", len(df_v[df_v['current_status'] == 'DRIVER_UNAVAILABLE']))

        st.markdown('<div class="section-header">Active Fleet Overview & Quick Status Update</div>', unsafe_allow_html=True)
        v_col1, v_col2 = st.columns([3.2, 1.8])
        with v_col1: st.dataframe(df_v[['vehicle_number', 'truck_type', 'carrying_capacity_tons', 'status_lbl', 'status_remarks']], hide_index=True, use_container_width=True, height=450)
        with v_col2:
            if st.session_state.user_role == "MASTER":
                with st.form("quick_stat_form"):
                    v_map = {f"{v['vehicle_number']} ({v['truck_type']})": v for v in vehicles}
                    target_v = v_map[st.selectbox("Select Truck to Update", list(v_map.keys()))]
                    new_st = st.selectbox("New Operational Status", list(STATUS_OPTIONS.keys()), format_func=lambda x: STATUS_OPTIONS[x])
                    new_rem = st.text_input("Location / Breakdown Details", value=target_v['status_remarks'] or "")
                    st.write("")
                    if st.form_submit_button("Update Status", type="primary"):
                        confirm_action_dialog(f"update status of {target_v['vehicle_number']}", lambda: (run_query("UPDATE vehicles SET current_status = %s, status_remarks = %s, status_updated_at = CURRENT_TIMESTAMP WHERE vehicle_id = %s", (new_st, new_rem, target_v['vehicle_id']), fetch=False), get_cached_vehicles.clear(), trigger_toast_and_rerun("SUCCESS", "Status updated.")))
            else: st.info("ℹ️ Status modifications restricted to Master accounts.")

elif menu == "Diesel Logs":
    hd1, hd2 = st.columns([7.5, 2.5])
    with hd1: st.markdown('<div class="section-header">Diesel Fuel Management & Audit Logs</div>', unsafe_allow_html=True)
    with hd2:
        current_d_rate = get_cached_diesel_rate()
        d_rate_fast = st.number_input("⛽ Active Diesel Rate (₹/L)*", value=current_d_rate, step=0.1)
        if d_rate_fast != current_d_rate: set_saved_diesel_rate(d_rate_fast)

    tab_issue, tab_edit_fuel, tab_audit_fuel = st.tabs(["⛽ Issue Diesel", "✏️ Edit Log", "📊 Audit Registry"])
    vehicles = get_cached_vehicles()
    v_dict = {f"{v['vehicle_number']} ({v['truck_type']})": v for v in vehicles}
    
    with tab_issue:
        col_d1, col_d2 = st.columns([1.5, 3.5])
        with col_d1:
            with st.form("d_entry_form", clear_on_submit=True):
                f_date = st.date_input("Fuel Date*", date.today())
                f_veh = st.selectbox("Select Truck*", list(v_dict.keys()))
                target_veh_id = v_dict[f_veh]['vehicle_id']
                f_cat = st.selectbox("Category*", ["TRIP_DIESEL", "SUNDRY_DIESEL"])
                f_lr = st.text_input("Trip LR No (Optional)").strip().upper()
                
                auto_km = get_latest_odometer_for_truck(target_veh_id)
                if f_lr:
                    lr_check = check_lr_exists(f_lr)
                    if lr_check and lr_check.get('start_km'): auto_km = float(lr_check['start_km'])
                
                filling_km = st.number_input("Filling KM*", min_value=0.0, step=10.0, value=auto_km)
                f_l = st.number_input("Litres Filled*", min_value=0.0, step=10.0)
                is_tank_full = st.checkbox("⛽ Mark as Tank Full", value=False)
                f_cost = round(f_l * d_rate_fast, 2)
                st.metric("Total Fuel Cost", f"₹{f_cost:,.2f}")
                
                st.write("")
                if st.form_submit_button("Record Diesel Entry", type="primary"):
                    if f_l <= 0: show_error_toast("Fuel > 0 required.")
                    elif check_duplicate_diesel_entry(target_veh_id, f_date, f_l, filling_km, f_lr): show_error_toast("Duplicate fuel log exists.")
                    else:
                        confirm_action_dialog(f"record {f_l}L to {v_dict[f_veh]['vehicle_number']}", lambda: (run_query("INSERT INTO diesel_fuel_logs (fuel_date, vehicle_id, lr_number, diesel_category, litres_filled, diesel_rate_per_litre, total_fuel_cost, filling_odometer_km, is_tank_full) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)", (f_date, target_veh_id, f_lr or "SUNDRY", f_cat, f_l, d_rate_fast, f_cost, filling_km, is_tank_full), fetch=False), trigger_toast_and_rerun("SUCCESS", "Recorded.")))
        with col_d2:
            d_recent = run_query("SELECT f.fuel_log_id, f.fuel_date, v.vehicle_number, f.diesel_category, f.lr_number, f.filling_odometer_km, f.litres_filled, f.total_fuel_cost, f.is_tank_full FROM diesel_fuel_logs f JOIN vehicles v ON f.vehicle_id = v.vehicle_id ORDER BY f.fuel_date DESC, f.fuel_log_id DESC LIMIT 50;")
            if d_recent: st.dataframe(pd.DataFrame(d_recent), hide_index=True, use_container_width=True, height=450)

    with tab_edit_fuel:
        try: all_fuel_entries = run_query("SELECT f.fuel_log_id, f.fuel_date, f.vehicle_id, v.vehicle_number, f.diesel_category, f.lr_number, f.filling_odometer_km, f.litres_filled, f.diesel_rate_per_litre, f.total_fuel_cost, f.trip_id, f.is_tank_full FROM diesel_fuel_logs f JOIN vehicles v ON f.vehicle_id = v.vehicle_id ORDER BY f.fuel_date DESC, f.fuel_log_id DESC;")
        except Exception: all_fuel_entries = run_query("SELECT f.fuel_log_id, f.fuel_date, f.vehicle_id, v.vehicle_number, f.diesel_category, f.lr_number, f.filling_odometer_km, f.litres_filled, f.diesel_rate_per_litre, f.total_fuel_cost, f.trip_id FROM diesel_fuel_logs f JOIN vehicles v ON f.vehicle_id = v.vehicle_id ORDER BY f.fuel_date DESC, f.fuel_log_id DESC;")
        
        if not all_fuel_entries: st.info("No logs found.")
        else:
            fuel_map = {f"Log #{f['fuel_log_id']} | {f['fuel_date']} | {f['vehicle_number']} | {f['litres_filled']} L | LR: {f['lr_number']}": f for f in all_fuel_entries}
            chosen_fuel_label = st.selectbox("Select Record to Edit", ["-- SELECT LOG --"] + list(fuel_map.keys()), index=0)
            if chosen_fuel_label != "-- SELECT LOG --":
                target_fuel = fuel_map[chosen_fuel_label]
                v_keys = list(v_dict.keys())
                def_v_idx = next((i for i, k in enumerate(v_keys) if v_dict[k]['vehicle_id'] == target_fuel['vehicle_id']), 0)

                with st.form("edit_diesel_form"):
                    ed1, ed2, ed3, ed4, ed5 = st.columns(5)
                    with ed1: e_fuel_date = st.date_input("Fuel Date*", target_fuel['fuel_date'] or date.today())
                    with ed2: e_target_veh_id = v_dict[st.selectbox("Vehicle*", v_keys, index=def_v_idx)]['vehicle_id']
                    with ed3: e_cat = st.selectbox("Category*", ["TRIP_DIESEL", "SUNDRY_DIESEL"], index=0 if target_fuel['diesel_category'] == "TRIP_DIESEL" else 1)
                    with ed4: e_lr_val = st.text_input("Trip LR No", value=target_fuel['lr_number'] or "").strip().upper()
                    with ed5: e_filling_km = st.number_input("Filling KM*", min_value=0.0, value=float(target_fuel['filling_odometer_km'] or 0.0), step=10.0)

                    ed6, ed7, ed8 = st.columns(3)
                    with ed6:
                        e_litres = st.number_input("Litres Filled*", min_value=0.0, value=float(target_fuel['litres_filled'] or 0.0), step=5.0)
                        e_tank_full = st.checkbox("⛽ Mark as Tank Full", value=bool(target_fuel.get('is_tank_full', False)))
                    with ed7: e_rate = st.number_input("Rate (₹/L)*", min_value=50.0, value=float(target_fuel['diesel_rate_per_litre'] or d_rate_fast), step=0.05)
                    with ed8: e_cost = round(e_litres * e_rate, 2); st.metric("Recalculated Cost", f"₹{e_cost:,.2f}")

                    st.write("")
                    if st.form_submit_button("💾 Commit Updates", type="primary"):
                        if e_litres <= 0: show_error_toast("Fuel > 0 required.")
                        elif check_duplicate_diesel_entry(e_target_veh_id, e_fuel_date, e_litres, e_filling_km, e_lr_val, target_fuel['fuel_log_id']): show_error_toast("Duplicate exists.")
                        else:
                            def execute_fuel_edit():
                                run_query("UPDATE diesel_fuel_logs SET fuel_date=%s, vehicle_id=%s, diesel_category=%s, lr_number=%s, filling_odometer_km=%s, litres_filled=%s, diesel_rate_per_litre=%s, total_fuel_cost=%s, is_tank_full=%s WHERE fuel_log_id=%s;", (e_fuel_date, e_target_veh_id, e_cat, e_lr_val or "SUNDRY", e_filling_km, e_litres, e_rate, e_cost, e_tank_full, target_fuel['fuel_log_id']), fetch=False)
                                if target_fuel['trip_id']: run_query("UPDATE trips SET fuel_litres=%s, fuel_expense=%s, start_km=CASE WHEN start_km=0 THEN %s ELSE start_km END WHERE trip_id=%s;", (e_litres, e_cost, e_filling_km, target_fuel['trip_id']), fetch=False)
                                trigger_toast_and_rerun("SUCCESS", f"Fuel Log #{target_fuel['fuel_log_id']} updated.")
                            confirm_action_dialog(f"modify Fuel Log #{target_fuel['fuel_log_id']}", execute_fuel_edit)

    with tab_audit_fuel:
        df_col1, df_col2, df_col3, df_col4 = st.columns([2.0, 2.0, 2.0, 2.0])
        with df_col1: fuel_filter_mode = st.selectbox("Date Selection Mode", ["All Time", "Specific Single Date", "Custom Date Range"])
        with df_col2: sel_fl_trk = st.selectbox("Filter Truck No", ["All Trucks"] + sorted([v['vehicle_number'] for v in vehicles]))
        with df_col3: sel_fl_cat = st.selectbox("Filter Category", ["All Categories", "TRIP_DIESEL", "SUNDRY_DIESEL"])
        with df_col4: search_fl_lr = st.text_input("Search LR No").strip().upper()

        date_q_cond, fl_params = "", []
        if fuel_filter_mode == "Specific Single Date":
            c_d1, _ = st.columns([2, 2]); single_fl_d = c_d1.date_input("Select Date", date.today()); date_q_cond = " AND f.fuel_date::date = %s"; fl_params.append(single_fl_d)
        elif fuel_filter_mode == "Custom Date Range":
            c_d1, c_d2 = st.columns(2); from_fl_d = c_d1.date_input("From Date", date.today().replace(day=1)); to_fl_d = c_d2.date_input("To Date", date.today()); date_q_cond = " AND f.fuel_date::date >= %s AND f.fuel_date::date <= %s"; fl_params.extend([from_fl_d, to_fl_d])

        d_filter_sql = f"SELECT f.fuel_log_id, f.fuel_date, v.vehicle_number, f.diesel_category, f.lr_number, f.filling_odometer_km, f.litres_filled, f.diesel_rate_per_litre, f.total_fuel_cost, f.is_tank_full FROM diesel_fuel_logs f JOIN vehicles v ON f.vehicle_id = v.vehicle_id WHERE 1=1 {date_q_cond}"
        if sel_fl_trk != "All Trucks": d_filter_sql += " AND v.vehicle_number = %s"; fl_params.append(sel_fl_trk)
        if sel_fl_cat != "All Categories": d_filter_sql += " AND f.diesel_category = %s"; fl_params.append(sel_fl_cat)
        if search_fl_lr: d_filter_sql += " AND UPPER(f.lr_number) LIKE %s"; fl_params.append(f"%{search_fl_lr}%")
        d_filter_sql += " ORDER BY f.fuel_date DESC, f.fuel_log_id DESC;"

        d_filtered_logs = run_query(d_filter_sql, tuple(fl_params) if fl_params else None)
        if d_filtered_logs:
            df_d_logs = pd.DataFrame(d_filtered_logs)
            kpi_f1, kpi_f2, kpi_f3 = st.columns(3)
            kpi_f1.metric("Matching Entries", len(df_d_logs))
            kpi_f2.metric("Filtered Litres", f"{float(df_d_logs['litres_filled'].sum() or 0.0):,.1f} L")
            kpi_f3.metric("Filtered Cost", f"₹{float(df_d_logs['total_fuel_cost'].sum() or 0.0):,.2f}")
            st.dataframe(df_d_logs, hide_index=True, use_container_width=True, height=300)
            
            del_c1, del_c3 = st.columns([3.0, 1.0])
            with del_c1: del_fuel_id = st.selectbox("Select ID to Remove", df_d_logs['fuel_log_id'].tolist(), format_func=lambda x: f"Fuel Log #{x}")
            with del_c3:
                st.write(""); 
                if st.button("🗑️ Delete Fuel Log", type="secondary", use_container_width=True):
                    confirm_action_dialog(f"delete Fuel Log #{del_fuel_id}", lambda: (run_query("DELETE FROM diesel_fuel_logs WHERE fuel_log_id = %s", (del_fuel_id,), fetch=False), trigger_toast_and_rerun("SUCCESS", f"Deleted.")))
        else: st.info("No diesel logs match the selected parameters.")

elif menu == "Driver Advances":
    drivers = get_cached_drivers()
    d_map = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers}
    
    col_a1, col_a2 = st.columns([1.5, 3.5])
    with col_a1:
        with st.form("adv_form", clear_on_submit=True):
            st.markdown('<div class="section-header">Direct Cash Advance</div>', unsafe_allow_html=True)
            ad_date = st.date_input("Advance Date*", date.today())
            ad_drv = st.selectbox("Driver Account*", list(d_map.keys()))
            ad_amt = st.number_input("Advance Amount (₹)*", min_value=0.0, step=500.0)
            ad_cat = st.selectbox("Category", ["BATA_ADVANCE", "GENERAL_ADVANCE", "EMERGENCY_MEDICAL", "SALARY_ADVANCE"])
            ad_ref = st.text_input("Reference Note")
            st.write("")
            if st.form_submit_button("Issue Advance", type="primary", use_container_width=True):
                if ad_amt <= 0: show_error_toast("Amount must be > 0.")
                else: confirm_action_dialog(f"issue ₹{ad_amt:,.2f} to {d_map[ad_drv]['full_name']}", lambda: (run_query("INSERT INTO driver_direct_advances (advance_date, driver_id, amount_inr, advance_type, reference_remarks) VALUES (%s, %s, %s, %s, %s)", (ad_date, d_map[ad_drv]['driver_id'], ad_amt, ad_cat, ad_ref), fetch=False), trigger_toast_and_rerun("SUCCESS", "Recorded.")))
    with col_a2:
        st.markdown('<div class="section-header">Direct Advance History</div>', unsafe_allow_html=True)
        adv_recs = run_query("SELECT a.advance_id, a.advance_date, d.driver_code, d.full_name, a.amount_inr, a.advance_type, a.reference_remarks FROM driver_direct_advances a JOIN drivers d ON a.driver_id = d.driver_id ORDER BY a.advance_date DESC LIMIT 100")
        if adv_recs:
            df_adv_recs = pd.DataFrame(adv_recs)
            st.dataframe(df_adv_recs, hide_index=True, use_container_width=True, height=450)
            del_a1, del_a3 = st.columns([3.0, 1.0])
            with del_a1: del_adv_id = st.selectbox("Select Entry to Remove", df_adv_recs['advance_id'].tolist(), format_func=lambda x: f"Advance Record #{x}")
            with del_a3:
                st.write(""); 
                if st.button("🗑️ Delete Record", type="secondary", use_container_width=True):
                    confirm_action_dialog(f"permanently delete Advance #{del_adv_id}", lambda: (run_query("DELETE FROM driver_direct_advances WHERE advance_id = %s", (del_adv_id,), fetch=False), trigger_toast_and_rerun("SUCCESS", "Deleted.")))

elif menu == "Modify Trips & Claims":
    drivers = get_cached_drivers()
    driver_dict = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers}
    
    hm1, hm2 = st.columns([7.5, 2.5])
    with hm1: st.markdown('<div class="section-header">Search, Edit Odometer KM, Route Slabs & POD Details</div>', unsafe_allow_html=True)
    with hm2:
        current_d_rate = get_cached_diesel_rate()
        d_rate_fast = st.number_input("⛽ Active Diesel Rate (₹/L)*", value=current_d_rate, step=0.1)
        if d_rate_fast != current_d_rate: set_saved_diesel_rate(d_rate_fast)
    
    f_c1, f_c2 = st.columns([2, 2])
    with f_c1: search_query = st.text_input("🔍 Quick Search by LR Number or Truck").strip().upper()
    with f_c2: status_filter = st.selectbox("Filter by Trip Status", ["All Statuses", "IN_TRANSIT", "COMPLETED"])

    try: trip_sql = "SELECT t.*, v.vehicle_number, v.carrying_capacity_tons, d.full_name FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id WHERE 1=1"
    except Exception: trip_sql = "SELECT t.*, v.vehicle_number, v.carrying_capacity_tons, d.full_name FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id WHERE 1=1"
    
    params = []
    if search_query: trip_sql += " AND (UPPER(t.trip_number) LIKE %s OR UPPER(v.vehicle_number) LIKE %s)"; params.extend([f"%{search_query}%", f"%{search_query}%"])
    if status_filter != "All Statuses": trip_sql += " AND t.trip_status = %s"; params.append(status_filter)
    trip_sql += " ORDER BY t.trip_id DESC"
    all_matched_trips = run_query(trip_sql, tuple(params) if params else None)

    if not all_matched_trips: st.info("No trips found.")
    else:
        trip_map = {f"LR: {t['trip_number']} | Truck: {t['vehicle_number']} | {t['origin']} ➔ {t['destination']} | Status: {t['trip_status']}": t for t in all_matched_trips}
        sel_t_key_label = st.selectbox("Select Target Trip Record to Edit", ["-- SELECT TRIP --"] + list(trip_map.keys()), index=0)

        if sel_t_key_label != "-- SELECT TRIP --":
            t_data = trip_map[sel_t_key_label]
            with st.form("mod_full_form"):
                st.markdown('<div class="section-header">1. Route Hubs & Master Slab Selection</div>', unsafe_allow_html=True)
                v_class_mt = float(t_data['carrying_capacity_tons'] or 30.0)
                all_routes = run_query("SELECT * FROM destinations_freight_master WHERE is_active = TRUE ORDER BY destination_name ASC")
                route_labels, route_map_dict, active_lbl = [], {}, "-- MANUAL / SPOT ROUTE --"
                
                if all_routes:
                    for r in all_routes:
                        lbl = f"{r['origin']} ➔ {r['destination_name']} [{r['capacity_tons']} MT | ₹{r['freight_rate_per_ton']}/MT]"
                        route_labels.append(lbl); route_map_dict[lbl] = r
                        if r['origin'].upper() == (t_data['origin'] or "").upper() and r['destination_name'].upper() == (t_data['destination'] or "").upper(): active_lbl = lbl
                
                route_labels.append("-- MANUAL / SPOT ROUTE --")
                def_route_idx = route_labels.index(active_lbl) if active_lbl in route_labels else len(route_labels) - 1

                m1, m2 = st.columns([2.5, 2.5])
                with m1:
                    e_sdate = st.date_input("Trip Start Date", t_data['trip_start_date'] or date.today())
                    e_lr = st.text_input("Trip LR No", value=t_data['trip_number']).strip().upper()
                with m2:
                    e_edate = st.date_input("Trip Closing Date", t_data['trip_end_date'] or date.today())
                    sel_route_choice = st.selectbox("Select Route from Master Slabs", route_labels, index=def_route_idx)
                
                if sel_route_choice != "-- MANUAL / SPOT ROUTE --":
                    active_slab = route_map_dict[sel_route_choice]
                    e_orig, e_dest, auto_rate_mt, auto_km = active_slab['origin'], active_slab['destination_name'], float(active_slab['freight_rate_per_ton']), float(active_slab['standard_km'])
                else:
                    c_spot1, c_spot2 = st.columns(2)
                    with c_spot1:
                        e_orig = st.text_input("Origin Hub", value=t_data['origin']).strip().upper()
                        e_dest = st.text_input("Destination Terminal", value=t_data['destination']).strip().upper()
                    with c_spot2:
                        auto_rate_mt = st.number_input("Spot Rate/MT*", min_value=0.0, step=25.0, value=0.0)
                        auto_km = st.number_input("Standard KM", min_value=0.0, step=10.0, value=float(t_data['total_km_run'] or 0.0))

                st.markdown('<div class="section-header">2. Odometer Readings & Distance Tracking</div>', unsafe_allow_html=True)
                ok1, ok2, ok3 = st.columns(3)
                with ok1: e_start_km = st.number_input("Start Odometer KM*", min_value=0.0, value=float(t_data['start_km'] or 0.0), step=10.0)
                with ok2: e_end_km = st.number_input("End Odometer KM", min_value=0.0, value=float(t_data['end_km'] or 0.0), step=10.0)
                with ok3:
                    calc_km = (e_end_km - e_start_km) if e_end_km > e_start_km else (float(t_data['total_km_run']) if float(t_data['total_km_run'] or 0) > 0 else auto_km)
                    st.text_input("Total Distance (KM) [Auto]", value=f"{calc_km:.2f}", disabled=True)
                    e_total_km = calc_km

                st.markdown('<div class="section-header">3. Tonnage, Auto-Calculated Freight & Fuel</div>', unsafe_allow_html=True)
                f1, f2, f3, f4, f5 = st.columns(5)
                with f1: e_ton = st.number_input("Loaded MT*", value=float(t_data['loaded_weight_mt'] or v_class_mt), step=0.05)
                with f2: e_freight = st.number_input("Freight Revenue (₹) [Auto]", value=round(e_ton * auto_rate_mt, 2), step=100.0)
                with f3: e_bata = st.number_input("Driver Bata (₹)", value=float(t_data['driver_bata'] or 0.0), step=100.0)
                with f4: e_adv = st.number_input("Advance (₹)", value=float(t_data['cash_advance_issued'] or 0.0), step=500.0)
                with f5:
                    e_fuel_l = st.number_input("Fuel Litres", value=float(t_data['fuel_litres'] or 0.0), step=5.0)
                    e_is_tank_full = st.checkbox("⛽ Mark as Tank Full", value=bool(t_data.get('is_tank_full', False)))

                st.markdown('<div class="section-header">4. POD Reference & Closing Parameters</div>', unsafe_allow_html=True)
                p1, p2, p3, p4, p5 = st.columns(5)
                with p1: e_pod_no = st.text_input("POD / Challan No", value=t_data['pod_number'] or "")
                with p2: e_unloaded_mt = st.number_input("Unloaded MT", value=float(t_data['unloaded_weight_mt'] or e_ton), step=0.01)
                with p3: e_halt_bata = st.number_input("Halt Bata (₹)", value=float(t_data['halt_bata'] or 0.0), step=100.0)
                with p4: e_claims = st.number_input("Claims (₹)", value=float(t_data['enroute_repairs_maintenance'] or 0.0), step=50.0)
                with p5:
                    e_trip_status = st.selectbox("Trip Status", ["IN_TRANSIT", "COMPLETED"], index=0 if t_data['trip_status'] == "IN_TRANSIT" else 1)
                    st.metric("Est. KMPL", f"{(e_total_km / e_fuel_l) if e_fuel_l > 0 else 0.0:.2f} km/l")

                st.write("")
                if st.form_submit_button("💾 Commit Updates to Trip & POD Record", type="primary"):
                    def execute_mod_trip():
                        try:
                            recalculated_fuel_cost = round(e_fuel_l * d_rate_fast, 2)
                            shortage_val = max(0.0, e_ton - e_unloaded_mt)
                            run_query("""
                                UPDATE trips SET trip_start_date=%s, trip_end_date=%s, trip_number=%s, origin=%s, destination=%s, start_km=%s, end_km=%s, total_km_run=%s, loaded_weight_mt=%s, unloaded_weight_mt=%s, tonnage_loaded=%s, shortage_mt=%s, freight_revenue=%s, fuel_litres=%s, fuel_expense=%s, driver_bata=%s, halt_bata=%s, cash_advance_issued=%s, enroute_repairs_maintenance=%s, pod_number=%s, trip_status=%s, is_tank_full=%s WHERE trip_id=%s;
                            """, (e_sdate, e_edate, e_lr, e_orig, e_dest, e_start_km, e_end_km, e_total_km, e_ton, e_unloaded_mt, e_ton, shortage_val, e_freight, e_fuel_l, recalculated_fuel_cost, e_bata, e_halt_bata, e_adv, e_claims, e_pod_no or None, e_trip_status, e_is_tank_full, t_data['trip_id']), fetch=False)
                            
                            status_update = "AVAILABLE_FOR_LOAD" if e_trip_status == "COMPLETED" else "IN_TRANSIT"
                            status_rem = f"Completed Trip {e_lr}" if e_trip_status == "COMPLETED" else f"Trip {e_lr}: {e_orig} ➔ {e_dest}"
                            run_query("UPDATE vehicles SET current_status = %s, status_remarks = %s WHERE vehicle_id = %s", (status_update, status_rem, t_data['vehicle_id']), fetch=False)

                            if run_query("SELECT fuel_log_id FROM diesel_fuel_logs WHERE trip_id = %s OR (lr_number = %s AND vehicle_id = %s)", (t_data['trip_id'], t_data['trip_number'], t_data['vehicle_id'])):
                                run_query("UPDATE diesel_fuel_logs SET fuel_date=%s, lr_number=%s, litres_filled=%s, total_fuel_cost=%s, filling_odometer_km=%s, trip_id=%s, is_tank_full=%s WHERE trip_id = %s OR (lr_number = %s AND vehicle_id = %s);", (e_sdate, e_lr, e_fuel_l, recalculated_fuel_cost, e_start_km, t_data['trip_id'], e_is_tank_full, t_data['trip_id'], t_data['trip_number'], t_data['vehicle_id']), fetch=False)

                            get_cached_vehicles.clear(); trigger_toast_and_rerun("SUCCESS", f"Trip #{e_lr} updated successfully.")
                        except Exception as e: show_error_toast(f"Update failed: {e}")
                    confirm_action_dialog(f"commit modifications to Trip {e_lr}", execute_mod_trip)

            st.markdown("<hr style='margin: 10px 0;' />", unsafe_allow_html=True)
            act1, act2 = st.columns(2)
            with act1:
                if t_data['trip_status'] == 'COMPLETED':
                    if st.button("🔓 Reopen Trip (Set back to IN_TRANSIT)", use_container_width=True):
                        confirm_action_dialog(f"reopen Trip {t_data['trip_number']}", lambda: (run_query("UPDATE trips SET trip_status = 'IN_TRANSIT', pod_number = NULL, trip_closed_at = NULL WHERE trip_id = %s;", (t_data['trip_id'],), fetch=False), run_query("UPDATE vehicles SET current_status = 'IN_TRANSIT', status_remarks = %s WHERE vehicle_id = %s;", (f"Reopened Trip {t_data['trip_number']}", t_data['vehicle_id']), fetch=False), get_cached_vehicles.clear(), trigger_toast_and_rerun("SUCCESS", "Trip reopened!")))
            with act2:
                if st.button(f"🗑️ Delete Trip {t_data['trip_number']}", type="secondary", use_container_width=True):
                    confirm_action_dialog(f"permanently delete Trip {t_data['trip_number']}", lambda: (run_query("UPDATE diesel_fuel_logs SET trip_id = NULL WHERE trip_id = %s", (t_data['trip_id'],), fetch=False), run_query("DELETE FROM trips WHERE trip_id = %s", (t_data['trip_id'],), fetch=False), run_query("UPDATE vehicles SET current_status = 'AVAILABLE_FOR_LOAD', status_remarks = 'Available' WHERE vehicle_id = %s AND current_status = 'IN_TRANSIT'", (t_data['vehicle_id'],), fetch=False), get_cached_vehicles.clear(), trigger_toast_and_rerun("SUCCESS", "Trip permanently deleted.")))

elif menu == "Driver Settlement":
    drivers = get_cached_drivers()
    if drivers:
        d_dict = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers}
        
        s1, s2, s3 = st.columns([2.5, 1.5, 1.5])
        with s1:
            sel_d_name = st.selectbox("Select Driver*", list(d_dict.keys()))
            selected_driver = d_dict[sel_d_name]
            d_id = selected_driver['driver_id']
        with s2: s_from = st.date_input("From Date*", date.today().replace(day=1))
        with s3: s_to = st.date_input("To Date*", date.today())

        trips_drv = run_query("""
            SELECT t.trip_start_date, t.trip_number AS lr_no, v.vehicle_number, t.origin AS source, t.destination, COALESCE(t.fuel_litres, 0.0) AS diesel_litres, COALESCE(t.driver_bata, 0.0) + COALESCE(t.halt_bata, 0.0) AS total_bata, COALESCE(t.cash_advance_issued, 0.0) AS advance_issued, ((COALESCE(t.driver_bata, 0.0) + COALESCE(t.halt_bata, 0.0)) - COALESCE(t.cash_advance_issued, 0.0)) AS balance_amount FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id WHERE t.primary_driver_id = %s AND t.trip_start_date::date >= %s AND t.trip_start_date::date <= %s ORDER BY v.vehicle_number ASC, t.trip_start_date ASC;
        """, (d_id, s_from, s_to))

        adv_drv = run_query("SELECT advance_date, amount_inr, advance_type, reference_remarks FROM driver_direct_advances WHERE driver_id = %s AND advance_date::date >= %s AND advance_date::date <= %s ORDER BY advance_date ASC;", (d_id, s_from, s_to))

        st.markdown(f'<div class="section-header">Settlement Statement for {selected_driver["full_name"]} ({s_from} to {s_to})</div>', unsafe_allow_html=True)
        grand_total_bata, grand_total_adv, grand_total_diesel = 0.0, 0.0, 0.0

        if trips_drv:
            df_all_trips = pd.DataFrame(trips_drv)
            for trk in df_all_trips['vehicle_number'].unique():
                st.markdown(f"#### 🚚 Truck: **{trk}**")
                df_trk = df_all_trips[df_all_trips['vehicle_number'] == trk].copy()
                df_trk_view = df_trk[['trip_start_date', 'lr_no', 'source', 'destination', 'diesel_litres', 'total_bata', 'advance_issued', 'balance_amount']].copy()
                
                sub_bata, sub_adv, sub_diesel, sub_bal = float(df_trk['total_bata'].sum() or 0.0), float(df_trk['advance_issued'].sum() or 0.0), float(df_trk['diesel_litres'].sum() or 0.0), float(df_trk['balance_amount'].sum() or 0.0)
                grand_total_bata += sub_bata; grand_total_adv += sub_adv; grand_total_diesel += sub_diesel

                st.dataframe(df_trk_view, column_config={"trip_start_date": "Date", "lr_no": "LR No", "source": "Source", "destination": "Destination", "diesel_litres": "Diesel (L)", "total_bata": "Bata (₹)", "advance_issued": "Advance (₹)", "balance_amount": "Balance (₹)"}, hide_index=True, use_container_width=True)
                
                sb1, sb2, sb3, sb4 = st.columns(4)
                sb1.caption(f"**Diesel:** {sub_diesel:,.1f} L"); sb2.caption(f"**Bata:** ₹{sub_bata:,.2f}"); sb3.caption(f"**Advance:** ₹{sub_adv:,.2f}"); sb4.caption(f"**Balance:** ₹{sub_bal:,.2f}")
                st.markdown("<hr style='margin: 6px 0 12px 0;' />", unsafe_allow_html=True)
        else:
            df_all_trips = pd.DataFrame(); st.info("No trips logged.")

        direct_adv_sum = 0.0
        if adv_drv:
            st.markdown("#### 💵 Direct Cash & Salary Advances (Outside Trips)")
            df_direct_adv = pd.DataFrame(adv_drv)
            direct_adv_sum = float(df_direct_adv['amount_inr'].sum() or 0.0)
            grand_total_adv += direct_adv_sum
            st.dataframe(df_direct_adv, column_config={"advance_date": "Date", "amount_inr": "Advance Amount (₹)", "advance_type": "Category", "reference_remarks": "Remarks"}, hide_index=True, use_container_width=True)
        else: df_direct_adv = pd.DataFrame()

        final_balance_payable = grand_total_bata - grand_total_adv
        st.markdown('<div class="section-header">Overall Cycle Position</div>', unsafe_allow_html=True)
        g1, g2, g3, g4 = st.columns(4)
        g1.metric("Total Diesel Issued", f"{grand_total_diesel:,.1f} L")
        g2.metric("Total Bata Earned", f"₹{grand_total_bata:,.2f}")
        g3.metric("Total Advances Deducted", f"₹{grand_total_adv:,.2f}")
        g4.metric("Grand Total Balance Payable", f"₹{final_balance_payable:,.2f}")

        st.write("")
        act_col1, act_col2, act_col3 = st.columns([2, 1.2, 1.2])
        with act_col2:
            if HAS_FPDF:
                pdf_data = generate_settlement_pdf(selected_driver['full_name'], s_from, s_to, df_all_trips, df_direct_adv, {'diesel': grand_total_diesel, 'bata': grand_total_bata, 'adv': grand_total_adv, 'bal': final_balance_payable})
                st.download_button("📄 Download Statement", data=pdf_data, file_name=f"Settlement_{selected_driver['driver_code']}.pdf", mime="application/pdf", use_container_width=True)
            else: st.error("⚠️ Install fpdf via terminal to enable PDF.")
                
        with act_col3:
            if st.session_state.user_role == "MASTER":
                if st.button("Mark Period Settled", type="primary", use_container_width=True):
                    confirm_action_dialog(f"mark records for {selected_driver['full_name']} as SETTLED", lambda: (run_query("UPDATE trips SET settlement_status='SETTLED' WHERE primary_driver_id=%s AND trip_start_date::date>=%s AND trip_start_date::date<=%s", (d_id, s_from, s_to), fetch=False), run_query("UPDATE driver_direct_advances SET is_settled=TRUE WHERE driver_id=%s AND advance_date::date>=%s AND advance_date::date<=%s", (d_id, s_from, s_to), fetch=False), trigger_toast_and_rerun("SUCCESS", "Settlement reconciled.")))

elif menu == "Master Configuration":
    t_v, t_d, t_r, t_b = st.tabs(["Trucks", "Drivers", "Freight Slabs", "Driver Bata Slabs"])
    
    with t_v:
        c1, c2 = st.columns([1.5, 3.5])
        with c1:
            with st.form("quick_truck"):
                st.markdown('<div class="section-header">Add New Truck</div>', unsafe_allow_html=True)
                nv = st.text_input("Truck Registration No*").upper().strip()
                vt = st.selectbox("Variant", ["Bulker (16-Wheel)", "Bulker (14-Wheel)", "Bulker", "Body Truck"])
                vc = st.selectbox("Capacity (MT)", [25.0, 30.0, 35.0], index=2)
                odo_working = st.checkbox("✅ Odometer Working", value=True)
                st.write("")
                if st.form_submit_button("Save Truck", type="primary"):
                    if not nv: show_error_toast("Required field missing.")
                    else: confirm_action_dialog(f"register truck {nv}", lambda: (run_query("INSERT INTO vehicles (vehicle_number, truck_type, carrying_capacity_tons, current_status, odometer_working) VALUES (%s, %s, %s, 'AVAILABLE_FOR_LOAD', %s)", (nv, vt, vc, odo_working), fetch=False), get_cached_vehicles.clear(), trigger_toast_and_rerun("SUCCESS", "Saved.")))
        with c2:
            st.markdown('<div class="section-header">Fleet Registry</div>', unsafe_allow_html=True)
            v_recs = get_cached_vehicles()
            if v_recs: st.dataframe(pd.DataFrame(v_recs)[['vehicle_number', 'truck_type', 'carrying_capacity_tons', 'current_status']], hide_index=True, use_container_width=True, height=450)

    with t_d:
        c1, c2 = st.columns([1.5, 3.5])
        with c1:
            with st.form("quick_driver"):
                st.markdown('<div class="section-header">Add Driver</div>', unsafe_allow_html=True)
                nd_c = st.text_input("Driver Code*", value=f"DRV-{len(get_cached_drivers(True))+1:03d}").strip().upper()
                nd_n = st.text_input("Full Name*").strip()
                nd_p = st.text_input("Phone*").strip()
                nd_l = st.text_input("License No").strip().upper()
                nd_exp = st.date_input("License Expiry Date", date(2030, 1, 1))
                st.write("")
                if st.form_submit_button("Save Driver", type="primary"):
                    if not nd_n or not nd_p: show_error_toast("Required field missing.")
                    else: confirm_action_dialog(f"register driver {nd_n}", lambda: (run_query("INSERT INTO drivers (driver_code, full_name, phone_number, license_number, license_expiry_date, branch_id) VALUES (%s, %s, %s, %s, %s, 1) ON CONFLICT (driver_code) DO UPDATE SET full_name = EXCLUDED.full_name, phone_number = EXCLUDED.phone_number, license_number = EXCLUDED.license_number, license_expiry_date = EXCLUDED.license_expiry_date, is_active = TRUE;", (nd_c, nd_n, nd_p, nd_l, nd_exp), fetch=False), get_cached_drivers.clear(), trigger_toast_and_rerun("SUCCESS", "Saved.")))
        with c2:
            st.markdown('<div class="section-header">Driver Directory</div>', unsafe_allow_html=True)
            d_recs = get_cached_drivers(True)
            if d_recs: st.dataframe(pd.DataFrame(d_recs)[['driver_code', 'full_name', 'phone_number', 'license_number']], hide_index=True, use_container_width=True, height=450)

    with t_r:
        c1, c2 = st.columns([1.5, 3.5])
        with c1:
            with st.form("quick_slab"):
                st.markdown('<div class="section-header">Add Freight Slab</div>', unsafe_allow_html=True)
                cg = st.selectbox("Cargo", ["BULK", "BAG"])
                so = st.selectbox("Origin", STANDARD_SOURCES)
                dt = st.text_input("Destination*").strip().upper()
                cl = st.selectbox("Class (MT)", [25.0, 30.0, 35.0], index=2)
                rt = st.number_input("Rate/MT (₹)*", min_value=0.0, step=25.0)
                km = st.number_input("Standard KM", min_value=0.0, step=10.0)
                st.write("")
                if st.form_submit_button("Save Route", type="primary"):
                    if not dt or rt <= 0: show_error_toast("Destination & Rate required.")
                    else:
                        def run_route():
                            for c_val in ([25.0, 30.0] if cg == "BAG" else [cl]): run_query("INSERT INTO destinations_freight_master (cargo_type, origin, destination_name, capacity_tons, freight_rate_per_ton, standard_km) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (cargo_type, origin, destination_name, capacity_tons) DO UPDATE SET freight_rate_per_ton = EXCLUDED.freight_rate_per_ton, standard_km = EXCLUDED.standard_km;", (cg, so, dt, c_val, rt, km), fetch=False)
                            get_cached_routes.clear(); trigger_toast_and_rerun("SUCCESS", "Saved.")
                        confirm_action_dialog(f"save slab {so} to {dt}", run_route)
        with c2:
            st.markdown('<div class="section-header">Freight Slabs</div>', unsafe_allow_html=True)
            r_recs = get_cached_routes()
            if r_recs: st.dataframe(pd.DataFrame(r_recs)[['cargo_type', 'origin', 'destination_name', 'capacity_tons', 'freight_rate_per_ton', 'standard_km']], hide_index=True, use_container_width=True, height=450)

    with t_b:
        c1, c2 = st.columns([1.5, 3.5])
        with c1:
            with st.form("quick_bata"):
                st.markdown('<div class="section-header">Add Bata Slab</div>', unsafe_allow_html=True)
                bo = st.selectbox("Origin Source*", STANDARD_SOURCES)
                bd = st.text_input("Destination Terminal*").strip().upper()
                selected_slab_label = st.selectbox("Truck Slab*", list(BATA_SLAB_DEFINITIONS.keys()))
                slab_meta = BATA_SLAB_DEFINITIONS[selected_slab_label]
                ba = st.number_input("Standard Bata (₹)*", min_value=0.0, step=100.0, value=3000.0)
                st.write("")
                if st.form_submit_button("Save Bata Slab", type="primary"):
                    if not bd or ba <= 0: show_error_toast("Required fields missing.")
                    else:
                        def run_bata():
                            try:
                                run_query("INSERT INTO driver_bata_master (origin, destination_name, cargo_type, capacity_tons, standard_bata_inr) VALUES (%s, %s, %s, %s, %s)", (bo, bd, slab_meta["cargo_type"], slab_meta["capacity_tons"], ba), fetch=False)
                                get_cached_bata_rules.clear(); trigger_toast_and_rerun("SUCCESS", "Saved.")
                            except Exception:
                                run_query("UPDATE driver_bata_master SET standard_bata_inr=%s WHERE UPPER(origin)=UPPER(%s) AND UPPER(destination_name)=UPPER(%s) AND cargo_type=%s AND capacity_tons=%s", (ba, bo, bd, slab_meta["cargo_type"], slab_meta["capacity_tons"]), fetch=False)
                                get_cached_bata_rules.clear(); trigger_toast_and_rerun("SUCCESS", "Updated.")
                        confirm_action_dialog(f"save Bata slab {bo} to {bd}", run_bata)
        with c2:
            st.markdown('<div class="section-header">Bata Slabs Directory</div>', unsafe_allow_html=True)
            bata_list = get_cached_bata_rules()
            if bata_list:
                df_bata = pd.DataFrame(bata_list)
                def format_slab(r): return f"{int(float(r['capacity_tons']))}MT Body (Bag)" if str(r['cargo_type']).upper() == "BAG" else f"{int(float(r['capacity_tons']))}MT Bulk (Bulker)"
                df_bata['bata_slab'] = df_bata.apply(format_slab, axis=1)
                st.dataframe(df_bata[['origin', 'destination_name', 'bata_slab', 'standard_bata_inr']], column_config={"origin": "Source", "destination_name": "Destination", "bata_slab": "Slab", "standard_bata_inr": "Bata (₹)"}, hide_index=True, use_container_width=True, height=450)

elif menu == "Executive Retention Analytics":
    tfc1, tfc2, tfc3 = st.columns(3)
    with tfc1:
        report_period_type = st.selectbox("Analysis Window", ["Current Fiscal Month", "Lifetime Fleet Analytics", "Custom Operating Period"])

    today = date.today()
    if report_period_type == "Current Fiscal Month":
        start_filter_date, end_filter_date = today.replace(day=1), today
    elif report_period_type == "Custom Operating Period":
        with tfc2: start_filter_date = st.date_input("Period From*", today.replace(day=1))
        with tfc3: end_filter_date = st.date_input("Period To*", today)
    else:
        start_filter_date, end_filter_date = None, None

    st.markdown('<div class="section-header">Performance Filter</div>', unsafe_allow_html=True)
    sort_c1, sort_c2 = st.columns([2.5, 2.5])
    with sort_c1: sort_metric_label = st.selectbox("Sort By Metric", ["Total Net Retention (₹)", "Total Freight Revenue (₹)", "Total Trips", "Incomplete Trips", "Total Tons (MT)", "Total Diesel (L)", "Total Diesel Expense (₹)", "Retention %", "Diesel %", "KMPL"])
    with sort_c2: sort_direction_label = st.selectbox("Ranking Order", ["Top Performers (Descending)", "Underperformers (Ascending)"])

    METRIC_COL_MAP = {"Total Net Retention (₹)": "net_retention", "Total Freight Revenue (₹)": "total_freight", "Total Trips": "total_trips", "Incomplete Trips": "incomplete_trips", "Total Tons (MT)": "total_tons", "Total Diesel (L)": "total_diesel_litres", "Total Diesel Expense (₹)": "total_diesel_cost", "Retention %": "retention_pct", "Diesel %": "diesel_pct", "KMPL": "kmpl"}
    target_sort_col, is_ascending = METRIC_COL_MAP[sort_metric_label], ("Ascending" in sort_direction_label)

    tab_f, tab_v, tab_d = st.tabs(["📊 Fleet Retention", "⚖️ Variant Benchmarks", "👨‍✈️ Driver Scorecard"])
    
    fleet_sql = f"""
        WITH vehicle_fuel_summary AS (SELECT vehicle_id, COALESCE(SUM(litres_filled), 0.00) AS total_litres_pumped, COALESCE(SUM(total_fuel_cost), 0.00) AS total_diesel_expense FROM diesel_fuel_logs {'WHERE fuel_date::date >= %s AND fuel_date::date <= %s' if start_filter_date else ''} GROUP BY vehicle_id),
        vehicle_trip_summary AS (SELECT t.vehicle_id, COUNT(t.trip_id) AS trips_count, COUNT(CASE WHEN t.trip_status != 'COMPLETED' THEN 1 END) AS pending_pod_count, COALESCE(SUM(COALESCE(t.total_km_run, 0.00)), 0.00) AS total_km_run, COALESCE(SUM(COALESCE(NULLIF(t.loaded_weight_mt, 0.00), NULLIF(t.tonnage_loaded, 0.00), 0.00)), 0.00) AS total_tonnage, COALESCE(SUM(COALESCE(t.freight_revenue, 0.00)), 0.00) AS total_freight_revenue, COALESCE(SUM(COALESCE(t.driver_bata, 0.00) + COALESCE(t.halt_bata, 0.00) + COALESCE(t.enroute_repairs_maintenance, 0.00)), 0.00) AS non_fuel_trip_costs FROM trips t {'WHERE t.trip_start_date::date >= %s AND t.trip_start_date::date <= %s' if start_filter_date else ''} GROUP BY t.vehicle_id)
        SELECT v.vehicle_number, v.truck_type, COALESCE(ts.trips_count, 0) AS total_trips, COALESCE(ts.pending_pod_count, 0) AS incomplete_trips, COALESCE(ts.total_freight_revenue, 0.00) AS total_freight, COALESCE(fs.total_litres_pumped, 0.00) AS total_diesel_litres, COALESCE(fs.total_diesel_expense, 0.00) AS total_diesel_cost, (COALESCE(ts.total_freight_revenue, 0.00) - (COALESCE(fs.total_diesel_expense, 0.00) + COALESCE(ts.non_fuel_trip_costs, 0.00))) AS net_retention, ROUND((COALESCE(ts.total_freight_revenue, 0.00) - (COALESCE(fs.total_diesel_expense, 0.00) + COALESCE(ts.non_fuel_trip_costs, 0.00))) / NULLIF(ts.total_freight_revenue, 0.00) * 100.0, 2) AS retention_pct, ROUND(COALESCE(fs.total_diesel_expense, 0.00) / NULLIF(ts.total_freight_revenue, 0.00) * 100.0, 2) AS diesel_pct, ROUND(COALESCE(ts.total_km_run, 0.00) / NULLIF(fs.total_litres_pumped, 0.00), 2) AS kmpl FROM vehicles v LEFT JOIN vehicle_trip_summary ts ON v.vehicle_id = ts.vehicle_id LEFT JOIN vehicle_fuel_summary fs ON v.vehicle_id = fs.vehicle_id WHERE v.is_active = TRUE;
    """
    fleet_data = run_query(fleet_sql, (start_filter_date, end_filter_date, start_filter_date, end_filter_date) if start_filter_date else None)

    with tab_f:
        if fleet_data:
            df_fl = pd.DataFrame(fleet_data).fillna(0.0)
            
            # --- THE FIX: Explicitly cast to float before math ---
            tot_freight = float(df_fl['total_freight'].sum() or 0.0)
            tot_diesel = float(df_fl['total_diesel_cost'].sum() or 0.0)
            tot_ret = float(df_fl['net_retention'].sum() or 0.0)
            ret_pct = round((tot_ret / max(1.0, tot_freight)) * 100.0, 2)
            
            df_fl = df_fl.sort_values(by=[target_sort_col], ascending=[is_ascending]).reset_index(drop=True)
            k1, k2, k3, k4 = st.columns(4)
            k1.metric("Fleet Revenue", f"₹{tot_freight:,.2f}")
            k2.metric("Fleet Diesel Cost", f"₹{tot_diesel:,.2f}")
            k3.metric("Net Margin", f"₹{tot_ret:,.2f}")
            k4.metric("Retention %", f"{ret_pct}%")
            st.dataframe(df_fl, hide_index=True, use_container_width=True, height=400)

    with tab_v:
        if fleet_data:
            df_v_peer = pd.DataFrame(fleet_data).fillna(0.0)
            sel_var = st.selectbox("Variant Class", ["All Variants"] + sorted(list(set(df_v_peer['truck_type'].tolist()))))
            if sel_var != "All Variants": df_v_peer = df_v_peer[df_v_peer['truck_type'] == sel_var]
            st.dataframe(df_v_peer.sort_values(by=[target_sort_col], ascending=[is_ascending]), hide_index=True, use_container_width=True, height=400)

    with tab_d:
        drv_sql = f"SELECT d.driver_code, d.full_name, COUNT(t.trip_id) AS trips, COALESCE(SUM(t.total_km_run), 0.00) AS total_km, ROUND(SUM(t.total_km_run) / NULLIF(SUM(t.fuel_litres), 0.00), 2) AS kmpl, COALESCE(SUM(t.freight_revenue), 0.00) AS revenue FROM drivers d LEFT JOIN trips t ON d.driver_id = t.primary_driver_id {'AND t.trip_start_date::date >= %s AND t.trip_start_date::date <= %s' if start_filter_date else ''} WHERE d.is_active = TRUE GROUP BY d.driver_code, d.full_name ORDER BY revenue DESC;"
        drv_data = run_query(drv_sql, (start_filter_date, end_filter_date) if start_filter_date else None)
        if drv_data: st.dataframe(pd.DataFrame(drv_data).fillna(0.0), hide_index=True, use_container_width=True, height=450)

elif menu == "Audit Log":
    st.markdown('<div class="section-header">System Audit Log</div>', unsafe_allow_html=True)
    af_col1, af_col2, af_col3, af_col4, af_col5 = st.columns([1.8, 1.8, 1.8, 1.8, 2.0])
    with af_col1: aud_date_mode = st.selectbox("Date Mode", ["All Dates", "Specific Date", "Date Range"])
    with af_col2: sel_aud_trk = st.selectbox("Truck", ["All"] + sorted([v['vehicle_number'] for v in get_cached_vehicles()]))
    with af_col3: sel_aud_stat = st.selectbox("Status", ["All", "IN_TRANSIT", "COMPLETED"])
    with af_col4: sel_aud_drv = st.selectbox("Driver", ["All"] + sorted([f"{d['driver_code']} - {d['full_name']}" for d in get_cached_drivers()]))
    with af_col5: search_aud = st.text_input("Search LR/Dest").strip().upper()

    aud_q, aud_p = "", []
    if aud_date_mode == "Specific Date":
        aud_q = " AND t.trip_start_date::date = %s"; aud_p.append(st.date_input("Date", date.today()))
    elif aud_date_mode == "Date Range":
        c_d1, c_d2 = st.columns(2); aud_p.append(c_d1.date_input("From", date.today().replace(day=1))); aud_p.append(c_d2.date_input("To", date.today())); aud_q = " AND t.trip_start_date::date >= %s AND t.trip_start_date::date <= %s"

    try:
        aud_sql = f"SELECT t.trip_id, t.trip_number, t.pod_number, t.trip_start_date, v.vehicle_number, d.full_name AS driver, t.origin, t.destination, t.start_km, t.end_km, t.total_km_run, t.loaded_weight_mt, t.freight_revenue, t.fuel_litres, t.fuel_expense, t.driver_bata, t.cash_advance_issued, (t.freight_revenue - (t.fuel_expense + t.driver_bata + t.halt_bata + t.enroute_repairs_maintenance)) AS net_profit, t.trip_status, t.is_tank_full FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id WHERE 1=1 {aud_q}"
        run_query(aud_sql + " LIMIT 1", tuple(aud_p) if aud_p else None)
    except Exception:
        aud_sql = f"SELECT t.trip_id, t.trip_number, t.pod_number, t.trip_start_date, v.vehicle_number, d.full_name AS driver, t.origin, t.destination, t.start_km, t.end_km, t.total_km_run, t.loaded_weight_mt, t.freight_revenue, t.fuel_litres, t.fuel_expense, t.driver_bata, t.cash_advance_issued, (t.freight_revenue - (t.fuel_expense + t.driver_bata + t.halt_bata + t.enroute_repairs_maintenance)) AS net_profit, t.trip_status FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id WHERE 1=1 {aud_q}"

    if sel_aud_trk != "All": aud_sql += " AND v.vehicle_number = %s"; aud_p.append(sel_aud_trk)
    if sel_aud_stat != "All": aud_sql += " AND t.trip_status = %s"; aud_p.append(sel_aud_stat)
    if sel_aud_drv != "All": aud_sql += " AND d.driver_code = %s"; aud_p.append(sel_aud_drv.split(" - ")[0].strip())
    if search_aud: aud_sql += " AND (UPPER(t.trip_number) LIKE %s OR UPPER(t.destination) LIKE %s OR UPPER(t.origin) LIKE %s)"; aud_p.extend([f"%{search_aud}%", f"%{search_aud}%", f"%{search_aud}%"])
    aud_sql += " ORDER BY t.trip_id DESC;"

    all_trips = run_query(aud_sql, tuple(aud_p) if aud_p else None)
    if all_trips:
        df_all = pd.DataFrame(all_trips)
        st.dataframe(df_all, hide_index=True, use_container_width=True, height=450)
        
        if st.session_state.user_role == "MASTER":
            del_c1, del_c3 = st.columns([3.0, 1.0])
            with del_c1: del_id = st.selectbox("Select Trip ID to Delete", df_all['trip_id'].tolist(), format_func=lambda x: f"Trip ID #{x} - LR: {df_all.loc[df_all['trip_id'] == x, 'trip_number'].values[0]}")
            with del_c3:
                st.write("")
                if st.button("🗑️ Purge Trip", type="secondary", use_container_width=True):
                    confirm_action_dialog(f"purge Trip #{del_id}", lambda: (run_query("UPDATE diesel_fuel_logs SET trip_id = NULL WHERE trip_id = %s", (del_id,), fetch=False), run_query("DELETE FROM trips WHERE trip_id = %s", (del_id,), fetch=False), trigger_toast_and_rerun("SUCCESS", "Purged.")))
    else: st.info("No records match criteria.")
