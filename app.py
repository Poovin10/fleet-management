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
    page_title="Fleet Operations ERP",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    html, body, [class*="css"] { font-family: 'Inter', -apple-system, sans-serif !important; }
    .stApp { background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%) !important; }
    header, #MainMenu, footer { visibility: hidden; display: none !important; }
    
    @keyframes fadeInScale {
        0% { opacity: 0; transform: translateY(10px) scale(0.99); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    .main .block-container, div[data-testid="stAppViewBlockContainer"] {
        animation: fadeInScale 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        padding: 1.5rem 3rem 2rem 3rem !important;
        max-width: 1600px !important;
    }

    div[data-testid="stForm"] {
        background: rgba(255, 255, 255, 0.85) !important;
        backdrop-filter: blur(10px) !important;
        border: 1px solid rgba(226, 232, 240, 0.8) !important;
        border-radius: 12px !important;
        padding: 24px !important;
        box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.05) !important;
        transition: transform 0.2s ease, box-shadow 0.2s ease !important;
    }
    div[data-testid="stForm"]:hover {
        box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.08) !important;
    }

    div[data-testid="metric-container"] {
        background-color: #FFFFFF !important;
        border: 1px solid #F1F5F9 !important;
        border-radius: 10px !important;
        padding: 16px 20px !important;
        box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.04) !important;
        border-left: 5px solid #3B82F6 !important;
        transition: all 0.2s ease !important;
    }
    div[data-testid="metric-container"]:hover {
        transform: translateY(-3px) !important;
        box-shadow: 0 8px 12px -3px rgba(0, 0, 0, 0.08) !important;
        border-left-color: #2563EB !important;
    }
    div[data-testid="stMetricValue"] { font-size: 1.6rem !important; font-weight: 800 !important; color: #0F172A !important; }
    div[data-testid="stMetricLabel"] { font-size: 0.75rem !important; font-weight: 700 !important; color: #64748B !important; text-transform: uppercase !important; }

    .section-header {
        font-size: 1.05rem !important; font-weight: 800 !important; color: #0F172A !important;
        border-bottom: 2px solid #E2E8F0 !important; padding-bottom: 6px !important;
        margin: 16px 0 !important; text-transform: uppercase !important; letter-spacing: 0.5px !important;
    }

    .stTextInput>div>div>input, .stNumberInput>div>div>input, .stSelectbox>div>div>div {
        height: 44px !important; font-size: 0.92rem !important; font-weight: 500 !important;
        border-radius: 8px !important; background-color: #F8FAFC !important;
        border: 1.5px solid #CBD5E1 !important; color: #1E293B !important; transition: all 0.2s ease !important;
    }
    .stTextInput>div>div>input:focus, .stNumberInput>div>div>input:focus, .stSelectbox>div>div>div:focus {
        background-color: #FFFFFF !important; border-color: #3B82F6 !important; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
    }
    .stTextInput>div>div>input:disabled { background-color: #F1F5F9 !important; color: #64748B !important; font-weight: 700 !important; }

    .stButton>button { height: 46px !important; font-size: 0.95rem !important; font-weight: 600 !important; border-radius: 8px !important; transition: all 0.2s ease !important; }
    .stButton>button[kind="primary"] { background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%) !important; color: #FFFFFF !important; border: none !important; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2) !important; }
    .stButton>button[kind="primary"]:hover { box-shadow: 0 6px 15px rgba(37, 99, 235, 0.3) !important; transform: translateY(-1px) !important; }
    
    .stTabs [data-baseweb="tab-list"] { background-color: #E2E8F0; border-radius: 10px; padding: 4px; gap: 4px; border: none !important; }
    .stTabs [data-baseweb="tab"] { border-radius: 6px; padding: 10px 20px; color: #64748B !important; font-weight: 600 !important; border: none !important; height: 44px; margin: 0 !important; }
    .stTabs [data-baseweb="tab"]:hover { color: #0F172A !important; }
    .stTabs [aria-selected="true"] { background-color: #FFFFFF !important; color: #0F172A !important; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08) !important; }
    .stTabs [data-baseweb="tab-highlight"] { display: none !important; }

    div[data-testid="stDataFrame"] > div { border-radius: 10px !important; border: 1px solid #E2E8F0 !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03) !important; }
    div[data-testid="stToast"] { font-size: 0.92rem !important; font-weight: 600 !important; border-radius: 8px !important; box-shadow: 0 8px 20px -5px rgba(0, 0, 0, 0.15) !important; padding: 14px !important; }
</style>
""", unsafe_allow_html=True)

# ==============================================================================
# 2. CORE SYSTEM FUNCTIONS & DATABASE MANAGEMENT
# ==============================================================================

# --- UI Helpers ---
def show_success_toast(msg: str): st.toast(f"✅ {msg}", icon="✅")
def show_error_toast(msg: str): st.toast(f"❌ {msg}", icon="❌")

if "pending_toast" in st.session_state and st.session_state.pending_toast:
    t_type, t_msg = st.session_state.pending_toast
    show_success_toast(t_msg) if t_type == "SUCCESS" else show_error_toast(t_msg)
    st.session_state.pending_toast = None

def trigger_toast_and_rerun(toast_type: str, message: str, delay_sec: float = 1.0):
    st.session_state.pending_toast = (toast_type, message)
    time.sleep(delay_sec)
    st.rerun()

@st.dialog("⚠️ Action Confirmation")
def confirm_action_dialog(message: str, action_callback):
    st.markdown(f"You are about to **{message}**.")
    st.markdown("Are you sure you want to proceed? This action cannot be easily undone.")
    c1, c2 = st.columns(2)
    with c1:
        if st.button("✅ Yes, Confirm", use_container_width=True, type="primary"):
            action_callback()
            if "pending_toast" not in st.session_state or not st.session_state.pending_toast: st.rerun()
    with c2:
        if st.button("❌ Cancel", use_container_width=True): st.rerun()

# --- Database Connection ---
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
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        db_pool.putconn(conn)

# --- Schema Synchronization (Guarantees no DB crashes) ---
def ensure_schema_updates():
    try:
        run_query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS odometer_working BOOLEAN DEFAULT TRUE;", fetch=False)
        run_query("ALTER TABLE diesel_fuel_logs ADD COLUMN IF NOT EXISTS is_tank_full BOOLEAN DEFAULT FALSE;", fetch=False)
        run_query("ALTER TABLE trips ADD COLUMN IF NOT EXISTS is_tank_full BOOLEAN DEFAULT FALSE;", fetch=False)
        run_query("ALTER TABLE driver_bata_master ADD COLUMN IF NOT EXISTS origin VARCHAR(100) DEFAULT 'ALL';", fetch=False)
    except Exception:
        pass
ensure_schema_updates()

# ==============================================================================
# 3. BUSINESS LOGIC & CACHING
# ==============================================================================
STATUS_OPTIONS = {
    "AVAILABLE_FOR_LOAD": "Available for Loading", "WAITING_FOR_LOAD": "Waiting for Loading (Plant)",
    "IN_TRANSIT": "In Transit (On Highway)", "WAITING_FOR_UNLOAD": "Waiting for Unloading (Site)",
    "WORKSHOP_MAINTENANCE": "In Workshop / Maintenance", "DRIVER_UNAVAILABLE": "Driver Unavailable / Leave"
}
STANDARD_SOURCES = ["COCHIN", "POTTANERI", "METTUR", "UDUPPI", "COCHIN-ACC", "TUTICORIN", "CUSTOM"]
BATA_SLAB_DEFINITIONS = {
    "25MT Body (Bag)": {"cargo_type": "BAG", "capacity_tons": 25.0}, "30MT Body (Bag)": {"cargo_type": "BAG", "capacity_tons": 30.0},
    "25MT Bulk (Bulker)": {"cargo_type": "BULK", "capacity_tons": 25.0}, "30MT Bulk (Bulker)": {"cargo_type": "BULK", "capacity_tons": 30.0},
    "35MT Bulk (Bulker)": {"cargo_type": "BULK", "capacity_tons": 35.0}
}

@st.cache_data(ttl=60)
def get_cached_vehicles():
    return run_query("SELECT vehicle_id, vehicle_number, truck_type, carrying_capacity_tons, current_status, status_remarks, odometer_working FROM vehicles WHERE is_active = TRUE ORDER BY vehicle_number")

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
    try:
        return run_query("SELECT bata_rule_id, origin, destination_name, cargo_type, capacity_tons, standard_bata_inr FROM driver_bata_master ORDER BY origin ASC, destination_name ASC, cargo_type ASC, capacity_tons ASC;")
    except Exception:
        return run_query("SELECT bata_rule_id, destination_name, cargo_type, capacity_tons, standard_bata_inr FROM driver_bata_master ORDER BY destination_name ASC, cargo_type ASC, capacity_tons ASC;")

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
    if res3 and res3[0].get('end_km'): return float(res3[0]['end_km'])
    return 0.0

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
        res = run_query("""
            SELECT standard_bata_inr 
            FROM driver_bata_master 
            WHERE UPPER(origin) = UPPER(%s)
              AND UPPER(destination_name) = UPPER(%s) 
              AND cargo_type = %s 
              AND capacity_tons = %s 
            LIMIT 1;
        """, (origin.strip(), dest_name.strip(), cargo_type, capacity_tons))
        if res: return float(res[0]['standard_bata_inr'])
    except Exception:
        pass
    return 0.00

# ==============================================================================
# 4. AUTHENTICATION & NAVIGATION
# ==============================================================================
USER_CREDENTIALS = {"admin": {"password": "admin123", "role": "MASTER"}, "user": {"password": "user123", "role": "VIEWER"}}

if "authenticated" not in st.session_state:
    st.session_state.authenticated, st.session_state.username, st.session_state.user_role = False, None, None

if not st.session_state.authenticated:
    st.markdown("<br><br><br><br>", unsafe_allow_html=True)
    _, col, _ = st.columns([3, 4, 3])
    with col:
        st.markdown("<h1 style='text-align: center; color: #0F172A; font-weight: 800; letter-spacing: -1px;'>Fleet Operations ERP</h1>", unsafe_allow_html=True)
        st.markdown("<p style='text-align: center; color: #64748B; margin-bottom: 32px; font-size: 1.1rem;'>Log in to access your secure dashboard</p>", unsafe_allow_html=True)
        with st.form("login_form"):
            in_user = st.text_input("Username").strip().lower()
            in_pass = st.text_input("Password", type="password").strip()
            st.write("")
            if st.form_submit_button("Secure Sign In", type="primary", use_container_width=True):
                if in_user in USER_CREDENTIALS and USER_CREDENTIALS[in_user]["password"] == in_pass:
                    st.session_state.update({"authenticated": True, "username": in_user, "user_role": USER_CREDENTIALS[in_user]["role"]})
                    st.rerun()
                else: show_error_toast("Invalid Username or Password.")
    st.stop()

nav1, nav2, nav3 = st.columns([3.0, 6.0, 1.0])
with nav1:
    role_badge = "👑 MASTER" if st.session_state.user_role == "MASTER" else "👁️ REPORTS ONLY"
    st.markdown(f"<h3 style='margin:0; padding:0; font-size:1.45rem; color:#0F172A; font-weight:800; letter-spacing:-0.5px;'>Fleet Operations <span style='font-size:0.75rem; background:#DBEAFE; color:#1E40AF; padding:4px 10px; border-radius:8px; margin-left:8px; vertical-align: middle; border: 1px solid #BFDBFE;'>{role_badge}</span></h3>", unsafe_allow_html=True)

with nav2:
    MODULE_LIST = ["Trip Dispatch Entry", "POD Receive & Close", "Fleet Status Board", "Diesel Logs", "Driver Advances", "Modify Trips & Claims", "Driver Settlement", "Master Configuration", "Executive Retention Analytics", "Audit Log"] if st.session_state.user_role == "MASTER" else ["Fleet Status Board", "Driver Settlement", "Executive Retention Analytics"]
    menu = st.selectbox("Module Navigation", MODULE_LIST, index=0, label_visibility="collapsed")

with nav3:
    if st.button("🚪 Logout", use_container_width=True):
        st.session_state.update({"authenticated": False, "username": None, "user_role": None})
        st.rerun()

st.markdown("<hr style='margin: 16px 0 24px 0; border: none; border-top: 1.5px solid #E2E8F0;' />", unsafe_allow_html=True)

# ==============================================================================
# MODULE: 1. TRIP DISPATCH ENTRY
# ==============================================================================
if menu == "Trip Dispatch Entry":
    vehicles, drivers = get_cached_vehicles(), get_cached_drivers()
    if not vehicles or not drivers: st.error("Configure vehicles and drivers in Master Configuration first."); st.stop()
    cnt = st.session_state.get("form_reset_counter", 0)

    # Safely load drivers here to fix scope issues
    driver_dict = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers}
    driver_keys_list = ["-- SELECT DRIVER --"] + list(driver_dict.keys())

    h_col1, h_col2 = st.columns([7.5, 2.5])
    with h_col1: st.markdown('<div class="section-header">Primary Manifest & Routing Assignment</div>', unsafe_allow_html=True)
    with h_col2:
        current_d_rate = get_cached_diesel_rate()
        d_rate_fast = st.number_input("⛽ Active Diesel Rate (₹/L)*", value=current_d_rate, step=0.1, key=f"drate_entry_{cnt}")
        if d_rate_fast != current_d_rate: set_saved_diesel_rate(d_rate_fast)
    
    r1_c1, r1_c2, r1_c3, r1_c4, r1_c5 = st.columns([1.2, 1.4, 1.3, 2.6, 1.5])
    with r1_c1: start_date = st.date_input("1. Trip Start Date*", date.today(), key=f"sdate_{cnt}")
    with r1_c2:
        lr_no = st.text_input("2. LR Number*", placeholder="LR-XXXX", key=f"lr_{cnt}").strip().upper()
        lr_check_res = check_lr_exists(lr_no) if lr_no else None
        if lr_check_res:
            if lr_check_res['trip_status'] != 'COMPLETED': st.warning(f"⚠️ LR `{lr_no}` is **IN TRANSIT** ({lr_check_res['vehicle_number']} | {lr_check_res['driver_name']})")
            else: st.error(f"❌ LR `{lr_no}` already exists (COMPLETED).")
    with r1_c3: cargo_category = st.selectbox("3. Cargo Category*", ["BULK", "BAG"], key=f"cargo_sel_{cnt}")

    filtered_vehicles = [v for v in vehicles if ("BULK" if cargo_category == "BULK" else "BAG") in str(v.get('truck_type', '')).upper() or (cargo_category == "BAG" and "BODY" in str(v.get('truck_type', '')).upper())]
    if not filtered_vehicles: filtered_vehicles = vehicles
    vehicle_map = {f"{v['vehicle_number']} ➔ [{v['truck_type']} | {v['carrying_capacity_tons']} MT]": v for v in filtered_vehicles}
    
    with r1_c4:
        sel_veh_label = st.selectbox(f"4. Assigned Truck*", ["-- SELECT TRUCK --"] + list(vehicle_map.keys()), key=f"veh_sel_{cnt}")
        active_veh, v_class_mt, open_trip_check, default_driver_sel = None, 30.0, None, "-- SELECT DRIVER --"
        if sel_veh_label != "-- SELECT TRUCK --":
            active_veh = vehicle_map[sel_veh_label]
            v_class_mt = float(active_veh['carrying_capacity_tons'])
            old_drv_id, old_weight, old_drv_name = get_last_driver_and_weight_for_vehicle(active_veh['vehicle_id'])
            if old_drv_id: default_driver_sel = next((k for k, d in driver_dict.items() if d['driver_id'] == old_drv_id), "-- SELECT DRIVER --")
            if old_drv_name: st.info(f"ℹ️ Last Assigned: **{old_drv_name}** ({old_weight} MT)")
            open_trip_check = check_vehicle_has_open_trip(active_veh['vehicle_id'])
            if open_trip_check: st.error(f"🚫 Truck {active_veh['vehicle_number']} has active trip (LR: {open_trip_check['trip_number']}).")
            if not active_veh.get('odometer_working', True): st.warning("⚠️ Odometer marked FAULTY. Rely on Standard Route KM.")

    with r1_c5:
        chosen_source_opt = st.selectbox("5. Source Hub*", ["-- SELECT SOURCE --"] + STANDARD_SOURCES, key=f"src_sel_{cnt}")
        origin_terminal = st.text_input("Custom Source", placeholder="Enter Source").strip().upper() if chosen_source_opt == "CUSTOM" else chosen_source_opt

    dest_options = {f"{r['destination_name']} ➔ [₹{r['freight_rate_per_ton']}/MT | {r['standard_km']} KM]": r for r in get_cached_routes(cargo_type, v_class_mt, origin_terminal)} if sel_veh_label != "-- SELECT TRUCK --" and chosen_source_opt != "-- SELECT SOURCE --" else {}
    dest_options["-- MANUAL / SPOT DESTINATION --"] = {"origin": origin_terminal, "destination_name": "", "standard_km": 0.0, "freight_rate_per_ton": 0.0}

    r2_c1, r2_c2, r2_c3, r2_c4 = st.columns([2.8, 2.2, 1.5, 1.5])
    with r2_c1:
        sel_dest_label = st.selectbox(f"6. Destination*", ["-- SELECT DESTINATION --"] + list(dest_options.keys()), key=f"dest_sel_{cnt}")
        dest_terminal, agreed_rate_mt, standard_route_km = "", 0.0, 0.0
        if sel_dest_label != "-- SELECT DESTINATION --":
            active_route = dest_options[sel_dest_label]
            if sel_dest_label == "-- MANUAL / SPOT DESTINATION --":
                dest_terminal = st.text_input("Custom Destination*", placeholder="e.g. SANKARI").strip().upper()
                agreed_rate_mt = st.number_input("Spot Freight Rate/MT*", min_value=0.0, step=25.0, key=f"spot_rate_{cnt}")
                standard_route_km = st.number_input("Standard KM", min_value=0.0, step=10.0, key=f"spot_km_{cnt}")
            else:
                dest_terminal, agreed_rate_mt, standard_route_km = active_route['destination_name'], float(active_route['freight_rate_per_ton']), float(active_route['standard_km'])
    with r2_c2:
        chosen_driver_str = st.selectbox("7. Designated Driver*", driver_keys_list, index=driver_keys_list.index(default_driver_sel) if default_driver_sel in driver_keys_list else 0, key=f"drv_sel_{cnt}_{sel_veh_label}")
        sel_driver_obj = driver_dict.get(chosen_driver_str)
    with r2_c3:
        weighbridge_mt = st.number_input("8. Loaded Weight (MT)*", min_value=0.0, max_value=65.0, step=0.05, value=float(v_class_mt), key=f"wmt_{cnt}_{sel_veh_label}")
    with r2_c4:
        gross_freight = round(weighbridge_mt * agreed_rate_mt, 2)
        st.metric("Auto Freight Revenue", f"₹{gross_freight:,.2f}")

    st.markdown('<div class="section-header">Allowances, Fuel & Odometer Tracking</div>', unsafe_allow_html=True)
    r3_c1, r3_c2, r3_c3, r3_c4, r3_c5, r3_c6 = st.columns(6)
    with r3_c1: driver_bata = st.number_input("9. Driver Bata (₹)*", min_value=0.0, step=100.0, value=lookup_driver_bata_slab(origin_terminal, dest_terminal, cargo_category, v_class_mt) if dest_terminal else 0.0, key=f"bata_{cnt}")
    with r3_c2: cash_advance = st.number_input("10. Cash Advance (₹)", min_value=0.0, step=500.0, key=f"adv_{cnt}")
    with r3_c5: start_km = st.number_input("Start Odometer KM", min_value=0.0, step=10.0, value=get_latest_odometer_for_truck(active_veh['vehicle_id']) if active_veh else 0.0, key=f"skm_{cnt}_{sel_veh_label}")
    with r3_c6:
        end_km = st.number_input("Expected End KM", min_value=0.0, step=10.0, key=f"ekm_{cnt}")
        computed_km = max(0.0, end_km - start_km) if (end_km >= start_km and end_km > 0) else standard_route_km
    with r3_c3:
        fuel_qty = st.number_input("11. Diesel (Litres)*", min_value=0.0, step=10.0, key=f"fqty_{cnt}")
        is_tank_full = st.checkbox("⛽ Mark as Tank Full", key=f"tf_{cnt}")
    with r3_c4:
        gross_fuel_cost = round(fuel_qty * d_rate_fast, 2)
        st.metric("Auto Fuel Exp & Est. KMPL", f"₹{gross_fuel_cost:,.2f} | {(computed_km / fuel_qty) if fuel_qty > 0 else 0.0:.2f} km/l")

    st.write("")
    if st.button("🚀 Save & Dispatch Trip Record", type="primary"):
        if sel_veh_label == "-- SELECT TRUCK --" or chosen_source_opt == "-- SELECT SOURCE --" or sel_dest_label == "-- SELECT DESTINATION --" or chosen_driver_str == "-- SELECT DRIVER --":
            show_error_toast("Please select Truck, Source, Destination, and Driver.")
        elif open_trip_check: show_error_toast(f"Truck has active trip {open_trip_check['trip_number']}.")
        elif not lr_no or not dest_terminal or not origin_terminal: show_error_toast("LR Number, Source, and Destination are required.")
        elif lr_check_res and lr_check_res['trip_status'] == 'COMPLETED': show_error_toast(f"LR '{lr_no}' already closed.")
        else:
            def execute_dispatch():
                try:
                    new_t = run_query("""
                        INSERT INTO trips (trip_number, branch_id, vehicle_id, primary_driver_id, trip_start_date, trip_end_date, origin, destination, start_km, end_km, total_km_run, tonnage_loaded, loaded_weight_mt, unloaded_weight_mt, freight_revenue, fuel_litres, fuel_expense, driver_bata, cash_advance_issued, trip_status, is_tank_full) 
                        VALUES (%s, 1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'IN_TRANSIT', %s) RETURNING trip_id;
                    """, (lr_no, active_veh['vehicle_id'], sel_driver_obj['driver_id'], start_date, start_date, origin_terminal, dest_terminal, start_km, end_km, computed_km, weighbridge_mt, weighbridge_mt, weighbridge_mt, gross_freight, fuel_qty, gross_fuel_cost, driver_bata, cash_advance, is_tank_full))
                    if fuel_qty > 0 and new_t: run_query("INSERT INTO diesel_fuel_logs (fuel_date, vehicle_id, trip_id, lr_number, diesel_category, litres_filled, diesel_rate_per_litre, total_fuel_cost, filling_odometer_km, is_tank_full) VALUES (%s, %s, %s, %s, 'TRIP_DIESEL', %s, %s, %s, %s, %s);", (start_date, active_veh['vehicle_id'], new_t[0]['trip_id'], lr_no, fuel_qty, d_rate_fast, gross_fuel_cost, start_km, is_tank_full), fetch=False)
                    run_query("UPDATE vehicles SET current_status = 'IN_TRANSIT', status_remarks = %s WHERE vehicle_id = %s", (f"Trip {lr_no}: {origin_terminal} ➔ {dest_terminal}", active_veh['vehicle_id']), fetch=False)
                    get_cached_vehicles.clear(); st.session_state.form_reset_counter += 1
                    trigger_toast_and_rerun("SUCCESS", f"Trip {lr_no} dispatched.")
                except Exception as e: show_error_toast(f"Database Error: {e}")
            confirm_action_dialog(f"dispatch trip {lr_no} assigned to truck {active_veh['vehicle_number']}", execute_dispatch)

# ==============================================================================
# MODULE: 2. POD RECEIVE & TRIP CLOSURE
# ==============================================================================
elif menu == "POD Receive & Close":
    c_pod1, c_pod2 = st.columns([6, 4])
    with c_pod1:
        st.markdown('<div class="section-header">Record Closing Reference & Release Vehicle</div>', unsafe_allow_html=True)
        active_trips = run_query("SELECT t.trip_id, t.trip_number, v.vehicle_number, v.vehicle_id, d.full_name AS driver_name, t.origin, t.destination, t.trip_start_date, t.start_km, t.end_km, t.total_km_run, t.loaded_weight_mt, t.freight_revenue, t.fuel_litres FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id WHERE t.trip_status != 'COMPLETED' ORDER BY t.trip_id DESC;")
        if not active_trips: st.info("No active trips awaiting POD reference closure.")
        else:
            trip_opts = {f"LR: {t['trip_number']} | Truck: {t['vehicle_number']} | {t['origin']} ➔ {t['destination']} | Driver: {t['driver_name']}": t for t in active_trips}
            chosen_lr_label = st.selectbox("Select Active Trip", ["-- SELECT ACTIVE TRIP --"] + list(trip_opts.keys()), index=0)
            if chosen_lr_label != "-- SELECT ACTIVE TRIP --":
                t_cur = trip_opts[chosen_lr_label]
                with st.form("pod_closure_form"):
                    p1, p2, p3, p4 = st.columns([1.5, 1.5, 1.5, 1.5])
                    with p1:
                        pod_no = st.text_input("POD / Challan No*", placeholder="POD-XXXX").strip().upper()
                        close_d = st.date_input("Closing Date*", date.today())
                    with p2:
                        unloaded_wt = st.number_input("Customer Unloaded MT", min_value=0.0, max_value=60.0, value=float(t_cur['loaded_weight_mt'] or 0.0), step=0.01)
                        shortage = max(0.0, float(t_cur['loaded_weight_mt']) - unloaded_wt)
                    with p3:
                        pod_start_km = st.number_input("Start Odometer KM*", min_value=0.0, value=float(t_cur['start_km'] or 0.0), step=10.0)
                        final_km = st.number_input("Closing Odometer KM*", min_value=pod_start_km, value=float(t_cur['end_km'] or (pod_start_km + float(t_cur['total_km_run'] or 0.0))), step=10.0)
                        tot_km = max(0.0, final_km - pod_start_km)
                    with p4:
                        halt_bata = st.number_input("Halt Bata (₹)", min_value=0.0, step=100.0)
                        claims = st.number_input("En-route Claims (₹)", min_value=0.0, step=50.0)

                    st.markdown('<div class="section-header">Trip Diesel / Closing Top-up</div>', unsafe_allow_html=True)
                    pod_f1, pod_f2, pod_f3 = st.columns(3)
                    with pod_f1:
                        already_has_fuel = float(t_cur['fuel_litres'] or 0.0) > 0
                        pod_fuel = st.number_input("Closing Diesel Top-up (L)" if already_has_fuel else "Enter Trip Diesel (L)*", min_value=0.0, step=5.0)
                        pod_tf = st.checkbox("⛽ Mark as Tank Full at Close")
                    with pod_f2:
                        tot_trip_fuel = float(t_cur['fuel_litres'] or 0.0) + pod_fuel
                        st.metric("Final Trip KMPL", f"{(tot_km / tot_trip_fuel) if tot_trip_fuel > 0 else 0.0:.2f} km/l")

                    st.write("")
                    if st.form_submit_button("✅ Settle POD Reference & Release Truck", type="primary"):
                        if not pod_no: show_error_toast("POD Number is required.")
                        else:
                            def execute_close_trip():
                                try:
                                    extra_fuel_cost = round(pod_fuel * get_cached_diesel_rate(), 2)
                                    run_query("""
                                        UPDATE trips SET pod_number = %s, pod_received_date = %s, trip_end_date = %s, start_km = %s, end_km = %s, total_km_run = CASE WHEN %s > 0 THEN %s ELSE total_km_run END, unloaded_weight_mt = %s, shortage_mt = %s, halt_bata = %s, driver_bata = driver_bata + %s, enroute_repairs_maintenance = enroute_repairs_maintenance + %s, fuel_litres = fuel_litres + %s, fuel_expense = fuel_expense + %s, is_tank_full = CASE WHEN %s = TRUE THEN TRUE ELSE is_tank_full END, trip_status = 'COMPLETED', trip_closed_at = CURRENT_TIMESTAMP WHERE trip_id = %s;
                                    """, (pod_no, close_d, close_d, pod_start_km, final_km, tot_km, tot_km, unloaded_wt, shortage, halt_bata, halt_bata, claims, pod_fuel, extra_fuel_cost, pod_tf, t_cur['trip_id']), fetch=False)
                                    if pod_fuel > 0: run_query("INSERT INTO diesel_fuel_logs (fuel_date, vehicle_id, trip_id, lr_number, diesel_category, litres_filled, diesel_rate_per_litre, total_fuel_cost, filling_odometer_km, is_tank_full) VALUES (%s, %s, %s, %s, 'TRIP_DIESEL', %s, %s, %s, %s, %s);", (close_d, t_cur['vehicle_id'], t_cur['trip_id'], t_cur['trip_number'], pod_fuel, get_cached_diesel_rate(), extra_fuel_cost, final_km, pod_tf), fetch=False)
                                    run_query("UPDATE vehicles SET current_status = 'AVAILABLE_FOR_LOAD', status_remarks = %s WHERE vehicle_id = %s", (f"Completed LR {t_cur['trip_number']} (POD: {pod_no})", t_cur['vehicle_id']), fetch=False)
                                    get_cached_vehicles.clear(); trigger_toast_and_rerun("SUCCESS", f"Trip {t_cur['trip_number']} closed.")
                                except Exception as e: show_error_toast(f"Error closing trip: {e}")
                            confirm_action_dialog(f"close LR {t_cur['trip_number']} and record POD {pod_no}", execute_close_trip)

    with c_pod2:
        st.markdown('<div class="section-header">📞 Driver Follow-up Desk (Pending)</div>', unsafe_allow_html=True)
        pending_trips = run_query("SELECT t.trip_id, t.trip_number AS lr_no, v.vehicle_number, d.phone_number AS driver_phone, t.destination, CURRENT_DATE - t.trip_start_date::date AS days_pending FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id WHERE t.trip_status != 'COMPLETED' ORDER BY t.trip_start_date ASC;")
        if pending_trips:
            df_pending = pd.DataFrame(pending_trips)
            sel_f_trk = st.selectbox("Filter by Truck", ["All Trucks"] + sorted(df_pending['vehicle_number'].unique().tolist()), key="pod_trk_filter")
            if sel_f_trk != "All Trucks": df_pending = df_pending[df_pending['vehicle_number'] == sel_f_trk]
            st.dataframe(df_pending[['vehicle_number', 'lr_no', 'driver_phone', 'days_pending', 'destination']], hide_index=True, use_container_width=True, height=450)
        else: st.success("All dispatched trips have their PODs received and closed.")

# ==============================================================================
# MODULE: 3. FLEET STATUS BOARD
# ==============================================================================
elif menu == "Fleet Status Board":
    vehicles = get_cached_vehicles()
    if vehicles:
        df_v = pd.DataFrame(vehicles)
        df_v['status_lbl'] = df_v['current_status'].map(lambda x: STATUS_OPTIONS.get(x, x))
        c1, c2, c3, c4, c5, c6 = st.columns(6)
        c1.metric("🟢 Ready / Available", len(df_v[df_v['current_status'] == 'AVAILABLE_FOR_LOAD']))
        c2.metric("🟡 Plant Loading", len(df_v[df_v['current_status'] == 'WAITING_FOR_LOAD']))
        c3.metric("🚚 In Transit", len(df_v[df_v['current_status'] == 'IN_TRANSIT']))
        c4.metric("⏳ Site Unloading", len(df_v[df_v['current_status'] == 'WAITING_FOR_UNLOAD']))
        c5.metric("🛠️ In Workshop", len(df_v[df_v['current_status'] == 'WORKSHOP_MAINTENANCE']))
        c6.metric("🚫 Driver Leave", len(df_v[df_v['current_status'] == 'DRIVER_UNAVAILABLE']))

        st.markdown('<div class="section-header">Active Fleet Overview & Quick Status Update</div>', unsafe_allow_html=True)
        v_col1, v_col2 = st.columns([3.2, 1.8])
        with v_col1: st.dataframe(df_v[['vehicle_number', 'truck_type', 'carrying_capacity_tons', 'status_lbl', 'status_remarks']], hide_index=True, use_container_width=True, height=450)
        with v_col2:
            if st.session_state.user_role == "MASTER":
                with st.form("quick_stat_form"):
                    v_map = {f"{v['vehicle_number']} ({v['truck_type']})": v for v in vehicles}
                    target_v = v_map[st.selectbox("Select Truck to Update", list(v_map.keys()))]
                    new_st = st.selectbox("New Operational Status", list(STATUS_OPTIONS.keys()), format_func=lambda x: STATUS_OPTIONS[x])
                    new_rem = st.text_input("Current Location / Breakdown Details", value=target_v['status_remarks'] or "")
                    st.write("")
                    if st.form_submit_button("Update Status", type="primary", use_container_width=True):
                        def execute_status_update():
                            run_query("UPDATE vehicles SET current_status = %s, status_remarks = %s, status_updated_at = CURRENT_TIMESTAMP WHERE vehicle_id = %s", (new_st, new_rem, target_v['vehicle_id']), fetch=False)
                            get_cached_vehicles.clear(); trigger_toast_and_rerun("SUCCESS", f"Status for {target_v['vehicle_number']} updated.")
                        confirm_action_dialog(f"update status of {target_v['vehicle_number']} to '{STATUS_OPTIONS[new_st]}'", execute_status_update)
            else: st.info("ℹ️ Status modifications are restricted to Master accounts.")

# ==============================================================================
# MODULE: 4. DIESEL LOGS
# ==============================================================================
elif menu == "Diesel Logs":
    hd1, hd2 = st.columns([7.5, 2.5])
    with hd1: st.markdown('<div class="section-header">Diesel Fuel Management & Audit Logs</div>', unsafe_allow_html=True)
    with hd2:
        current_d_rate = get_cached_diesel_rate()
        d_rate_fast = st.number_input("⛽ Active Diesel Rate (₹/L)*", value=current_d_rate, step=0.1, key="drate_diesellog")
        if d_rate_fast != current_d_rate: set_saved_diesel_rate(d_rate_fast)

    tab_issue, tab_edit_fuel, tab_audit_fuel = st.tabs(["⛽ Issue / Record Diesel", "✏️ Edit Existing Diesel Log", "📊 Filterable Fuel Audit Registry"])
    vehicles = get_cached_vehicles()
    v_dict = {f"{v['vehicle_number']} ({v['truck_type']})": v for v in vehicles}
    
    with tab_issue:
        col_d1, col_d2 = st.columns([1.5, 3.5])
        with col_d1:
            with st.form("d_entry_form", clear_on_submit=True):
                st.markdown('<div class="section-header">Issue Diesel / Log Fuel Bill</div>', unsafe_allow_html=True)
                f_date = st.date_input("Fuel Date*", date.today())
                f_veh = st.selectbox("Select Truck*", list(v_dict.keys()))
                target_veh_id = v_dict[f_veh]['vehicle_id']
                f_cat = st.selectbox("Diesel Category*", ["TRIP_DIESEL", "SUNDRY_DIESEL"])
                f_lr = st.text_input("Trip LR No (Optional)", placeholder="LR-XXXX").strip().upper()
                
                auto_km = get_latest_odometer_for_truck(target_veh_id)
                if f_lr:
                    lr_check = check_lr_exists(f_lr)
                    if lr_check and lr_check.get('start_km'): auto_km = float(lr_check['start_km']); st.caption(f"ℹ️ Defaulting to Trip Start KM: **{auto_km}**")
                
                filling_km = st.number_input("Filling Odometer (KM)*", min_value=0.0, step=10.0, value=auto_km)
                f_l = st.number_input("Litres Filled*", min_value=0.0, step=10.0)
                is_tank_full = st.checkbox("⛽ Mark as Tank Full", value=False)
                f_cost = round(f_l * d_rate_fast, 2)
                st.metric("Total Fuel Cost", f"₹{f_cost:,.2f}")
                st.write("")
                if st.form_submit_button("Record Diesel Entry", type="primary"):
                    if f_l <= 0: show_error_toast("Fuel quantity must be greater than zero.")
                    elif check_duplicate_diesel_entry(target_veh_id, f_date, f_l, filling_km, f_lr): show_error_toast("Duplicate fuel log exists.")
                    else:
                        def execute_fuel_record():
                            run_query("INSERT INTO diesel_fuel_logs (fuel_date, vehicle_id, lr_number, diesel_category, litres_filled, diesel_rate_per_litre, total_fuel_cost, filling_odometer_km, is_tank_full) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)", (f_date, target_veh_id, f_lr or "SUNDRY", f_cat, f_l, d_rate_fast, f_cost, filling_km, is_tank_full), fetch=False)
                            trigger_toast_and_rerun("SUCCESS", f"Recorded {f_l}L fuel for {f_veh}.")
                        confirm_action_dialog(f"record {f_l}L diesel to {v_dict[f_veh]['vehicle_number']}", execute_fuel_record)
        with col_d2:
            st.markdown('<div class="section-header">Recent Fuel Entries (Last 50)</div>', unsafe_allow_html=True)
            d_recent = run_query("SELECT f.fuel_log_id, f.fuel_date, v.vehicle_number, f.diesel_category, f.lr_number, f.filling_odometer_km, f.litres_filled, f.total_fuel_cost, f.is_tank_full FROM diesel_fuel_logs f JOIN vehicles v ON f.vehicle_id = v.vehicle_id ORDER BY f.fuel_date DESC, f.fuel_log_id DESC LIMIT 50;")
            if d_recent: st.dataframe(pd.DataFrame(d_recent), hide_index=True, use_container_width=True, height=450)

    with tab_edit_fuel:
        st.markdown('<div class="section-header">Search & Edit Specific Diesel Log</div>', unsafe_allow_html=True)
        all_fuel_entries = run_query("SELECT f.fuel_log_id, f.fuel_date, f.vehicle_id, v.vehicle_number, f.diesel_category, f.lr_number, f.filling_odometer_km, f.litres_filled, f.diesel_rate_per_litre, f.total_fuel_cost, f.trip_id, f.is_tank_full FROM diesel_fuel_logs f JOIN vehicles v ON f.vehicle_id = v.vehicle_id ORDER BY f.fuel_date DESC, f.fuel_log_id DESC;")
        if not all_fuel_entries: st.info("No diesel logs found.")
        else:
            fuel_map = {f"Log #{f['fuel_log_id']} | {f['fuel_date']} | {f['vehicle_number']} | {f['litres_filled']} L | LR: {f['lr_number']}": f for f in all_fuel_entries}
            chosen_fuel_label = st.selectbox("Select Diesel Record to Edit", ["-- SELECT LOG --"] + list(fuel_map.keys()), index=0)
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
                    with ed5: e_filling_km = st.number_input("Filling Odometer (KM)*", min_value=0.0, value=float(target_fuel['filling_odometer_km'] or 0.0), step=10.0)

                    ed6, ed7, ed8 = st.columns(3)
                    with ed6:
                        e_litres = st.number_input("Litres Filled*", min_value=0.0, value=float(target_fuel['litres_filled'] or 0.0), step=5.0)
                        e_tank_full = st.checkbox("⛽ Mark as Tank Full", value=bool(target_fuel.get('is_tank_full', False)))
                    with ed7: e_rate = st.number_input("Rate (₹/L)*", min_value=50.0, max_value=150.0, value=float(target_fuel['diesel_rate_per_litre'] or d_rate_fast), step=0.05)
                    with ed8: e_cost = round(e_litres * e_rate, 2); st.metric("Recalculated Cost", f"₹{e_cost:,.2f}")

                    st.write("")
                    if st.form_submit_button("💾 Commit Updates", type="primary"):
                        if e_litres <= 0: show_error_toast("Fuel quantity > 0 required.")
                        elif check_duplicate_diesel_entry(e_target_veh_id, e_fuel_date, e_litres, e_filling_km, e_lr_val, target_fuel['fuel_log_id']): show_error_toast("Duplicate log exists.")
                        else:
                            def execute_fuel_edit():
                                run_query("UPDATE diesel_fuel_logs SET fuel_date=%s, vehicle_id=%s, diesel_category=%s, lr_number=%s, filling_odometer_km=%s, litres_filled=%s, diesel_rate_per_litre=%s, total_fuel_cost=%s, is_tank_full=%s WHERE fuel_log_id=%s;", (e_fuel_date, e_target_veh_id, e_cat, e_lr_val or "SUNDRY", e_filling_km, e_litres, e_rate, e_cost, e_tank_full, target_fuel['fuel_log_id']), fetch=False)
                                if target_fuel['trip_id']: run_query("UPDATE trips SET fuel_litres=%s, fuel_expense=%s, start_km=CASE WHEN start_km=0 THEN %s ELSE start_km END WHERE trip_id=%s;", (e_litres, e_cost, e_filling_km, target_fuel['trip_id']), fetch=False)
                                trigger_toast_and_rerun("SUCCESS", f"Fuel Log #{target_fuel['fuel_log_id']} updated.")
                            confirm_action_dialog(f"modify Fuel Log #{target_fuel['fuel_log_id']}", execute_fuel_edit)

    with tab_audit_fuel:
        st.markdown('<div class="section-header">Multi-Parameter Diesel Log Filter</div>', unsafe_allow_html=True)
        df_col1, df_col2, df_col3, df_col4 = st.columns([2.0, 2.0, 2.0, 2.0])
        with df_col1: fuel_filter_mode = st.selectbox("Date Selection Mode", ["All Time", "Specific Single Date", "Custom Date Range"])
        with df_col2: sel_fl_trk = st.selectbox("Filter Truck No", ["All Trucks"] + sorted([v['vehicle_number'] for v in vehicles]))
        with df_col3: sel_fl_cat = st.selectbox("Filter Category", ["All Categories", "TRIP_DIESEL", "SUNDRY_DIESEL"])
        with df_col4: search_fl_lr = st.text_input("Search LR No", placeholder="e.g. LR-102").strip().upper()

        date_q_cond, fl_params = "", []
        if fuel_filter_mode == "Specific Single Date":
            c_d1, _ = st.columns([2, 2])
            with c_d1: single_fl_d = st.date_input("Select Date", date.today()); date_q_cond = " AND f.fuel_date::date = %s"; fl_params.append(single_fl_d)
        elif fuel_filter_mode == "Custom Date Range":
            c_d1, c_d2 = st.columns(2)
            with c_d1: from_fl_d = st.date_input("From Date", date.today().replace(day=1))
            with c_d2: to_fl_d = st.date_input("To Date", date.today()); date_q_cond = " AND f.fuel_date::date >= %s AND f.fuel_date::date <= %s"; fl_params.extend([from_fl_d, to_fl_d])

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
            with del_c1: del_fuel_id = st.selectbox("Select Fuel Entry ID to Remove", df_d_logs['fuel_log_id'].tolist(), format_func=lambda x: f"Fuel Log #{x}")
            with del_c3:
                st.write(""); 
                if st.button("🗑️ Delete Fuel Log", type="secondary", use_container_width=True):
                    confirm_action_dialog(f"delete Fuel Log #{del_fuel_id}", lambda: (run_query("DELETE FROM diesel_fuel_logs WHERE fuel_log_id = %s", (del_fuel_id,), fetch=False), trigger_toast_and_rerun("SUCCESS", f"Fuel log #{del_fuel_id} deleted.")))
        else: st.info("No diesel logs match the selected parameters.")

# ==============================================================================
# MODULE: 6. MODIFY TRIPS & CLAIMS
# ==============================================================================
elif menu == "Modify Trips & Claims":
    drivers = get_cached_drivers()
    driver_dict = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers}
    driver_keys_list = ["-- SELECT DRIVER --"] + list(driver_dict.keys())
    
    hm1, hm2 = st.columns([7.5, 2.5])
    with hm1: st.markdown('<div class="section-header">Search, Edit Odometer KM, Route Slabs & POD Details</div>', unsafe_allow_html=True)
    with hm2:
        current_d_rate = get_cached_diesel_rate()
        d_rate_fast = st.number_input("⛽ Active Diesel Rate (₹/L)*", value=current_d_rate, step=0.1)
        if d_rate_fast != current_d_rate: set_saved_diesel_rate(d_rate_fast)
    
    f_c1, f_c2 = st.columns([2, 2])
    with f_c1: search_query = st.text_input("🔍 Quick Search by LR Number or Truck", placeholder="e.g. KL43J6682").strip().upper()
    with f_c2: status_filter = st.selectbox("Filter by Trip Status", ["All Statuses", "IN_TRANSIT", "COMPLETED"])

    trip_sql = """SELECT t.*, v.vehicle_number, v.carrying_capacity_tons, d.full_name FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id WHERE 1=1"""
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
                    sel_route_choice = st.selectbox("Select Route from Master Slabs (Auto-fills Rate & KM)", route_labels, index=def_route_idx)
                
                if sel_route_choice != "-- MANUAL / SPOT ROUTE --":
                    active_slab = route_map_dict[sel_route_choice]
                    e_orig, e_dest, auto_rate_mt, auto_km = active_slab['origin'], active_slab['destination_name'], float(active_slab['freight_rate_per_ton']), float(active_slab['standard_km'])
                else:
                    c_spot1, c_spot2 = st.columns(2)
                    with c_spot1:
                        e_orig = st.text_input("Origin Hub", value=t_data['origin']).strip().upper()
                        e_dest = st.text_input("Destination Terminal", value=t_data['destination']).strip().upper()
                    with c_spot2:
                        auto_rate_mt = st.number_input("Spot Freight Rate/MT*", min_value=0.0, step=25.0, value=0.0)
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

                            get_cached_vehicles.clear(); trigger_toast_and_rerun("SUCCESS", f"Trip #{e_lr} updated.")
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

# ==============================================================================
# MODULE: 7. DRIVER SETTLEMENT REPORT
# ==============================================================================
elif menu == "Driver Settlement":
    drivers = get_cached_drivers()
    if drivers:
        d_dict = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers}
        
        s1, s2, s3 = st.columns([2.5, 1.5, 1.5])
        with s1:
            sel_d_name = st.selectbox("Select Driver Name*", list(d_dict.keys()))
            selected_driver = d_dict[sel_d_name]
            d_id = selected_driver['driver_id']
        with s2:
            s_from = st.date_input("From Date*", date.today().replace(day=1), min_value=date(2020, 1, 1), max_value=date(2035, 12, 31))
        with s3:
            s_to = st.date_input("To Date*", date.today(), min_value=date(2020, 1, 1), max_value=date(2035, 12, 31))

        trips_drv = run_query("""
            SELECT 
                t.trip_start_date,
                t.trip_number AS lr_no,
                v.vehicle_number,
                t.origin AS source,
                t.destination,
                COALESCE(t.fuel_litres, 0.0) AS diesel_litres,
                COALESCE(t.driver_bata, 0.0) + COALESCE(t.halt_bata, 0.0) AS total_bata,
                COALESCE(t.cash_advance_issued, 0.0) AS advance_issued,
                ((COALESCE(t.driver_bata, 0.0) + COALESCE(t.halt_bata, 0.0)) - COALESCE(t.cash_advance_issued, 0.0)) AS balance_amount
            FROM trips t
            JOIN vehicles v ON t.vehicle_id = v.vehicle_id
            WHERE t.primary_driver_id = %s 
              AND t.trip_start_date::date >= %s 
              AND t.trip_start_date::date <= %s
            ORDER BY v.vehicle_number ASC, t.trip_start_date ASC;
        """, (d_id, s_from, s_to))

        adv_drv = run_query("""
            SELECT advance_date, amount_inr, advance_type, reference_remarks 
            FROM driver_direct_advances 
            WHERE driver_id = %s 
              AND advance_date::date >= %s 
              AND advance_date::date <= %s
            ORDER BY advance_date ASC;
        """, (d_id, s_from, s_to))

        st.markdown(f'<div class="section-header">Settlement Statement for {selected_driver["full_name"]} ({s_from} to {s_to})</div>', unsafe_allow_html=True)

        grand_total_bata = 0.0
        grand_total_adv = 0.0
        grand_total_diesel = 0.0

        if trips_drv:
            df_all_trips = pd.DataFrame(trips_drv)
            truck_groups = df_all_trips['vehicle_number'].unique()
            
            for trk in truck_groups:
                st.markdown(f"#### 🚚 Truck: **{trk}**")
                df_trk = df_all_trips[df_all_trips['vehicle_number'] == trk].copy()
                df_trk_view = df_trk[['trip_start_date', 'lr_no', 'source', 'destination', 'diesel_litres', 'total_bata', 'advance_issued', 'balance_amount']].copy()
                
                sub_bata = float(df_trk['total_bata'].sum() or 0.0)
                sub_adv = float(df_trk['advance_issued'].sum() or 0.0)
                sub_diesel = float(df_trk['diesel_litres'].sum() or 0.0)
                sub_bal = float(df_trk['balance_amount'].sum() or 0.0)

                grand_total_bata += sub_bata
                grand_total_adv += sub_adv
                grand_total_diesel += sub_diesel

                st.dataframe(
                    df_trk_view,
                    column_config={
                        "trip_start_date": "Date",
                        "lr_no": "LR No",
                        "source": "Source",
                        "destination": "Destination",
                        "diesel_litres": "Diesel (L)",
                        "total_bata": "Bata (₹)",
                        "advance_issued": "Advance (₹)",
                        "balance_amount": "Balance (₹)"
                    },
                    hide_index=True,
                    use_container_width=True
                )
                
                sb1, sb2, sb3, sb4 = st.columns(4)
                sb1.caption(f"**Truck {trk} Diesel:** {sub_diesel:,.1f} L")
                sb2.caption(f"**Truck {trk} Bata:** ₹{sub_bata:,.2f}")
                sb3.caption(f"**Truck {trk} Advance:** ₹{sub_adv:,.2f}")
                sb4.caption(f"**Truck {trk} Subtotal Balance:** ₹{sub_bal:,.2f}")
                st.markdown("<hr style='margin: 6px 0 12px 0;' />", unsafe_allow_html=True)
        else:
            df_all_trips = pd.DataFrame()
            st.info("No trips logged for this driver in the selected period.")

        direct_adv_sum = 0.0
        if adv_drv:
            st.markdown("#### 💵 Direct Cash & Salary Advances (Outside Trips)")
            df_direct_adv = pd.DataFrame(adv_drv)
            direct_adv_sum = float(df_direct_adv['amount_inr'].sum() or 0.0)
            grand_total_adv += direct_adv_sum
            
            st.dataframe(
                df_direct_adv,
                column_config={
                    "advance_date": "Date",
                    "amount_inr": "Advance Amount (₹)",
                    "advance_type": "Category",
                    "reference_remarks": "Remarks"
                },
                hide_index=True,
                use_container_width=True
            )
        else:
            df_direct_adv = pd.DataFrame()

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
            if not HAS_FPDF:
                st.error("⚠️ Install `fpdf` via terminal (`pip install fpdf`) to enable PDF downloads.")
            else:
                totals_dict = {
                    'diesel': grand_total_diesel,
                    'bata': grand_total_bata,
                    'adv': grand_total_adv,
                    'bal': final_balance_payable
                }
                pdf_data = generate_settlement_pdf(selected_driver['full_name'], s_from, s_to, df_all_trips, df_direct_adv, totals_dict)
                st.download_button(
                    label="📄 Download PDF Statement",
                    data=pdf_data,
                    file_name=f"Settlement_{selected_driver['driver_code']}_{s_from}.pdf",
                    mime="application/pdf",
                    type="secondary",
                    use_container_width=True
                )
                
        with act_col3:
            if st.session_state.user_role == "MASTER":
                if st.button("Mark Period Settled", type="primary", use_container_width=True):
                    def execute_settle_period():
                        try:
                            run_query("UPDATE trips SET settlement_status='SETTLED' WHERE primary_driver_id=%s AND trip_start_date::date>=%s AND trip_start_date::date<=%s", (d_id, s_from, s_to), fetch=False)
                            run_query("UPDATE driver_direct_advances SET is_settled=TRUE WHERE driver_id=%s AND advance_date::date>=%s AND advance_date::date<=%s", (d_id, s_from, s_to), fetch=False)
                            trigger_toast_and_rerun("SUCCESS", f"Settlement reconciled for {selected_driver['full_name']}.")
                        except Exception as e:
                            show_error_toast(f"Settlement failed: {e}")
                            
                    confirm_action_dialog(f"mark all records for {selected_driver['full_name']} from {s_from} to {s_to} as SETTLED", execute_settle_period)

# ==============================================================================
# MODULE: 8. MASTER CONFIGURATION
# ==============================================================================
elif menu == "Master Configuration":
    t_v, t_d, t_r, t_b = st.tabs(["Trucks Master", "Drivers Master", "Freight Slabs Master", "Driver Bata Master"])
    
    with t_v:
        c1, c2 = st.columns([1.5, 3.5])
        with c1:
            with st.form("quick_truck"):
                st.markdown('<div class="section-header">Add New Truck</div>', unsafe_allow_html=True)
                nv = st.text_input("Truck Registration No*", placeholder="KL43Q3608").upper().strip()
                vt = st.selectbox("Truck Variant", ["Bulker (16-Wheel)", "Bulker (14-Wheel)", "Bulker", "Body Truck"])
                vc = st.selectbox("Capacity Class (MT)", [25.0, 30.0, 35.0], index=2)
                odo_working = st.checkbox("✅ Odometer is Working Correctly", value=True)
                st.write("")
                if st.form_submit_button("Save Truck Master", type="primary", use_container_width=True):
                    if not nv: show_error_toast("Truck registration number is mandatory.")
                    else:
                        def execute_save_truck():
                            run_query("INSERT INTO vehicles (vehicle_number, truck_type, carrying_capacity_tons, current_status, odometer_working) VALUES (%s, %s, %s, 'AVAILABLE_FOR_LOAD', %s)", (nv, vt, vc, odo_working), fetch=False)
                            get_cached_vehicles.clear(); trigger_toast_and_rerun("SUCCESS", f"Truck {nv} added to registry.")
                        confirm_action_dialog(f"register new truck {nv}", execute_save_truck)
        with c2:
            st.markdown('<div class="section-header">Registered Fleet Registry</div>', unsafe_allow_html=True)
            v_recs = get_cached_vehicles()
            if v_recs: st.dataframe(pd.DataFrame(v_recs)[['vehicle_number', 'truck_type', 'carrying_capacity_tons', 'current_status']], hide_index=True, use_container_width=True, height=450)

    with t_d:
        c1, c2 = st.columns([1.5, 3.5])
        with c1:
            with st.form("quick_driver"):
                st.markdown('<div class="section-header">Add New Driver</div>', unsafe_allow_html=True)
                nd_c = st.text_input("Driver Code*", value=f"DRV-{len(get_cached_drivers(True))+1:03d}").strip().upper()
                nd_n = st.text_input("Full Name*").strip()
                nd_p = st.text_input("Phone Number*").strip()
                nd_l = st.text_input("License No*").strip().upper()
                nd_exp = st.date_input("License Expiry Date", date(2030, 1, 1))
                st.write("")
                if st.form_submit_button("Save Driver Master", type="primary", use_container_width=True):
                    if not nd_n or not nd_p: show_error_toast("Driver Name and Phone Number are mandatory.")
                    else:
                        def execute_save_driver():
                            final_code = nd_c
                            if run_query("SELECT driver_id FROM drivers WHERE LOWER(driver_code) = LOWER(%s)", (final_code,)):
                                max_drv = run_query("SELECT driver_id FROM drivers ORDER BY driver_id DESC LIMIT 1")
                                final_code = f"DRV-{(max_drv[0]['driver_id'] + 1) if max_drv else 1:03d}"
                            run_query("INSERT INTO drivers (driver_code, full_name, phone_number, license_number, license_expiry_date, branch_id) VALUES (%s, %s, %s, %s, %s, 1) ON CONFLICT (driver_code) DO UPDATE SET full_name = EXCLUDED.full_name, phone_number = EXCLUDED.phone_number, license_number = EXCLUDED.license_number, license_expiry_date = EXCLUDED.license_expiry_date, is_active = TRUE;", (final_code, nd_n, nd_p, nd_l, nd_exp), fetch=False)
                            get_cached_drivers.clear(); trigger_toast_and_rerun("SUCCESS", f"Driver '{nd_n}' saved as {final_code}.")
                        confirm_action_dialog(f"register driver {nd_n}", execute_save_driver)
        with c2:
            st.markdown('<div class="section-header">Active Driver Directory</div>', unsafe_allow_html=True)
            d_recs = get_cached_drivers(True)
            if d_recs: st.dataframe(pd.DataFrame(d_recs)[['driver_code', 'full_name', 'phone_number', 'license_number']], hide_index=True, use_container_width=True, height=450)

    with t_r:
        c1, c2 = st.columns([1.5, 3.5])
        with c1:
            with st.form("quick_slab"):
                st.markdown('<div class="section-header">Add Freight Slab</div>', unsafe_allow_html=True)
                cg = st.selectbox("Cargo Category", ["BULK", "BAG"])
                so = st.selectbox("Origin Source", STANDARD_SOURCES)
                dt = st.text_input("Destination Terminal*").strip().upper()
                cl = st.selectbox("Truck Class (MT)", [25.0, 30.0, 35.0], index=2)
                rt = st.number_input("Rate per MT (₹)*", min_value=0.0, step=25.0)
                km = st.number_input("Standard KM", min_value=0.0, step=10.0)
                st.write("")
                if st.form_submit_button("Save Freight Slab", type="primary", use_container_width=True):
                    if not dt or rt <= 0: show_error_toast("Destination and freight rate are required.")
                    else:
                        def execute_save_route():
                            for c_val in ([25.0, 30.0] if cg == "BAG" else [cl]):
                                run_query("INSERT INTO destinations_freight_master (cargo_type, origin, destination_name, capacity_tons, freight_rate_per_ton, standard_km) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (cargo_type, origin, destination_name, capacity_tons) DO UPDATE SET freight_rate_per_ton = EXCLUDED.freight_rate_per_ton, standard_km = EXCLUDED.standard_km;", (cg, so, dt, c_val, rt, km), fetch=False)
                            get_cached_routes.clear(); trigger_toast_and_rerun("SUCCESS", f"Freight slab {so} ➔ {dt} saved.")
                        confirm_action_dialog(f"save freight slab {so} ➔ {dt}", execute_save_route)
        with c2:
            st.markdown('<div class="section-header">Configured Freight Slabs</div>', unsafe_allow_html=True)
            r_recs = get_cached_routes()
            if r_recs: st.dataframe(pd.DataFrame(r_recs)[['cargo_type', 'origin', 'destination_name', 'capacity_tons', 'freight_rate_per_ton', 'standard_km']], hide_index=True, use_container_width=True, height=450)

    # 4. SLAB-BASED DRIVER BATA MASTER
    with t_b:
        c1, c2 = st.columns([1.5, 3.5])
        with c1:
            with st.form("quick_bata"):
                st.markdown('<div class="section-header">Configure Driver Bata Slab</div>', unsafe_allow_html=True)
                bo = st.selectbox("Origin Source*", STANDARD_SOURCES)
                bd = st.text_input("Destination Terminal*", placeholder="e.g. SANKARI").strip().upper()
                
                selected_slab_label = st.selectbox("Select Truck Slab*", list(BATA_SLAB_DEFINITIONS.keys()))
                slab_meta = BATA_SLAB_DEFINITIONS[selected_slab_label]
                
                ba = st.number_input("Standard Bata (₹)*", min_value=0.0, step=100.0, value=3000.0)
                st.write("")
                if st.form_submit_button("Save Driver Bata Slab", type="primary", use_container_width=True):
                    if not bd: show_error_toast("Destination is required.")
                    elif ba <= 0: show_error_toast("Bata amount must be greater than zero.")
                    else:
                        def execute_save_bata():
                            try:
                                existing = run_query("SELECT bata_rule_id FROM driver_bata_master WHERE origin=%s AND destination_name=%s AND cargo_type=%s AND capacity_tons=%s", (bo, bd, slab_meta["cargo_type"], slab_meta["capacity_tons"]))
                                if existing:
                                    run_query("UPDATE driver_bata_master SET standard_bata_inr=%s WHERE bata_rule_id=%s", (ba, existing[0]['bata_rule_id']), fetch=False)
                                else:
                                    run_query("INSERT INTO driver_bata_master (origin, destination_name, cargo_type, capacity_tons, standard_bata_inr) VALUES (%s, %s, %s, %s, %s)", (bo, bd, slab_meta["cargo_type"], slab_meta["capacity_tons"], ba), fetch=False)
                                
                                get_cached_bata_rules.clear()
                                trigger_toast_and_rerun("SUCCESS", f"Bata for {bo} ➔ {bd} ({selected_slab_label}) saved as ₹{ba:,.2f}.")
                            except Exception as e:
                                show_error_toast(f"Bata rule save failed: {e}")
                        confirm_action_dialog(f"save Bata slab for {bo} ➔ {bd}", execute_save_bata)
        with c2:
            st.markdown('<div class="section-header">Configured Driver Bata Slabs Master</div>', unsafe_allow_html=True)
            bata_list = get_cached_bata_rules()
            if bata_list:
                df_bata = pd.DataFrame(bata_list)
                def format_slab_display(row):
                    cap = int(float(row['capacity_tons']))
                    return f"{cap}MT Body (Bag)" if str(row['cargo_type']).upper() == "BAG" else f"{cap}MT Bulk (Bulker)"
                
                df_bata['bata_slab'] = df_bata.apply(format_slab_display, axis=1)
                cols_to_show = ['origin', 'destination_name', 'bata_slab', 'standard_bata_inr']
                st.dataframe(
                    df_bata[cols_to_show], 
                    column_config={"origin": "Source", "destination_name": "Destination", "bata_slab": "Truck Slab", "standard_bata_inr": "Standard Bata (₹)"},
                    hide_index=True, use_container_width=True, height=450
                )
            else:
                st.info("No Driver Bata rules configured yet.")

# ==============================================================================
# MODULE: 9. EXECUTIVE RETENTION ANALYTICS
# ==============================================================================
elif menu == "Executive Retention Analytics":
    tfc1, tfc2, tfc3 = st.columns(3)
    with tfc1:
        report_period_type = st.selectbox("Analysis Window", ["Lifetime Fleet Analytics", "Current Fiscal Month", "Custom Operating Period"])

    today = date.today()
    if report_period_type == "Current Fiscal Month":
        start_filter_date, end_filter_date = today.replace(day=1), today
    elif report_period_type == "Custom Operating Period":
        with tfc2: start_filter_date = st.date_input("Period From*", today.replace(day=1), min_value=date(2020, 1, 1), max_value=date(2035, 12, 31))
        with tfc3: end_filter_date = st.date_input("Period To*", today, min_value=date(2020, 1, 1), max_value=date(2035, 12, 31))
    else:
        start_filter_date, end_filter_date = None, None

    st.markdown('<div class="section-header">Performance Filter & Sorting Controls</div>', unsafe_allow_html=True)
    sort_c1, sort_c2 = st.columns([2.5, 2.5])
    with sort_c1:
        sort_metric_label = st.selectbox("Sort Report By Metric", ["Total Net Retention (₹)", "Total Freight Revenue (₹)", "Total Trips", "Incomplete Trips (Pending POD)", "Total Tons (Loaded MT)", "Total Diesel Given (Litres)", "Total Diesel Expense (₹)", "Total Direct Expense (₹)", "Retention Percentage (%)", "Diesel Percentage (%)", "Fuel Mileage (KMPL)"])
    with sort_c2:
        sort_direction_label = st.selectbox("Performance Ranking Order", ["Top Performers (High ➔ Low / Descending)", "Underperformers / Poor Performing (Low ➔ High / Ascending)"])

    METRIC_COL_MAP = {"Total Net Retention (₹)": "net_retention", "Total Freight Revenue (₹)": "total_freight", "Total Trips": "total_trips", "Incomplete Trips (Pending POD)": "incomplete_trips", "Total Tons (Loaded MT)": "total_tons", "Total Diesel Given (Litres)": "total_diesel_litres", "Total Diesel Expense (₹)": "total_diesel_cost", "Total Direct Expense (₹)": "total_expense", "Retention Percentage (%)": "retention_pct", "Diesel Percentage (%)": "diesel_pct", "Fuel Mileage (KMPL)": "kmpl"}
    target_sort_col = METRIC_COL_MAP[sort_metric_label]
    is_ascending = ("Low ➔ High" in sort_direction_label)

    tab_f, tab_v, tab_d = st.tabs(["📊 Fleet Unit Retention & Margins", "⚖️ Variant Peer Benchmarks", "👨‍✈️ Driver Performance Scorecard"])
    
    if start_filter_date and end_filter_date:
        fleet_sql = """
            WITH vehicle_fuel_summary AS (
                SELECT vehicle_id, COALESCE(SUM(litres_filled), 0.00) AS total_litres_pumped, COALESCE(SUM(total_fuel_cost), 0.00) AS total_diesel_expense
                FROM diesel_fuel_logs WHERE fuel_date::date >= %s AND fuel_date::date <= %s GROUP BY vehicle_id
            ),
            vehicle_trip_summary AS (
                SELECT t.vehicle_id, COUNT(t.trip_id) AS trips_count, COUNT(CASE WHEN t.trip_status != 'COMPLETED' THEN 1 END) AS pending_pod_count,
                    COALESCE(SUM(COALESCE(t.total_km_run, 0.00)), 0.00) AS total_km_run, COALESCE(SUM(COALESCE(NULLIF(t.loaded_weight_mt, 0.00), NULLIF(t.tonnage_loaded, 0.00), 0.00)), 0.00) AS total_tonnage,
                    COALESCE(SUM(COALESCE(t.freight_revenue, 0.00)), 0.00) AS total_freight_revenue,
                    COALESCE(SUM(COALESCE(t.driver_bata, 0.00) + COALESCE(t.halt_bata, 0.00) + COALESCE(t.toll_fastag_expense, 0.00) + COALESCE(t.enroute_repairs_maintenance, 0.00) + COALESCE(t.loading_unloading_expense, 0.00) + COALESCE(t.misc_trip_expense, 0.00)), 0.00) AS non_fuel_trip_costs
                FROM trips t WHERE t.trip_start_date::date >= %s AND t.trip_start_date::date <= %s GROUP BY t.vehicle_id
            )
            SELECT v.vehicle_number, v.truck_type, v.carrying_capacity_tons, COALESCE(ts.trips_count, 0) AS total_trips, COALESCE(ts.pending_pod_count, 0) AS incomplete_trips, COALESCE(ts.total_km_run, 0.00) AS total_km, COALESCE(ts.total_tonnage, 0.00) AS total_tons, COALESCE(ts.total_freight_revenue, 0.00) AS total_freight, COALESCE(fs.total_litres_pumped, 0.00) AS total_diesel_litres, COALESCE(fs.total_diesel_expense, 0.00) AS total_diesel_cost, COALESCE(ts.non_fuel_trip_costs, 0.00) AS trip_bata_claims, (COALESCE(fs.total_diesel_expense, 0.00) + COALESCE(ts.non_fuel_trip_costs, 0.00)) AS total_expense, (COALESCE(ts.total_freight_revenue, 0.00) - (COALESCE(fs.total_diesel_expense, 0.00) + COALESCE(ts.non_fuel_trip_costs, 0.00))) AS net_retention,
                ROUND((COALESCE(ts.total_freight_revenue, 0.00) - (COALESCE(fs.total_diesel_expense, 0.00) + COALESCE(ts.non_fuel_trip_costs, 0.00))) / NULLIF(ts.total_freight_revenue, 0.00) * 100.0, 2) AS retention_pct,
                ROUND(COALESCE(fs.total_diesel_expense, 0.00) / NULLIF(ts.total_freight_revenue, 0.00) * 100.0, 2) AS diesel_pct,
                ROUND(COALESCE(ts.total_km_run, 0.00) / NULLIF(fs.total_litres_pumped, 0.00), 2) AS kmpl
            FROM vehicles v LEFT JOIN vehicle_trip_summary ts ON v.vehicle_id = ts.vehicle_id LEFT JOIN vehicle_fuel_summary fs ON v.vehicle_id = fs.vehicle_id WHERE v.is_active = TRUE;
        """
        fleet_params = (start_filter_date, end_filter_date, start_filter_date, end_filter_date)
    else:
        fleet_sql = """
            WITH vehicle_fuel_summary AS (
                SELECT vehicle_id, COALESCE(SUM(litres_filled), 0.00) AS total_litres_pumped, COALESCE(SUM(total_fuel_cost), 0.00) AS total_diesel_expense FROM diesel_fuel_logs GROUP BY vehicle_id
            ),
            vehicle_trip_summary AS (
                SELECT t.vehicle_id, COUNT(t.trip_id) AS trips_count, COUNT(CASE WHEN t.trip_status != 'COMPLETED' THEN 1 END) AS pending_pod_count,
                    COALESCE(SUM(COALESCE(t.total_km_run, 0.00)), 0.00) AS total_km_run, COALESCE(SUM(COALESCE(NULLIF(t.loaded_weight_mt, 0.00), NULLIF(t.tonnage_loaded, 0.00), 0.00)), 0.00) AS total_tonnage,
                    COALESCE(SUM(COALESCE(t.freight_revenue, 0.00)), 0.00) AS total_freight_revenue,
                    COALESCE(SUM(COALESCE(t.driver_bata, 0.00) + COALESCE(t.halt_bata, 0.00) + COALESCE(t.toll_fastag_expense, 0.00) + COALESCE(t.enroute_repairs_maintenance, 0.00) + COALESCE(t.loading_unloading_expense, 0.00) + COALESCE(t.misc_trip_expense, 0.00)), 0.00) AS non_fuel_trip_costs
                FROM trips t GROUP BY t.vehicle_id
            )
            SELECT v.vehicle_number, v.truck_type, v.carrying_capacity_tons, COALESCE(ts.trips_count, 0) AS total_trips, COALESCE(ts.pending_pod_count, 0) AS incomplete_trips, COALESCE(ts.total_km_run, 0.00) AS total_km, COALESCE(ts.total_tonnage, 0.00) AS total_tons, COALESCE(ts.total_freight_revenue, 0.00) AS total_freight, COALESCE(fs.total_litres_pumped, 0.00) AS total_diesel_litres, COALESCE(fs.total_diesel_expense, 0.00) AS total_diesel_cost, COALESCE(ts.non_fuel_trip_costs, 0.00) AS trip_bata_claims, (COALESCE(fs.total_diesel_expense, 0.00) + COALESCE(ts.non_fuel_trip_costs, 0.00)) AS total_expense, (COALESCE(ts.total_freight_revenue, 0.00) - (COALESCE(fs.total_diesel_expense, 0.00) + COALESCE(ts.non_fuel_trip_costs, 0.00))) AS net_retention,
                ROUND((COALESCE(ts.total_freight_revenue, 0.00) - (COALESCE(fs.total_diesel_expense, 0.00) + COALESCE(ts.non_fuel_trip_costs, 0.00))) / NULLIF(ts.total_freight_revenue, 0.00) * 100.0, 2) AS retention_pct,
                ROUND(COALESCE(fs.total_diesel_expense, 0.00) / NULLIF(ts.total_freight_revenue, 0.00) * 100.0, 2) AS diesel_pct,
                ROUND(COALESCE(ts.total_km_run, 0.00) / NULLIF(fs.total_litres_pumped, 0.00), 2) AS kmpl
            FROM vehicles v LEFT JOIN vehicle_trip_summary ts ON v.vehicle_id = ts.vehicle_id LEFT JOIN vehicle_fuel_summary fs ON v.vehicle_id = fs.vehicle_id WHERE v.is_active = TRUE;
        """
        fleet_params = None

    fleet_data = run_query(fleet_sql, fleet_params)

    with tab_f:
        if fleet_data:
            df_fl = pd.DataFrame(fleet_data)
            numeric_cols = ['total_trips', 'incomplete_trips', 'total_km', 'total_tons', 'total_freight', 'total_diesel_litres', 'total_diesel_cost', 'trip_bata_claims', 'total_expense', 'net_retention', 'retention_pct', 'diesel_pct', 'kmpl']
            for c in numeric_cols:
                if c in df_fl.columns: df_fl[c] = pd.to_numeric(df_fl[c], errors='coerce').fillna(0.0)

            sort_col = target_sort_col if target_sort_col in df_fl.columns else 'net_retention'
            df_fl = df_fl.sort_values(by=[sort_col], ascending=[is_ascending]).reset_index(drop=True)

            tot_freight = float(df_fl['total_freight'].sum() or 0.0) if 'total_freight' in df_fl.columns else 0.0
            tot_diesel_cost = float(df_fl['total_diesel_cost'].sum() or 0.0) if 'total_diesel_cost' in df_fl.columns else 0.0
            tot_exp = float(df_fl['total_expense'].sum() or 0.0) if 'total_expense' in df_fl.columns else 0.0
            tot_ret = float(df_fl['net_retention'].sum() or 0.0) if 'net_retention' in df_fl.columns else 0.0

            k1, k2, k3, k4, k5, k6 = st.columns(6)
            k1.metric("Total Trips", f"{int(df_fl['total_trips'].sum() or 0) if 'total_trips' in df_fl.columns else 0}")
            k2.metric("Incomplete Trips (Pending POD)", f"{int(df_fl['incomplete_trips'].sum() or 0) if 'incomplete_trips' in df_fl.columns else 0}")
            k3.metric("Total Freight", f"₹{tot_freight:,.2f}")
            k4.metric("Total Diesel Expense", f"₹{tot_diesel_cost:,.2f}")
            k5.metric("Total Net Retention", f"₹{tot_ret:,.2f}")
            k6.metric("Fleet Retention %", f"{round((tot_ret / max(1.0, tot_freight)) * 100.0, 2) if tot_freight > 0 else 0.0:.2f}%")

            st.dataframe(df_fl, hide_index=True, use_container_width=True, height=400)

    with tab_v:
        if fleet_data:
            df_v_peer = pd.DataFrame(fleet_data)
            for c in numeric_cols:
                if c in df_v_peer.columns: df_v_peer[c] = pd.to_numeric(df_v_peer[c], errors='coerce').fillna(0.0)

            all_variants = sorted(list(set(df_v_peer['truck_type'].tolist()))) if 'truck_type' in df_v_peer.columns else []
            sel_var = st.selectbox("Filter by Specific Variant Class", ["All Variants"] + all_variants)
            if sel_var != "All Variants": df_v_peer = df_v_peer[df_v_peer['truck_type'] == sel_var]

            sort_col_v = target_sort_col if target_sort_col in df_v_peer.columns else 'net_retention'
            df_v_peer = df_v_peer.sort_values(by=[sort_col_v], ascending=[is_ascending]).reset_index(drop=True)

            p_freight = float(df_v_peer['total_freight'].sum() or 0.0) if 'total_freight' in df_v_peer.columns else 0.0
            p_ret = float(df_v_peer['net_retention'].sum() or 0.0) if 'net_retention' in df_v_peer.columns else 0.0

            pk1, pk2, pk3, pk4, pk5 = st.columns(5)
            pk1.metric("Peer Class Units", f"{len(df_v_peer)}")
            pk2.metric("Peer Trips", f"{int(df_v_peer['total_trips'].sum() or 0) if 'total_trips' in df_v_peer.columns else 0}")
            pk3.metric("Peer Freight Revenue", f"₹{p_freight:,.2f}")
            pk4.metric("Peer Net Retention", f"₹{p_ret:,.2f}")
            pk5.metric("Peer Retention %", f"{round((p_ret / max(1.0, p_freight)) * 100.0, 2) if p_freight > 0 else 0.0:.2f}%")

            st.dataframe(df_v_peer, hide_index=True, use_container_width=True, height=380)

    with tab_d:
        if start_filter_date and end_filter_date:
            drv_sql = """
                SELECT d.driver_code, d.full_name, COUNT(t.trip_id) AS trips, COUNT(CASE WHEN t.trip_status != 'COMPLETED' THEN 1 END) AS incomplete_trips,
                    COALESCE(SUM(COALESCE(t.total_km_run, 0.00)), 0.00) AS total_km, COALESCE(SUM(CASE WHEN t.trip_id IS NOT NULL THEN COALESCE(NULLIF(t.loaded_weight_mt, 0.00), NULLIF(t.tonnage_loaded, 0.00), 0.00) ELSE 0.00 END), 0.00) AS total_mt,
                    ROUND(SUM(COALESCE(t.total_km_run, 0.00)) / NULLIF(SUM(COALESCE(t.fuel_litres, 0.00)), 0.00), 2) AS kmpl,
                    COALESCE(SUM(COALESCE(t.shortage_mt, 0.00)), 0.00) AS shortage_mt, COALESCE(SUM(COALESCE(t.freight_revenue, 0.00)), 0.00) AS revenue, COALESCE(SUM(COALESCE(t.driver_bata, 0.00)), 0.00) AS bata_earned
                FROM drivers d LEFT JOIN trips t ON d.driver_id = t.primary_driver_id AND t.trip_start_date::date >= %s AND t.trip_start_date::date <= %s
                WHERE d.is_active = TRUE GROUP BY d.driver_code, d.full_name;
            """
            drv_params = (start_filter_date, end_filter_date)
        else:
            drv_sql = """
                SELECT d.driver_code, d.full_name, COUNT(t.trip_id) AS trips, COUNT(CASE WHEN t.trip_status != 'COMPLETED' THEN 1 END) AS incomplete_trips,
                    COALESCE(SUM(COALESCE(t.total_km_run, 0.00)), 0.00) AS total_km, COALESCE(SUM(CASE WHEN t.trip_id IS NOT NULL THEN COALESCE(NULLIF(t.loaded_weight_mt, 0.00), NULLIF(t.tonnage_loaded, 0.00), 0.00) ELSE 0.00 END), 0.00) AS total_mt,
                    ROUND(SUM(COALESCE(t.total_km_run, 0.00)) / NULLIF(SUM(COALESCE(t.fuel_litres, 0.00)), 0.00), 2) AS kmpl,
                    COALESCE(SUM(COALESCE(t.shortage_mt, 0.00)), 0.00) AS shortage_mt, COALESCE(SUM(COALESCE(t.freight_revenue, 0.00)), 0.00) AS revenue, COALESCE(SUM(COALESCE(t.driver_bata, 0.00)), 0.00) AS bata_earned
                FROM drivers d LEFT JOIN trips t ON d.driver_id = t.primary_driver_id
                WHERE d.is_active = TRUE GROUP BY d.driver_code, d.full_name;
            """
            drv_params = None

        drv_data = run_query(drv_sql, drv_params)
        if drv_data:
            df_drv = pd.DataFrame(drv_data)
            for c in ['trips', 'incomplete_trips', 'total_km', 'total_mt', 'kmpl', 'shortage_mt', 'revenue', 'bata_earned']:
                if c in df_drv.columns: df_drv[c] = pd.to_numeric(df_drv[c], errors='coerce').fillna(0.0)
            df_drv = df_drv.sort_values(by=['revenue'], ascending=[False]).reset_index(drop=True)
            st.dataframe(df_drv, hide_index=True, use_container_width=True, height=450)

# ==============================================================================
# MODULE: 10. AUDIT LOG
# ==============================================================================
elif menu == "Audit Log":
    st.markdown('<div class="section-header">Complete System Audit Log & Multi-Parameter Filter</div>', unsafe_allow_html=True)
    vehicles, drivers = get_cached_vehicles(), get_cached_drivers()

    af_col1, af_col2, af_col3, af_col4, af_col5 = st.columns([1.8, 1.8, 1.8, 1.8, 2.0])
    with af_col1: aud_date_mode = st.selectbox("Date Mode", ["All Dates", "Specific Single Date", "Custom Date Range"])
    with af_col2: sel_aud_trk = st.selectbox("Select Truck", ["All Trucks"] + sorted([v['vehicle_number'] for v in vehicles]))
    with af_col3: sel_aud_stat = st.selectbox("Trip Status", ["All Statuses", "IN_TRANSIT (Open / Pending POD)", "COMPLETED (Closed)"])
    with af_col4: sel_aud_drv = st.selectbox("Assigned Driver", ["All Drivers"] + sorted([f"{d['driver_code']} - {d['full_name']}" for d in drivers]))
    with af_col5: search_aud_text = st.text_input("Search LR / Destination", placeholder="e.g. LR-401").strip().upper()

    aud_date_q, aud_params = "", []
    if aud_date_mode == "Specific Single Date":
        c_d1, _ = st.columns([2, 2])
        with c_d1: aud_date_q = " AND t.trip_start_date::date = %s"; aud_params.append(st.date_input("Filter Date", date.today()))
    elif aud_date_mode == "Custom Date Range":
        c_d1, c_d2 = st.columns(2)
        with c_d1: aud_params.append(st.date_input("From Date", date.today().replace(day=1)))
        with c_d2: aud_params.append(st.date_input("To Date", date.today())); aud_date_q = " AND t.trip_start_date::date >= %s AND t.trip_start_date::date <= %s"

    try:
        aud_sql = f"SELECT t.trip_id, t.trip_number, t.pod_number, t.trip_start_date, t.trip_end_date, v.vehicle_number, d.full_name AS driver, d.phone_number AS driver_phone, t.origin, t.destination, t.start_km, t.end_km, t.total_km_run, t.loaded_weight_mt, t.unloaded_weight_mt, t.freight_revenue, t.fuel_litres, t.fuel_expense, t.driver_bata, t.halt_bata, t.cash_advance_issued, (t.freight_revenue - (t.fuel_expense + t.driver_bata + t.halt_bata + t.enroute_repairs_maintenance)) AS net_profit, t.trip_status, t.is_tank_full FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id WHERE 1=1 {aud_date_q}"
        run_query(aud_sql + " LIMIT 1", tuple(aud_params) if aud_params else None)
    except Exception:
        aud_sql = f"SELECT t.trip_id, t.trip_number, t.pod_number, t.trip_start_date, t.trip_end_date, v.vehicle_number, d.full_name AS driver, d.phone_number AS driver_phone, t.origin, t.destination, t.start_km, t.end_km, t.total_km_run, t.loaded_weight_mt, t.unloaded_weight_mt, t.freight_revenue, t.fuel_litres, t.fuel_expense, t.driver_bata, t.halt_bata, t.cash_advance_issued, (t.freight_revenue - (t.fuel_expense + t.driver_bata + t.halt_bata + t.enroute_repairs_maintenance)) AS net_profit, t.trip_status FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id WHERE 1=1 {aud_date_q}"

    if sel_aud_trk != "All Trucks": aud_sql += " AND v.vehicle_number = %s"; aud_params.append(sel_aud_trk)
    if sel_aud_stat == "IN_TRANSIT (Open / Pending POD)": aud_sql += " AND t.trip_status != 'COMPLETED'"
    elif sel_aud_stat == "COMPLETED (Closed)": aud_sql += " AND t.trip_status = 'COMPLETED'"
    if sel_aud_drv != "All Drivers": aud_sql += " AND d.driver_code = %s"; aud_params.append(sel_aud_drv.split(" - ")[0].strip())
    if search_aud_text: aud_sql += " AND (UPPER(t.trip_number) LIKE %s OR UPPER(t.destination) LIKE %s OR UPPER(t.origin) LIKE %s)"; aud_params.extend([f"%{search_aud_text}%", f"%{search_aud_text}%", f"%{search_aud_text}%"])
    aud_sql += " ORDER BY t.trip_id DESC;"

    all_trips = run_query(aud_sql, tuple(aud_params) if aud_params else None)
    if all_trips:
        df_all = pd.DataFrame(all_trips)
        af_k1, af_k2, af_k3, af_k4 = st.columns(4)
        af_k1.metric("Filtered Trips", len(df_all))
        af_k2.metric("Total Loaded Tonnage", f"{float(df_all['loaded_weight_mt'].sum() or 0.0):,.2f} MT")
        af_k3.metric("Freight Revenue", f"₹{float(df_all['freight_revenue'].sum() or 0.0):,.2f}")
        af_k4.metric("Net Margin Retained", f"₹{float(df_all['net_profit'].sum() or 0.0):,.2f}")
        st.dataframe(df_all, hide_index=True, use_container_width=True, height=350)
        
        if st.session_state.user_role == "MASTER":
            del_log1, del_log3 = st.columns([3.0, 1.0])
            with del_log1: del_target_id = st.selectbox("Select Trip ID to Delete", df_all['trip_id'].tolist(), format_func=lambda x: f"Trip ID #{x} - LR: {df_all.loc[df_all['trip_id'] == x, 'trip_number'].values[0]}")
            with del_log3:
                st.write("")
                if st.button("🗑️ Purge Trip from Registry", type="secondary", use_container_width=True):
                    confirm_action_dialog(f"permanently purge Trip ID #{del_target_id}", lambda: (run_query("UPDATE diesel_fuel_logs SET trip_id = NULL WHERE trip_id = %s", (del_target_id,), fetch=False), run_query("DELETE FROM trips WHERE trip_id = %s", (del_target_id,), fetch=False), get_cached_vehicles.clear(), trigger_toast_and_rerun("SUCCESS", f"Trip #{del_target_id} purged.")))
    else: st.info("No records match the specified audit filter criteria.")
