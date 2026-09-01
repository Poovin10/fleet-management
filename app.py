import streamlit as st
import pandas as pd
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from datetime import date
import io
import time

# --- Full Widescreen Page Configuration ---
st.set_page_config(
    page_title="Fleet Operations ERP",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# --- Professional Widescreen ERP CSS (100% Viewport Coverage) ---
st.markdown("""
<style>
    .main .block-container, div[data-testid="stAppViewBlockContainer"] {
        padding-top: 0.8rem !important;
        padding-bottom: 1rem !important;
        padding-left: 1.5rem !important;
        padding-right: 1.5rem !important;
        max-width: 100vw !important;
        width: 100% !important;
    }
    header {visibility: hidden; display: none !important;}
    #MainMenu {visibility: hidden; display: none !important;}
    footer {visibility: hidden; display: none !important;}
    
    div[data-testid="stMetricValue"] {
        font-size: 1.25rem !important;
        font-weight: 700 !important;
        color: #0F172A !important;
    }
    div[data-testid="stMetricLabel"] {
        font-size: 0.78rem !important;
        font-weight: 600 !important;
        color: #475569 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
    }
    .section-header {
        font-size: 0.95rem !important;
        font-weight: 700 !important;
        color: #1E293B !important;
        border-bottom: 2px solid #CBD5E1 !important;
        padding-bottom: 4px !important;
        margin-top: 8px !important;
        margin-bottom: 10px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
    }
    .stTextInput>div>div>input, .stNumberInput>div>div>input, .stSelectbox>div>div>div {
        height: 38px !important;
        font-size: 0.92rem !important;
        border-radius: 4px !important;
    }
    .stButton>button {
        height: 40px !important;
        font-size: 0.92rem !important;
        font-weight: 600 !important;
        border-radius: 4px !important;
    }
    div[data-testid="stForm"] {
        padding: 14px 18px !important;
        border: 1px solid #E2E8F0 !important;
        border-radius: 6px !important;
        background-color: #FAFAFA !important;
    }
    div[data-testid="stDataFrame"] {
        width: 100% !important;
    }
    
    /* Right Bottom Toast Notification Custom Styling */
    div[data-testid="stToast"] {
        font-size: 0.90rem !important;
        font-weight: 600 !important;
        border-radius: 6px !important;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16) !important;
    }
</style>
""", unsafe_allow_html=True)

# --- Bottom-Right Toast Helper Functions ---
def show_success_toast(msg: str):
    st.toast(f"✅ {msg}", icon="✅")

def show_error_toast(msg: str):
    st.toast(f"❌ {msg}", icon="❌")

# --- Check Session Toast Queue on Rerun ---
if "pending_toast" in st.session_state and st.session_state.pending_toast:
    t_type, t_msg = st.session_state.pending_toast
    if t_type == "SUCCESS":
        show_success_toast(t_msg)
    else:
        show_error_toast(t_msg)
    st.session_state.pending_toast = None

def trigger_toast_and_rerun(toast_type: str, message: str, delay_sec: float = 1.0):
    st.session_state.pending_toast = (toast_type, message)
    time.sleep(delay_sec)
    st.rerun()

# --- Database Connection Pool ---
@st.cache_resource
def init_connection_pool():
    creds = {
        "host": "aws-0-ap-south-1.pooler.supabase.com",
        "port": 6543,
        "dbname": "postgres",
        "user": "postgres.eobweyciqwoojwnsonor",
        "password": "Poovin@2809"
    }
    try:
        if len(st.secrets) > 0 and "postgres" in st.secrets:
            creds = dict(st.secrets["postgres"])
    except Exception:
        pass

    return psycopg2.pool.ThreadedConnectionPool(
        minconn=1,
        maxconn=10,
        host=creds["host"],
        port=int(creds["port"]),
        dbname=creds["dbname"],
        user=creds["user"],
        password=creds["password"],
        sslmode="require"
    )

db_pool = init_connection_pool()

def run_query(query, params=None, fetch=True):
    conn = db_pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params or ())
            if fetch:
                result = cur.fetchall()
            else:
                result = None
            conn.commit()
        return result
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        db_pool.putconn(conn)

# --- Fast Caching with Unified 25MT/30MT Bag Slab Logic ---
@st.cache_data(ttl=60)
def get_cached_vehicles():
    return run_query("SELECT vehicle_id, vehicle_number, truck_type, carrying_capacity_tons, current_status, status_remarks FROM vehicles WHERE is_active = TRUE ORDER BY vehicle_number")

@st.cache_data(ttl=60)
def get_cached_drivers(include_inactive=False):
    if include_inactive:
        return run_query("SELECT driver_id, driver_code, full_name, phone_number, license_number, license_expiry_date, is_active FROM drivers ORDER BY full_name ASC")
    return run_query("SELECT driver_id, driver_code, full_name, phone_number, license_number, license_expiry_date FROM drivers WHERE is_active = TRUE ORDER BY full_name ASC")

@st.cache_data(ttl=60)
def get_cached_routes(cargo_type=None, capacity=None, origin=None):
    query = "SELECT * FROM destinations_freight_master WHERE is_active = TRUE"
    params = []
    if cargo_type:
        query += " AND cargo_type = %s"
        params.append(cargo_type)
    if origin:
        query += " AND UPPER(origin) = UPPER(%s)"
        params.append(origin.strip())
        
    if cargo_type == "BAG" and capacity in [25.0, 30.0]:
        query += " AND capacity_tons IN (25.0, 30.0)"
    elif capacity:
        query += " AND capacity_tons = %s"
        params.append(capacity)
        
    query += " ORDER BY destination_name ASC, capacity_tons ASC"
    routes = run_query(query, tuple(params))
    
    if cargo_type == "BAG" and routes:
        seen = set()
        deduped = []
        for r in routes:
            key = (r['origin'].upper(), r['destination_name'].upper())
            if key not in seen:
                seen.add(key)
                deduped.append(r)
        return deduped
        
    return routes

@st.cache_data(ttl=60)
def get_cached_bata_rules():
    return run_query("""
        SELECT b.bata_rule_id, b.destination_name, b.cargo_type, b.vehicle_id, v.vehicle_number, b.capacity_tons, b.standard_bata_inr
        FROM driver_bata_master b
        LEFT JOIN vehicles v ON b.vehicle_id = v.vehicle_id
        ORDER BY b.destination_name, v.vehicle_number ASC
    """)

@st.cache_data(ttl=300)
def get_cached_diesel_rate():
    try:
        res = run_query("SELECT setting_value FROM system_settings WHERE setting_key = 'diesel_rate_per_litre'")
        if res:
            return float(res[0]['setting_value'])
    except Exception:
        pass
    return 95.00

def set_saved_diesel_rate(new_rate):
    run_query("""
        INSERT INTO system_settings (setting_key, setting_value, updated_at)
        VALUES ('diesel_rate_per_litre', %s, CURRENT_TIMESTAMP)
        ON CONFLICT (setting_key) 
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP;
    """, (str(new_rate),), fetch=False)
    get_cached_diesel_rate.clear()

def get_last_driver_for_vehicle(vehicle_id):
    try:
        res = run_query("SELECT primary_driver_id FROM trips WHERE vehicle_id = %s ORDER BY trip_id DESC LIMIT 1", (vehicle_id,))
        if res:
            return res[0]['primary_driver_id']
    except Exception:
        pass
    return None

def check_lr_exists(trip_no, exclude_trip_id=None):
    if not trip_no or not trip_no.strip():
        return False
    if exclude_trip_id:
        res = run_query("SELECT trip_id FROM trips WHERE LOWER(trip_number) = LOWER(%s) AND trip_id != %s", (trip_no.strip(), exclude_trip_id))
    else:
        res = run_query("SELECT trip_id FROM trips WHERE LOWER(trip_number) = LOWER(%s)", (trip_no.strip(),))
    return len(res) > 0

def lookup_driver_bata(dest_name, cargo_type, vehicle_id):
    if not dest_name:
        return 0.00
    try:
        res = run_query("""
            SELECT standard_bata_inr 
            FROM driver_bata_master 
            WHERE LOWER(destination_name) = LOWER(%s) 
              AND cargo_type = %s 
              AND vehicle_id = %s 
            LIMIT 1
        """, (dest_name.strip(), cargo_type, vehicle_id))
        if res:
            return float(res[0]['standard_bata_inr'])
    except Exception:
        pass
    return 0.00

STATUS_OPTIONS = {
    "AVAILABLE_FOR_LOAD": "Available for Loading",
    "WAITING_FOR_LOAD": "Waiting for Loading (Plant)",
    "IN_TRANSIT": "In Transit (On Highway)",
    "WAITING_FOR_UNLOAD": "Waiting for Unloading (Site)",
    "WORKSHOP_MAINTENANCE": "In Workshop / Maintenance",
    "DRIVER_UNAVAILABLE": "Driver Unavailable / Leave"
}

STANDARD_SOURCES = ["COCHIN", "POTTANERI", "METTUR", "UDUPPI", "COCHIN-ACC", "TUTICORIN", "CUSTOM"]

# --- Full Widescreen Header Ribbon ---
nav1, nav2, nav3 = st.columns([2.5, 4.5, 1.5])
with nav1:
    st.markdown("<h3 style='margin:0; padding:0; font-size:1.35rem; color:#0F172A; font-weight:700;'>Fleet Operations ERP</h3>", unsafe_allow_html=True)
with nav2:
    MODULE_LIST = [
        "Trip Dispatch Entry",
        "POD Receive & Close",
        "Fleet Status Board",
        "Diesel Logs",
        "Driver Advances",
        "Modify Trips & Claims",
        "Driver Settlement",
        "Master Configuration",
        "Executive Retention Analytics",
        "Audit Log"
    ]
    menu = st.selectbox("Module Navigation", MODULE_LIST, index=0, label_visibility="collapsed")
with nav3:
    current_d_rate = get_cached_diesel_rate()
    d_rate_fast = st.number_input("Active Diesel Rate (₹/L)", value=current_d_rate, step=0.1, label_visibility="collapsed")
    if d_rate_fast != current_d_rate:
        set_saved_diesel_rate(d_rate_fast)

st.markdown("<hr style='margin: 8px 0 16px 0; border: none; border-top: 1px solid #E2E8F0;' />", unsafe_allow_html=True)

# ==============================================================================
# 1. FULL-WIDTH TRIP DISPATCH ENTRY
# ==============================================================================
if menu == "Trip Dispatch Entry":
    vehicles = get_cached_vehicles()
    drivers = get_cached_drivers()

    if not vehicles or not drivers:
        show_error_toast("Configure vehicles and drivers in Master Configuration first.")
        st.stop()

    if "form_reset_counter" not in st.session_state:
        st.session_state.form_reset_counter = 0

    cnt = st.session_state.form_reset_counter

    st.markdown('<div class="section-header">Primary Manifest & Routing Assignment</div>', unsafe_allow_html=True)
    
    r1_c1, r1_c2, r1_c3, r1_c4, r1_c5 = st.columns([1.2, 1.4, 1.3, 2.6, 1.5])
    
    with r1_c1:
        start_date = st.date_input("1. Trip Start Date*", date.today(), min_value=date(2020, 1, 1), max_value=date(2035, 12, 31), key=f"sdate_{cnt}")
        
    with r1_c2:
        lr_no = st.text_input("2. LR Number*", placeholder="LR-XXXX", key=f"lr_{cnt}").strip().upper()
        if lr_no and check_lr_exists(lr_no):
            show_error_toast(f"Duplicate Alert: LR Number '{lr_no}' already exists!")

    with r1_c3:
        cargo_category = st.selectbox("3. Cargo Category*", ["BULK", "BAG"], key=f"cargo_sel_{cnt}")

    if cargo_category == "BULK":
        filtered_vehicles = [v for v in vehicles if "BULK" in str(v.get('truck_type', '')).upper()]
    else:
        filtered_vehicles = [v for v in vehicles if any(k in str(v.get('truck_type', '')).upper() for k in ["BAG", "BODY"])]

    if not filtered_vehicles:
        filtered_vehicles = vehicles

    vehicle_map = {
        f"{v['vehicle_number']} ➔ [{v['truck_type']} | {v['carrying_capacity_tons']} MT Class]": v 
        for v in filtered_vehicles
    }

    with r1_c4:
        sel_veh_label = st.selectbox(f"4. Assigned Truck ({cargo_category} Only)*", list(vehicle_map.keys()), key=f"veh_sel_{cnt}")
        active_veh = vehicle_map[sel_veh_label]
        v_class_mt = float(active_veh['carrying_capacity_tons'])
        last_drv_id = get_last_driver_for_vehicle(active_veh['vehicle_id'])

    with r1_c5:
        chosen_source_opt = st.selectbox("5. Source Hub*", STANDARD_SOURCES, key=f"src_sel_{cnt}")
        origin_terminal = st.text_input("Custom Source", placeholder="Enter Source").strip().upper() if chosen_source_opt == "CUSTOM" else chosen_source_opt

    routes_from_source = get_cached_routes(cargo_type=cargo_category, capacity=v_class_mt, origin=origin_terminal)
    dest_options = {}
    if routes_from_source:
        for r in routes_from_source:
            lbl = f"{r['destination_name']} ➔ [Rate: ₹{r['freight_rate_per_ton']}/MT | {r['standard_km']} KM]"
            dest_options[lbl] = r
    dest_options["-- MANUAL / SPOT DESTINATION --"] = {"origin": origin_terminal, "destination_name": "", "standard_km": 0.0, "freight_rate_per_ton": 0.0}

    r2_c1, r2_c2, r2_c3, r2_c4 = st.columns([2.8, 2.2, 1.5, 1.5])
    with r2_c1:
        sel_dest_label = st.selectbox(f"6. Destination Terminal ({origin_terminal})*", list(dest_options.keys()), key=f"dest_sel_{cnt}")
        active_route = dest_options[sel_dest_label]
        is_spot = (sel_dest_label == "-- MANUAL / SPOT DESTINATION --")
        if is_spot:
            dest_terminal = st.text_input("Custom Destination Name*", placeholder="e.g. SANKARI").strip().upper()
            agreed_rate_mt = st.number_input("Spot Freight Rate/MT*", min_value=0.0, step=25.0, value=0.0, key=f"spot_rate_{cnt}")
            standard_route_km = st.number_input("Standard KM", min_value=0.0, step=10.0, value=0.0, key=f"spot_km_{cnt}")
        else:
            dest_terminal = active_route['destination_name']
            agreed_rate_mt = float(active_route['freight_rate_per_ton'])
            standard_route_km = float(active_route['standard_km'])

    driver_dict = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers}
    default_driver_index = 0
    if last_drv_id:
        for idx, d_obj in enumerate(driver_dict.values()):
            if d_obj['driver_id'] == last_drv_id:
                default_driver_index = idx
                break

    with r2_c2:
        chosen_driver_str = st.selectbox("7. Designated Driver*", list(driver_dict.keys()), index=default_driver_index, key=f"drv_{cnt}")
        sel_driver_obj = driver_dict[chosen_driver_str]
    with r2_c3:
        weighbridge_mt = st.number_input("8. Loaded Weight (MT)*", min_value=0.0, max_value=60.0, step=0.05, value=v_class_mt, key=f"wmt_{cnt}")
    with r2_c4:
        gross_freight = round(weighbridge_mt * agreed_rate_mt, 2)
        st.metric("Auto Freight Revenue", f"₹{gross_freight:,.2f}")

    master_bata_val = lookup_driver_bata(dest_terminal, cargo_category, active_veh['vehicle_id'])
    st.markdown('<div class="section-header">Fuel, Allowances & Odometer Tracking</div>', unsafe_allow_html=True)
    r3_c1, r3_c2, r3_c3, r3_c4, r3_c5, r3_c6 = st.columns(6)
    with r3_c1:
        driver_bata = st.number_input("9. Driver Bata (₹)*", min_value=0.0, step=100.0, value=master_bata_val, key=f"bata_{cnt}")
    with r3_c2:
        fuel_qty = st.number_input("10. Diesel (Litres)*", min_value=0.0, step=10.0, value=0.0, key=f"fqty_{cnt}")
    with r3_c3:
        gross_fuel_cost = round(fuel_qty * d_rate_fast, 2)
        st.metric("Auto Fuel Expense", f"₹{gross_fuel_cost:,.2f}")
    with r3_c4:
        start_km = st.number_input("Start Odometer KM", min_value=0.0, step=10.0, value=0.0, key=f"skm_{cnt}")
    with r3_c5:
        end_km = st.number_input("Expected End KM", min_value=0.0, step=10.0, value=0.0, key=f"ekm_{cnt}")
        computed_km = max(0.0, end_km - start_km) if (end_km >= start_km and end_km > 0) else standard_route_km
    with r3_c6:
        cash_advance = st.number_input("Cash Advance (₹)", min_value=0.0, step=500.0, value=0.0, key=f"adv_{cnt}")

    st.write("")
    if st.button("🚀 Save & Dispatch Trip Record", type="primary", use_container_width=True):
        if not lr_no or not dest_terminal or not origin_terminal:
            show_error_toast("LR Number, Source, and Destination are required.")
        elif check_lr_exists(lr_no):
            show_error_toast(f"Cannot dispatch trip. LR Number '{lr_no}' already exists.")
        else:
            try:
                new_t = run_query("""
                    INSERT INTO trips (
                        trip_number, branch_id, vehicle_id, primary_driver_id,
                        trip_start_date, trip_end_date, origin, destination,
                        start_km, end_km, total_km_run, tonnage_loaded, loaded_weight_mt, unloaded_weight_mt,
                        freight_revenue, fuel_litres, fuel_expense, driver_bata, cash_advance_issued, trip_status
                    ) VALUES (%s, 1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'IN_TRANSIT')
                    RETURNING trip_id;
                """, (
                    lr_no, active_veh['vehicle_id'], sel_driver_obj['driver_id'],
                    start_date, start_date, origin_terminal, dest_terminal,
                    start_km, end_km, computed_km, weighbridge_mt, weighbridge_mt, weighbridge_mt,
                    gross_freight, fuel_qty, gross_fuel_cost, driver_bata, cash_advance
                ))
                trip_id_created = new_t[0]['trip_id'] if new_t else None

                if fuel_qty > 0 and trip_id_created:
                    run_query("""
                        INSERT INTO diesel_fuel_logs (fuel_date, vehicle_id, trip_id, lr_number, diesel_category, litres_filled, diesel_rate_per_litre, total_fuel_cost)
                        VALUES (%s, %s, %s, %s, 'TRIP_DIESEL', %s, %s, %s);
                    """, (start_date, active_veh['vehicle_id'], trip_id_created, lr_no, fuel_qty, d_rate_fast, gross_fuel_cost), fetch=False)

                run_query("UPDATE vehicles SET current_status = 'IN_TRANSIT', status_remarks = %s WHERE vehicle_id = %s",
                          (f"Trip {lr_no}: {origin_terminal} ➔ {dest_terminal}", active_veh['vehicle_id']), fetch=False)
                get_cached_vehicles.clear()
                st.session_state.form_reset_counter += 1
                trigger_toast_and_rerun("SUCCESS", f"Trip {lr_no} dispatched successfully.")
            except Exception as e:
                show_error_toast(f"Database Error: {e}")

# ==============================================================================
# 2. POD RECEIVE & TRIP CLOSURE
# ==============================================================================
elif menu == "POD Receive & Close":
    active_trips = run_query("""
        SELECT t.trip_id, t.trip_number, v.vehicle_number, v.vehicle_id, v.carrying_capacity_tons,
               d.full_name AS driver_name, t.origin, t.destination, t.trip_start_date,
               t.start_km, t.end_km, t.total_km_run, t.loaded_weight_mt, t.freight_revenue, t.driver_bata
        FROM trips t
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        JOIN drivers d ON t.primary_driver_id = d.driver_id
        WHERE t.trip_status != 'COMPLETED'
        ORDER BY t.trip_id DESC;
    """)

    if not active_trips:
        st.info("No active trips awaiting POD closure.")
    else:
        trip_opts = {f"LR: {t['trip_number']} | Truck: {t['vehicle_number']} | {t['origin']} ➔ {t['destination']} | Driver: {t['driver_name']}": t for t in active_trips}
        chosen_lr = st.selectbox("Select Active Trip to Close with POD", list(trip_opts.keys()))
        t_cur = trip_opts[chosen_lr]

        known_rate = run_query("SELECT freight_rate_per_ton FROM destinations_freight_master WHERE LOWER(origin)=LOWER(%s) AND LOWER(destination_name)=LOWER(%s) AND capacity_tons=%s LIMIT 1",
                               (t_cur['origin'], t_cur['destination'], t_cur['carrying_capacity_tons']))
        applied_rate = float(known_rate[0]['freight_rate_per_ton']) if known_rate else round(float(t_cur['freight_revenue'] or 0.0)/max(0.01, float(t_cur['loaded_weight_mt'] or 1.0)), 2)

        with st.form("pod_closure_form"):
            st.markdown('<div class="section-header">POD Verification, Weighment & Final Settlements</div>', unsafe_allow_html=True)
            p1, p2, p3, p4, p5 = st.columns([1.5, 1.2, 1.2, 1.2, 1.5])
            with p1:
                pod_no = st.text_input("POD / Challan No*", placeholder="POD-XXXX").strip().upper()
                close_d = st.date_input("Closing Date*", date.today(), min_value=date(2020, 1, 1), max_value=date(2035, 12, 31))
            with p2:
                unloaded_wt = st.number_input("Unloaded MT*", min_value=0.0, max_value=60.0, value=float(t_cur['loaded_weight_mt']), step=0.01)
                shortage = max(0.0, float(t_cur['loaded_weight_mt']) - unloaded_wt)
            with p3:
                final_km = st.number_input("Closing Odometer KM*", min_value=float(t_cur['start_km'] or 0.0), value=float(t_cur['end_km'] or (float(t_cur['start_km'] or 0.0) + float(t_cur['total_km_run'] or 0.0))), step=10.0)
                tot_km = max(0.0, final_km - float(t_cur['start_km'] or 0.0))
            with p4:
                halt_bata = st.number_input("Halt / Detention Bata (₹)", min_value=0.0, value=0.0, step=100.0)
                tot_bata = float(t_cur['driver_bata'] or 0.0) + halt_bata
            with p5:
                claims = st.number_input("En-route Claims (₹)", min_value=0.0, value=0.0, step=50.0)
                final_freight = round(unloaded_wt * applied_rate, 2)

            st.write("")
            if st.form_submit_button("✅ Settle POD, Close Trip & Release Truck", type="primary", use_container_width=True):
                if not pod_no:
                    show_error_toast("POD Number is required.")
                else:
                    try:
                        run_query("""
                            UPDATE trips
                            SET pod_number = %s, pod_received_date = %s, trip_end_date = %s, end_km = %s, total_km_run = %s,
                                unloaded_weight_mt = %s, shortage_mt = %s, freight_revenue = %s, driver_bata = %s, halt_bata = %s,
                                enroute_repairs_maintenance = %s, trip_status = 'COMPLETED', trip_closed_at = CURRENT_TIMESTAMP
                            WHERE trip_id = %s;
                        """, (pod_no, close_d, close_d, final_km, tot_km, unloaded_wt, shortage, final_freight, tot_bata, halt_bata, claims, t_cur['trip_id']), fetch=False)
                        run_query("UPDATE vehicles SET current_status = 'AVAILABLE_FOR_LOAD', status_remarks = %s WHERE vehicle_id = %s",
                                  (f"Completed LR {t_cur['trip_number']} (POD: {pod_no})", t_cur['vehicle_id']), fetch=False)
                        get_cached_vehicles.clear()
                        trigger_toast_and_rerun("SUCCESS", f"Trip {t_cur['trip_number']} closed and Truck {t_cur['vehicle_number']} released.")
                    except Exception as e:
                        show_error_toast(f"Error closing trip: {e}")

# ==============================================================================
# 3. FULL-WIDTH FLEET STATUS BOARD
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
        with v_col1:
            st.dataframe(df_v[['vehicle_number', 'truck_type', 'carrying_capacity_tons', 'status_lbl', 'status_remarks']],
                         column_config={"vehicle_number": "Truck No", "truck_type": "Variant", "carrying_capacity_tons": "Capacity MT", "status_lbl": "Operational Status", "status_remarks": "Location / Note"},
                         hide_index=True, use_container_width=True, height=350)
        with v_col2:
            with st.form("quick_stat_form"):
                v_map = {f"{v['vehicle_number']} ({v['truck_type']})": v for v in vehicles}
                target_veh_no = st.selectbox("Select Truck to Update", list(v_map.keys()))
                target_v = v_map[target_veh_no]
                new_st = st.selectbox("New Operational Status", list(STATUS_OPTIONS.keys()), format_func=lambda x: STATUS_OPTIONS[x])
                new_rem = st.text_input("Current Location / Breakdown Details", value=target_v['status_remarks'] or "")
                st.write("")
                if st.form_submit_button("Update Status", type="primary", use_container_width=True):
                    run_query("UPDATE vehicles SET current_status = %s, status_remarks = %s, status_updated_at = CURRENT_TIMESTAMP WHERE vehicle_id = %s", (new_st, new_rem, target_v['vehicle_id']), fetch=False)
                    get_cached_vehicles.clear()
                    trigger_toast_and_rerun("SUCCESS", f"Status for {target_v['vehicle_number']} updated.")

# ==============================================================================
# 4. FULL-WIDTH DIESEL LOGS
# ==============================================================================
elif menu == "Diesel Logs":
    vehicles = get_cached_vehicles()
    v_dict = {f"{v['vehicle_number']} ({v['truck_type']})": v for v in vehicles}
    
    col_d1, col_d2 = st.columns([1.5, 3.5])
    with col_d1:
        with st.form("d_entry_form", clear_on_submit=True):
            st.markdown('<div class="section-header">Issue Diesel / Log Fuel Bill</div>', unsafe_allow_html=True)
            f_date = st.date_input("Fuel Date*", date.today(), min_value=date(2020, 1, 1), max_value=date(2035, 12, 31))
            f_veh = st.selectbox("Select Truck*", list(v_dict.keys()))
            f_cat = st.selectbox("Diesel Category*", ["TRIP_DIESEL", "SUNDRY_DIESEL"])
            f_lr = st.text_input("Trip LR No (Optional)", placeholder="LR-XXXX").strip().upper()
            f_l = st.number_input("Litres Filled*", min_value=0.0, step=10.0)
            f_cost = round(f_l * d_rate_fast, 2)
            st.metric("Total Fuel Cost", f"₹{f_cost:,.2f}")
            st.write("")
            if st.form_submit_button("Record Diesel Entry", type="primary", use_container_width=True):
                if f_l > 0:
                    run_query("INSERT INTO diesel_fuel_logs (fuel_date, vehicle_id, lr_number, diesel_category, litres_filled, diesel_rate_per_litre, total_fuel_cost) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                              (f_date, v_dict[f_veh]['vehicle_id'], f_lr or "SUNDRY", f_cat, f_l, d_rate_fast, f_cost), fetch=False)
                    trigger_toast_and_rerun("SUCCESS", f"Recorded {f_l}L fuel for {f_veh}.")
                else:
                    show_error_toast("Fuel quantity must be greater than zero.")
    with col_d2:
        st.markdown('<div class="section-header">Recent Diesel Disbursements</div>', unsafe_allow_html=True)
        d_logs = run_query("SELECT f.fuel_date, v.vehicle_number, f.diesel_category, f.lr_number, f.litres_filled, f.total_fuel_cost FROM diesel_fuel_logs f JOIN vehicles v ON f.vehicle_id = v.vehicle_id ORDER BY f.fuel_date DESC LIMIT 50")
        if d_logs:
            st.dataframe(pd.DataFrame(d_logs), hide_index=True, use_container_width=True, height=350)

# ==============================================================================
# 5. FULL-WIDTH DRIVER ADVANCES
# ==============================================================================
elif menu == "Driver Advances":
    drivers = get_cached_drivers()
    d_map = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers}
    
    col_a1, col_a2 = st.columns([1.5, 3.5])
    with col_a1:
        with st.form("adv_form", clear_on_submit=True):
            st.markdown('<div class="section-header">Direct Cash Advance</div>', unsafe_allow_html=True)
            ad_date = st.date_input("Advance Date*", date.today(), min_value=date(2020, 1, 1), max_value=date(2035, 12, 31))
            ad_drv = st.selectbox("Driver Account*", list(d_map.keys()))
            ad_amt = st.number_input("Advance Amount (₹)*", min_value=0.0, step=500.0)
            ad_cat = st.selectbox("Category", ["BATA_ADVANCE", "GENERAL_ADVANCE", "EMERGENCY_MEDICAL", "SALARY_ADVANCE"])
            ad_ref = st.text_input("Reference Note", placeholder="UPI / Voucher No")
            st.write("")
            if st.form_submit_button("Issue Advance", type="primary", use_container_width=True):
                if ad_amt > 0:
                    run_query("INSERT INTO driver_direct_advances (advance_date, driver_id, amount_inr, advance_type, reference_remarks) VALUES (%s, %s, %s, %s, %s)",
                              (ad_date, d_map[ad_drv]['driver_id'], ad_amt, ad_cat, ad_ref), fetch=False)
                    trigger_toast_and_rerun("SUCCESS", f"Advance of ₹{ad_amt:,.2f} recorded.")
                else:
                    show_error_toast("Advance amount must be greater than zero.")
    with col_a2:
        st.markdown('<div class="section-header">Direct Advance History</div>', unsafe_allow_html=True)
        adv_recs = run_query("SELECT a.advance_date, d.driver_code, d.full_name, a.amount_inr, a.advance_type, a.reference_remarks FROM driver_direct_advances a JOIN drivers d ON a.driver_id = d.driver_id ORDER BY a.advance_date DESC LIMIT 50")
        if adv_recs:
            st.dataframe(pd.DataFrame(adv_recs), hide_index=True, use_container_width=True, height=350)

# ==============================================================================
# 6. FULL-WIDTH MODIFY TRIPS & EXPENSES
# ==============================================================================
elif menu == "Modify Trips & Claims":
    trips = run_query("SELECT t.trip_id, t.trip_number, v.vehicle_number, d.full_name, t.origin, t.destination, t.trip_start_date, t.trip_end_date, t.start_km, t.end_km, t.total_km_run, t.unloaded_weight_mt, t.freight_revenue, t.fuel_litres, t.fuel_expense, t.driver_bata, t.cash_advance_issued, t.enroute_repairs_maintenance, t.trip_status FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id ORDER BY t.trip_id DESC LIMIT 50")
    if trips:
        t_opts = {f"LR: {t['trip_number']} | Truck: {t['vehicle_number']} | {t['origin']} ➔ {t['destination']} | Driver: {t['full_name']}": t for t in trips}
        sel_t = st.selectbox("Select Trip Record to Edit", list(t_opts.keys()))
        t_data = t_opts[sel_t]

        with st.form("mod_compact_form"):
            st.markdown('<div class="section-header">Edit Manifest, Freight & Direct Trip Costs</div>', unsafe_allow_html=True)
            m1, m2, m3, m4, m5 = st.columns(5)
            with m1:
                e_sdate = st.date_input("Start Date", t_data['trip_start_date'] or date.today(), min_value=date(2020, 1, 1), max_value=date(2035, 12, 31))
                e_edate = st.date_input("End Date", t_data['trip_end_date'] or date.today(), min_value=date(2020, 1, 1), max_value=date(2035, 12, 31))
            with m2:
                e_lr = st.text_input("Trip LR No", value=t_data['trip_number'])
                e_orig = st.text_input("Origin Hub", value=t_data['origin'])
            with m3:
                e_dest = st.text_input("Destination", value=t_data['destination'])
                e_ton = st.number_input("Billable MT", value=float(t_data['unloaded_weight_mt'] or 0.0), step=0.05)
            with m4:
                e_freight = st.number_input("Freight Revenue (₹)", value=float(t_data['freight_revenue'] or 0.0), step=100.0)
                e_fuel_l = st.number_input("Fuel Litres", value=float(t_data['fuel_litres'] or 0.0), step=5.0)
            with m5:
                e_bata = st.number_input("Driver Bata (₹)", value=float(t_data['driver_bata'] or 0.0), step=100.0)
                e_adv = st.number_input("Advance (₹)", value=float(t_data['cash_advance_issued'] or 0.0), step=500.0)

            st.write("")
            if st.form_submit_button("Commit Changes to Trip Record", type="primary", use_container_width=True):
                try:
                    run_query("""
                        UPDATE trips SET trip_start_date=%s, trip_end_date=%s, trip_number=%s, origin=%s, destination=%s, unloaded_weight_mt=%s, freight_revenue=%s,
                                         fuel_litres=%s, fuel_expense=%s, driver_bata=%s, cash_advance_issued=%s
                        WHERE trip_id=%s
                    """, (e_sdate, e_edate, e_lr, e_orig, e_dest, e_ton, e_freight, e_fuel_l, round(e_fuel_l * d_rate_fast, 2), e_bata, e_adv, t_data['trip_id']), fetch=False)
                    trigger_toast_and_rerun("SUCCESS", f"Trip record {e_lr} updated.")
                except Exception as e:
                    show_error_toast(f"Update failed: {e}")

# ==============================================================================
# 7. FULL-WIDTH DRIVER SETTLEMENT
# ==============================================================================
elif menu == "Driver Settlement":
    drivers = get_cached_drivers()
    if drivers:
        d_dict = {f"{d['driver_code']} - {d['full_name']}": d['driver_id'] for d in drivers}
        
        s1, s2, s3, s4 = st.columns([2, 1.2, 1.2, 1.5])
        with s1:
            sel_d_name = st.selectbox("Select Driver Account", list(d_dict.keys()))
            d_id = d_dict[sel_d_name]
        with s2:
            s_from = st.date_input("From Date", date.today().replace(day=1), min_value=date(2020, 1, 1), max_value=date(2035, 12, 31))
        with s3:
            s_to = st.date_input("To Date", date.today(), min_value=date(2020, 1, 1), max_value=date(2035, 12, 31))
        with s4:
            st.write("")
            btn_settle = st.button("Mark Period Settled", type="primary", use_container_width=True)

        trips_drv = run_query("SELECT trip_number, trip_end_date, origin, destination, total_km_run, driver_bata, cash_advance_issued, enroute_repairs_maintenance FROM trips WHERE primary_driver_id=%s AND trip_end_date>=%s AND trip_end_date<=%s", (d_id, s_from, s_to))
        adv_drv = run_query("SELECT advance_date, amount_inr, advance_type, reference_remarks FROM driver_direct_advances WHERE driver_id=%s AND advance_date>=%s AND advance_date<=%s", (d_id, s_from, s_to))

        df_t = pd.DataFrame(trips_drv) if trips_drv else pd.DataFrame(columns=["driver_bata", "cash_advance_issued", "enroute_repairs_maintenance"])
        df_a = pd.DataFrame(adv_drv) if adv_drv else pd.DataFrame(columns=["amount_inr"])

        tot_b = float(df_t['driver_bata'].sum() or 0.0) if not df_t.empty else 0.0
        tot_c = float(df_t['enroute_repairs_maintenance'].sum() or 0.0) if not df_t.empty else 0.0
        tot_adv = (float(df_t['cash_advance_issued'].sum() or 0.0) if not df_t.empty else 0.0) + (float(df_a['amount_inr'].sum() or 0.0) if not df_a.empty else 0.0)
        net_pay = (tot_b + tot_c) - tot_adv

        st.markdown('<div class="section-header">Cycle Settlement Position</div>', unsafe_allow_html=True)
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Earned Bata (₹)", f"₹{tot_b:,.2f}")
        m2.metric("Out-of-Pocket Claims (₹)", f"₹{tot_c:,.2f}")
        m3.metric("Advances Deducted (₹)", f"₹{tot_adv:,.2f}")
        m4.metric("Net Balance Payable (₹)", f"₹{net_pay:,.2f}")

        if trips_drv:
            st.dataframe(pd.DataFrame(trips_drv), hide_index=True, use_container_width=True, height=220)

        if btn_settle:
            try:
                run_query("UPDATE trips SET settlement_status='SETTLED' WHERE primary_driver_id=%s AND trip_end_date>=%s AND trip_end_date<=%s", (d_id, s_from, s_to), fetch=False)
                run_query("UPDATE driver_direct_advances SET is_settled=TRUE WHERE driver_id=%s AND advance_date>=%s AND advance_date<=%s", (d_id, s_from, s_to), fetch=False)
                trigger_toast_and_rerun("SUCCESS", f"Settlement reconciled for {sel_d_name}.")
            except Exception as e:
                show_error_toast(f"Settlement failed: {e}")

# ==============================================================================
# 8. FULL-WIDTH MASTER CONFIGURATION
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
                st.write("")
                if st.form_submit_button("Save Truck Master", type="primary", use_container_width=True):
                    if nv:
                        try:
                            run_query("INSERT INTO vehicles (vehicle_number, truck_type, carrying_capacity_tons, current_status) VALUES (%s, %s, %s, 'AVAILABLE_FOR_LOAD')", (nv, vt, vc), fetch=False)
                            get_cached_vehicles.clear()
                            trigger_toast_and_rerun("SUCCESS", f"Truck {nv} added to registry.")
                        except Exception as e:
                            show_error_toast(f"Truck insert failed: {e}")
                    else:
                        show_error_toast("Truck registration number is mandatory.")
        with c2:
            st.markdown('<div class="section-header">Registered Fleet Registry</div>', unsafe_allow_html=True)
            v_recs = get_cached_vehicles()
            if v_recs:
                df_v = pd.DataFrame(v_recs)
                cols = [c for c in ['vehicle_number', 'truck_type', 'carrying_capacity_tons', 'current_status'] if c in df_v.columns]
                st.dataframe(df_v[cols], hide_index=True, use_container_width=True, height=300)

    with t_d:
        c1, c2 = st.columns([1.5, 3.5])
        with c1:
            with st.form("quick_driver"):
                st.markdown('<div class="section-header">Add New Driver</div>', unsafe_allow_html=True)
                nd_c = st.text_input("Driver Code*", value=f"DRV-{len(get_cached_drivers(True))+1:03d}").strip().upper()
                nd_n = st.text_input("Full Name*").strip()
                nd_p = st.text_input("Phone Number*").strip()
                nd_l = st.text_input("License No*").strip().upper()
                nd_exp = st.date_input("License Expiry Date", date(2030, 1, 1), min_value=date(2000, 1, 1), max_value=date(2050, 12, 31))
                st.write("")
                if st.form_submit_button("Save Driver Master", type="primary", use_container_width=True):
                    if not nd_n or not nd_p:
                        show_error_toast("Driver Name and Phone Number are mandatory.")
                    else:
                        try:
                            final_code = nd_c
                            existing_code = run_query("SELECT driver_id FROM drivers WHERE LOWER(driver_code) = LOWER(%s)", (final_code,))
                            if existing_code:
                                max_drv = run_query("SELECT driver_id FROM drivers ORDER BY driver_id DESC LIMIT 1")
                                next_id = (max_drv[0]['driver_id'] + 1) if max_drv else 1
                                final_code = f"DRV-{next_id:03d}"

                            run_query("""
                                INSERT INTO drivers (driver_code, full_name, phone_number, license_number, license_expiry_date, branch_id) 
                                VALUES (%s, %s, %s, %s, %s, 1)
                                ON CONFLICT (driver_code) DO UPDATE 
                                SET full_name = EXCLUDED.full_name,
                                    phone_number = EXCLUDED.phone_number,
                                    license_number = EXCLUDED.license_number,
                                    license_expiry_date = EXCLUDED.license_expiry_date,
                                    is_active = TRUE;
                            """, (final_code, nd_n, nd_p, nd_l, nd_exp), fetch=False)
                            get_cached_drivers.clear()
                            trigger_toast_and_rerun("SUCCESS", f"Driver '{nd_n}' saved as {final_code}.")
                        except Exception as e:
                            show_error_toast(f"Error saving driver: {e}")
        with c2:
            st.markdown('<div class="section-header">Active Driver Directory</div>', unsafe_allow_html=True)
            d_recs = get_cached_drivers(True)
            if d_recs:
                df_d = pd.DataFrame(d_recs)
                cols = [c for c in ['driver_code', 'full_name', 'phone_number', 'license_number'] if c in df_d.columns]
                st.dataframe(df_d[cols], hide_index=True, use_container_width=True, height=300)

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
                    if dt and rt > 0:
                        try:
                            target_capacities = [25.0, 30.0] if cg == "BAG" else [cl]
                            for c_val in target_capacities:
                                run_query("""
                                    INSERT INTO destinations_freight_master (cargo_type, origin, destination_name, capacity_tons, freight_rate_per_ton, standard_km) 
                                    VALUES (%s, %s, %s, %s, %s, %s) 
                                    ON CONFLICT (cargo_type, origin, destination_name, capacity_tons) 
                                    DO UPDATE SET freight_rate_per_ton = EXCLUDED.freight_rate_per_ton, standard_km = EXCLUDED.standard_km;
                                """, (cg, so, dt, c_val, rt, km), fetch=False)
                            get_cached_routes.clear()
                            trigger_toast_and_rerun("SUCCESS", f"Freight slab {so} ➔ {dt} saved.")
                        except Exception as e:
                            show_error_toast(f"Route slab save failed: {e}")
                    else:
                        show_error_toast("Destination and freight rate are required.")
        with c2:
            st.markdown('<div class="section-header">Configured Freight Slabs</div>', unsafe_allow_html=True)
            r_recs = get_cached_routes()
            if r_recs:
                df_r = pd.DataFrame(r_recs)
                cols = [c for c in ['cargo_type', 'origin', 'destination_name', 'capacity_tons', 'freight_rate_per_ton', 'standard_km'] if c in df_r.columns]
                st.dataframe(df_r[cols], hide_index=True, use_container_width=True, height=300)

    with t_b:
        c1, c2 = st.columns([1.5, 3.5])
        vehicles = get_cached_vehicles()
        v_map = {f"{v['vehicle_number']} ({v['carrying_capacity_tons']} MT)": v for v in vehicles} if vehicles else {}
        with c1:
            with st.form("quick_bata"):
                st.markdown('<div class="section-header">Add Driver Bata Rule</div>', unsafe_allow_html=True)
                bd = st.text_input("Destination*", placeholder="SANKARI").strip().upper()
                bc = st.selectbox("Cargo", ["BULK", "BAG"])
                bv = st.selectbox("Target Truck", list(v_map.keys())) if v_map else None
                ba = st.number_input("Standard Bata (₹)*", min_value=0.0, step=100.0, value=3000.0)
                st.write("")
                if st.form_submit_button("Save Bata Rule", type="primary", use_container_width=True):
                    if bd and ba > 0 and bv:
                        try:
                            t_obj = v_map[bv]
                            run_query("INSERT INTO driver_bata_master (destination_name, cargo_type, vehicle_id, capacity_tons, standard_bata_inr) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (destination_name, cargo_type, vehicle_id) DO UPDATE SET standard_bata_inr=EXCLUDED.standard_bata_inr;", (bd, bc, t_obj['vehicle_id'], t_obj['carrying_capacity_tons'], ba), fetch=False)
                            get_cached_bata_rules.clear()
                            trigger_toast_and_rerun("SUCCESS", f"Bata rule for {bd} saved.")
                        except Exception as e:
                            show_error_toast(f"Bata save failed: {e}")
                    else:
                        show_error_toast("Destination, Truck, and Bata Amount are required.")
        with c2:
            st.markdown('<div class="section-header">Configured Driver Bata Master</div>', unsafe_allow_html=True)
            bata_list = get_cached_bata_rules()
            if bata_list:
                df_bata = pd.DataFrame(bata_list)
                cols_to_show = [c for c in ['destination_name', 'cargo_type', 'vehicle_number', 'capacity_tons', 'standard_bata_inr'] if c in df_bata.columns]
                st.dataframe(df_bata[cols_to_show], hide_index=True, use_container_width=True, height=300)
            else:
                st.info("No Driver Bata rules configured yet.")

# ==============================================================================
# 9. FULL-WIDTH EXECUTIVE RETENTION ANALYTICS
# ==============================================================================
elif menu == "Executive Retention Analytics":
    tfc1, tfc2, tfc3 = st.columns(3)
    with tfc1:
        report_period_type = st.selectbox("Analysis Window", [
            "Lifetime Fleet Analytics",
            "Current Fiscal Month",
            "Custom Operating Period"
        ])

    today = date.today()
    if report_period_type == "Current Fiscal Month":
        start_filter_date = today.replace(day=1)
        end_filter_date = today
    elif report_period_type == "Custom Operating Period":
        with tfc2:
            start_filter_date = st.date_input("Period From*", today.replace(day=1), min_value=date(2020, 1, 1), max_value=date(2035, 12, 31))
        with tfc3:
            end_filter_date = st.date_input("Period To*", today, min_value=date(2020, 1, 1), max_value=date(2035, 12, 31))
    else:
        start_filter_date = None
        end_filter_date = None

    tab_f, tab_d, tab_v = st.tabs(["📊 Fleet Unit Retention & Margins", "👨‍✈️ Driver Performance Scorecard", "⚖️ Variant Peer Benchmarks"])
    
    base_where = "WHERE v.is_active = TRUE"
    date_params = []
    if start_filter_date and end_filter_date:
        base_where += " AND t.trip_end_date >= %s AND t.trip_end_date <= %s"
        date_params.extend([start_filter_date, end_filter_date])

    with tab_f:
        fleet_data = run_query(f"""
            SELECT v.vehicle_number, v.truck_type, v.carrying_capacity_tons,
                   COUNT(t.trip_id) AS trips,
                   COALESCE(SUM(t.total_km_run), 0.00) AS total_km,
                   COALESCE(SUM(COALESCE(t.unloaded_weight_mt, t.loaded_weight_mt)), 0.00) AS total_mt,
                   COALESCE(SUM(t.freight_revenue), 0.00) AS revenue,
                   COALESCE(SUM(t.fuel_expense + t.driver_bata + t.enroute_repairs_maintenance), 0.00) AS direct_costs,
                   COALESCE(SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.enroute_repairs_maintenance)), 0.00) AS net_profit,
                   ROUND((COALESCE(SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.enroute_repairs_maintenance)), 0.00) / NULLIF(SUM(t.freight_revenue), 0.00)) * 100.0, 2) AS margin_pct,
                   ROUND(SUM(t.total_km_run) / NULLIF(SUM(t.fuel_litres), 0.00), 2) AS kmpl
            FROM vehicles v LEFT JOIN trips t ON v.vehicle_id = t.vehicle_id
            {base_where} GROUP BY v.vehicle_number, v.truck_type, v.carrying_capacity_tons ORDER BY net_profit DESC;
        """, tuple(date_params) if date_params else None)
        
        if fleet_data:
            df_fl = pd.DataFrame(fleet_data)
            tot_r = float(df_fl['revenue'].sum() or 0.0)
            tot_p = float(df_fl['net_profit'].sum() or 0.0)
            tot_km = float(df_fl['total_km'].sum() or 0.0)
            avg_m = round((tot_p / max(1.0, tot_r)) * 100.0, 2) if tot_r > 0 else 0.0

            k1, k2, k3, k4 = st.columns(4)
            k1.metric("Gross Fleet Revenue", f"₹{tot_r:,.2f}")
            k2.metric("Net Retained Margin", f"₹{tot_p:,.2f}")
            k3.metric("Fleet Margin %", f"{avg_m:.2f}%")
            k4.metric("Total Kilometres Run", f"{tot_km:,.0f} KM")
            st.dataframe(df_fl, hide_index=True, use_container_width=True, height=350)

    with tab_d:
        drv_where = "WHERE d.is_active = TRUE"
        drv_params = []
        if start_filter_date and end_filter_date:
            drv_where += " AND t.trip_end_date >= %s AND t.trip_end_date <= %s"
            drv_params.extend([start_filter_date, end_filter_date])

        drv_data = run_query(f"""
            SELECT d.driver_code, d.full_name, COUNT(t.trip_id) AS trips,
                   COALESCE(SUM(t.total_km_run), 0.00) AS total_km,
                   COALESCE(SUM(COALESCE(t.unloaded_weight_mt, t.loaded_weight_mt)), 0.00) AS total_mt,
                   ROUND(SUM(t.total_km_run) / NULLIF(SUM(t.fuel_litres), 0.00), 2) AS kmpl,
                   COALESCE(SUM(t.shortage_mt), 0.00) AS shortage_mt,
                   COALESCE(SUM(t.freight_revenue), 0.00) AS revenue,
                   COALESCE(SUM(t.driver_bata), 0.00) AS bata_earned
            FROM drivers d LEFT JOIN trips t ON d.driver_id = t.primary_driver_id
            {drv_where} GROUP BY d.driver_code, d.full_name ORDER BY revenue DESC;
        """, tuple(drv_params) if drv_params else None)
        if drv_data:
            st.dataframe(pd.DataFrame(drv_data), hide_index=True, use_container_width=True, height=350)

    with tab_v:
        if fleet_data:
            df_fl = pd.DataFrame(fleet_data)
            all_v = sorted(list(set(df_fl['truck_type'].tolist())))
            sel_v = st.selectbox("Select Variant to Compare (e.g. 30MT vs 30MT)", ["All Variants"] + all_v)
            df_peer = df_fl if sel_v == "All Variants" else df_fl[df_fl['truck_type'] == sel_v]
            st.dataframe(df_peer, hide_index=True, use_container_width=True, height=350)

# ==============================================================================
# 10. FULL-WIDTH AUDIT LOG
# ==============================================================================
elif menu == "Audit Log":
    all_trips = run_query("""
        SELECT t.trip_id, t.trip_number, t.pod_number, t.trip_start_date, v.vehicle_number, d.full_name AS driver,
               t.origin, t.destination, t.unloaded_weight_mt, t.freight_revenue, t.fuel_expense, t.driver_bata,
               (t.freight_revenue - (t.fuel_expense + t.driver_bata + t.enroute_repairs_maintenance)) AS net_profit, t.trip_status
        FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id
        ORDER BY t.trip_id DESC LIMIT 100;
    """)
    if all_trips:
        st.dataframe(pd.DataFrame(all_trips), hide_index=True, use_container_width=True, height=450)
