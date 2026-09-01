import streamlit as st
import pandas as pd
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from datetime import date
import io

# --- High-Density Page Configuration ---
st.set_page_config(
    page_title="Fleet Operations ERP",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# --- Ultra-Compact CSS Injection ---
st.markdown("""
<style>
    .reportview-container .main .block-container, .main .block-container {
        padding-top: 0.5rem !important;
        padding-bottom: 0.5rem !important;
        padding-left: 1rem !important;
        padding-right: 1rem !important;
        max-width: 100% !important;
    }
    header {visibility: hidden; display: none !important;}
    #MainMenu {visibility: hidden; display: none !important;}
    footer {visibility: hidden; display: none !important;}
    
    div[data-testid="stMetricValue"] {
        font-size: 1.05rem !important;
        font-weight: 700 !important;
        color: #0F172A !important;
    }
    div[data-testid="stMetricLabel"] {
        font-size: 0.72rem !important;
        font-weight: 600 !important;
        color: #64748B !important;
        text-transform: uppercase !important;
    }
    .section-header {
        font-size: 0.88rem !important;
        font-weight: 700 !important;
        color: #1E293B !important;
        border-bottom: 1.5px solid #CBD5E1 !important;
        padding-bottom: 2px !important;
        margin-top: 4px !important;
        margin-bottom: 6px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.4px !important;
    }
    .stTextInput>div>div>input, .stNumberInput>div>div>input, .stSelectbox>div>div>div {
        min-height: 28px !important;
        height: 30px !important;
        padding: 2px 8px !important;
        font-size: 0.85rem !important;
    }
    .stButton>button {
        height: 32px !important;
        padding: 2px 14px !important;
        font-size: 0.85rem !important;
        font-weight: 600 !important;
    }
    div[data-testid="stForm"] {
        padding: 8px 12px !important;
        border: 1px solid #E2E8F0 !important;
        border-radius: 6px !important;
        margin-bottom: 4px !important;
    }
    div[data-testid="stAlert"] {
        padding: 4px 10px !important;
        margin-bottom: 4px !important;
    }
    .element-container {
        margin-bottom: 0.25rem !important;
    }
</style>
""", unsafe_allow_html=True)

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
                conn.commit()
                result = None
        return result
    finally:
        db_pool.putconn(conn)

# --- Fast Caching ---
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
    if capacity:
        query += " AND capacity_tons = %s"
        params.append(capacity)
    if origin:
        query += " AND UPPER(origin) = UPPER(%s)"
        params.append(origin.strip())
    query += " ORDER BY destination_name ASC"
    return run_query(query, tuple(params))

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
    "AVAILABLE_FOR_LOAD": "Available",
    "WAITING_FOR_LOAD": "Plant Loading",
    "IN_TRANSIT": "In Transit",
    "WAITING_FOR_UNLOAD": "Site Unloading",
    "WORKSHOP_MAINTENANCE": "Workshop",
    "DRIVER_UNAVAILABLE": "No Driver"
}

STANDARD_SOURCES = ["COCHIN", "POTTANERI", "METTUR", "UDUPPI", "COCHIN-ACC", "TUTICORIN", "CUSTOM"]

# --- Compact Top Navigation Ribbon ---
nav_col1, nav_col2, nav_col3 = st.columns([1.5, 3.5, 1])
with nav_col1:
    st.markdown("<h4 style='margin:0; padding:0; font-size:1.05rem;'>Fleet ERP System</h4>", unsafe_allow_html=True)
with nav_col2:
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
with nav_col3:
    current_d_rate = get_cached_diesel_rate()
    d_rate_fast = st.number_input("Diesel INR/L", value=current_d_rate, step=0.1, label_visibility="collapsed")
    if d_rate_fast != current_d_rate:
        set_saved_diesel_rate(d_rate_fast)

# ==============================================================================
# 1. COMPACT TRIP DISPATCH ENTRY
# ==============================================================================
if menu == "Trip Dispatch Entry":
    vehicles = get_cached_vehicles()
    drivers = get_cached_drivers()

    if not vehicles or not drivers:
        st.error("Configure vehicles and drivers in Master Configuration first.")
        st.stop()

    if "form_reset_counter" not in st.session_state:
        st.session_state.form_reset_counter = 0

    cnt = st.session_state.form_reset_counter

    # Row 1: Manifest Basics
    r1_c1, r1_c2, r1_c3, r1_c4, r1_c5 = st.columns([1.2, 1.3, 1.8, 1.2, 1.5])
    with r1_c1:
        start_date = st.date_input("1. Trip Date*", date.today(), key=f"sdate_{cnt}")
    with r1_c2:
        lr_no = st.text_input("2. LR Number*", placeholder="LR-XXXX", key=f"lr_{cnt}").strip().upper()
        if lr_no and check_lr_exists(lr_no):
            st.error(f"Duplicate LR: {lr_no}")

    vehicle_map = {f"{v['vehicle_number']} ({v['truck_type']} | {v['carrying_capacity_tons']} MT)": v for v in vehicles}
    with r1_c3:
        sel_veh_label = st.selectbox("3. Truck*", list(vehicle_map.keys()), key=f"veh_sel_{cnt}")
        active_veh = vehicle_map[sel_veh_label]
        v_class_mt = float(active_veh['carrying_capacity_tons'])
        last_drv_id = get_last_driver_for_vehicle(active_veh['vehicle_id'])
    with r1_c4:
        cargo_category = st.selectbox("Cargo", ["BULK", "BAG"], key=f"cargo_sel_{cnt}")
    with r1_c5:
        chosen_source_opt = st.selectbox("4. Source*", STANDARD_SOURCES, key=f"src_sel_{cnt}")
        origin_terminal = st.text_input("Custom Source", placeholder="Enter Source").strip().upper() if chosen_source_opt == "CUSTOM" else chosen_source_opt

    # Row 2: Route, Driver & Payload
    routes_from_source = get_cached_routes(cargo_type=cargo_category, capacity=v_class_mt, origin=origin_terminal)
    dest_options = {}
    if routes_from_source:
        for r in routes_from_source:
            lbl = f"{r['destination_name']} [INR {r['freight_rate_per_ton']}/MT | {r['standard_km']} KM]"
            dest_options[lbl] = r
    dest_options["-- MANUAL DESTINATION --"] = {"origin": origin_terminal, "destination_name": "", "standard_km": 0.0, "freight_rate_per_ton": 0.0}

    r2_c1, r2_c2, r2_c3, r2_c4 = st.columns([2, 1.8, 1.1, 1.1])
    with r2_c1:
        sel_dest_label = st.selectbox(f"5. Destination ({origin_terminal})*", list(dest_options.keys()), key=f"dest_sel_{cnt}")
        active_route = dest_options[sel_dest_label]
        is_spot = (sel_dest_label == "-- MANUAL DESTINATION --")
        if is_spot:
            dest_terminal = st.text_input("Destination Name*", placeholder="e.g. SANKARI").strip().upper()
            agreed_rate_mt = st.number_input("Rate/MT*", min_value=0.0, step=25.0, value=0.0, key=f"spot_rate_{cnt}")
            standard_route_km = st.number_input("Route KM", min_value=0.0, step=10.0, value=0.0, key=f"spot_km_{cnt}")
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
        chosen_driver_str = st.selectbox("6. Driver*", list(driver_dict.keys()), index=default_driver_index, key=f"drv_{cnt}")
        sel_driver_obj = driver_dict[chosen_driver_str]
    with r2_c3:
        weighbridge_mt = st.number_input("7. Weight MT*", min_value=0.0, max_value=60.0, step=0.05, value=v_class_mt, key=f"wmt_{cnt}")
    with r2_c4:
        gross_freight = round(weighbridge_mt * agreed_rate_mt, 2)
        st.metric("Auto Freight", f"₹{gross_freight:,.2f}")

    # Row 3: Fuel, Bata & Financials
    master_bata_val = lookup_driver_bata(dest_terminal, cargo_category, active_veh['vehicle_id'])
    r3_c1, r3_c2, r3_c3, r3_c4, r3_c5, r3_c6 = st.columns(6)
    with r3_c1:
        driver_bata = st.number_input("8. Driver Bata*", min_value=0.0, step=100.0, value=master_bata_val, key=f"bata_{cnt}")
    with r3_c2:
        fuel_qty = st.number_input("9. Diesel Litres*", min_value=0.0, step=10.0, value=0.0, key=f"fqty_{cnt}")
    with r3_c3:
        gross_fuel_cost = round(fuel_qty * d_rate_fast, 2)
        st.metric("Diesel Cost", f"₹{gross_fuel_cost:,.2f}")
    with r3_c4:
        start_km = st.number_input("Start KM", min_value=0.0, step=10.0, value=0.0, key=f"skm_{cnt}")
    with r3_c5:
        end_km = st.number_input("End KM", min_value=0.0, step=10.0, value=0.0, key=f"ekm_{cnt}")
        computed_km = max(0.0, end_km - start_km) if (end_km >= start_km and end_km > 0) else standard_route_km
    with r3_c6:
        cash_advance = st.number_input("Trip Advance INR", min_value=0.0, step=500.0, value=0.0, key=f"adv_{cnt}")

    if st.button("Save & Dispatch Trip", type="primary", use_container_width=True):
        if not lr_no or not dest_terminal or not origin_terminal:
            st.error("LR Number, Source, and Destination are mandatory.")
        elif check_lr_exists(lr_no):
            st.error(f"LR {lr_no} already exists.")
        else:
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
            trip_id_created = new_t[0]['trip_id']
            if fuel_qty > 0:
                run_query("""
                    INSERT INTO diesel_fuel_logs (fuel_date, vehicle_id, trip_id, lr_number, diesel_category, litres_filled, diesel_rate_per_litre, total_fuel_cost)
                    VALUES (%s, %s, %s, %s, 'TRIP_DIESEL', %s, %s, %s);
                """, (start_date, active_veh['vehicle_id'], trip_id_created, lr_no, fuel_qty, d_rate_fast, gross_fuel_cost), fetch=False)

            run_query("UPDATE vehicles SET current_status = 'IN_TRANSIT', status_remarks = %s WHERE vehicle_id = %s",
                      (f"Trip {lr_no}: {origin_terminal} ➔ {dest_terminal}", active_veh['vehicle_id']), fetch=False)
            get_cached_vehicles.clear()
            st.session_state.form_reset_counter += 1
            st.success(f"Dispatched Trip {lr_no}.")
            st.rerun()

# ==============================================================================
# 2. POD RECEIVE & COMPACT TRIP CLOSURE
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
        trip_opts = {f"{t['trip_number']} | {t['vehicle_number']} | {t['origin']} ➔ {t['destination']} | {t['driver_name']}": t for t in active_trips}
        chosen_lr = st.selectbox("Select Active Trip to Close", list(trip_opts.keys()))
        t_cur = trip_opts[chosen_lr]

        known_rate = run_query("SELECT freight_rate_per_ton FROM destinations_freight_master WHERE LOWER(origin)=LOWER(%s) AND LOWER(destination_name)=LOWER(%s) AND capacity_tons=%s LIMIT 1",
                               (t_cur['origin'], t_cur['destination'], t_cur['carrying_capacity_tons']))
        applied_rate = float(known_rate[0]['freight_rate_per_ton']) if known_rate else round(float(t_cur['freight_revenue'] or 0.0)/max(0.01, float(t_cur['loaded_weight_mt'] or 1.0)), 2)

        with st.form("pod_compact_form"):
            p1, p2, p3, p4, p5 = st.columns([1.5, 1.2, 1.2, 1.2, 1.5])
            with p1:
                pod_no = st.text_input("POD No*", placeholder="POD-XXXX").strip().upper()
                close_d = st.date_input("Closing Date", date.today())
            with p2:
                unloaded_wt = st.number_input("Unloaded MT*", min_value=0.0, max_value=60.0, value=float(t_cur['loaded_weight_mt']), step=0.01)
                shortage = max(0.0, float(t_cur['loaded_weight_mt']) - unloaded_wt)
            with p3:
                final_km = st.number_input("Closing KM*", min_value=float(t_cur['start_km'] or 0.0), value=float(t_cur['end_km'] or (float(t_cur['start_km'] or 0.0) + float(t_cur['total_km_run'] or 0.0))), step=10.0)
                tot_km = max(0.0, final_km - float(t_cur['start_km'] or 0.0))
            with p4:
                halt_bata = st.number_input("Halt Bata INR", min_value=0.0, value=0.0, step=100.0)
                tot_bata = float(t_cur['driver_bata'] or 0.0) + halt_bata
            with p5:
                claims = st.number_input("En-route Claims INR", min_value=0.0, value=0.0, step=50.0)
                final_freight = round(unloaded_wt * applied_rate, 2)

            if st.form_submit_button("Close Trip & Release Truck", type="primary", use_container_width=True):
                if not pod_no:
                    st.error("POD No required.")
                else:
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
                    st.success(f"Trip {t_cur['trip_number']} closed. Truck released.")
                    st.rerun()

# ==============================================================================
# 3. COMPACT FLEET STATUS BOARD
# ==============================================================================
elif menu == "Fleet Status Board":
    vehicles = get_cached_vehicles()
    if vehicles:
        df_v = pd.DataFrame(vehicles)
        df_v['status_lbl'] = df_v['current_status'].map(lambda x: STATUS_OPTIONS.get(x, x))
        
        c1, c2, c3, c4, c5, c6 = st.columns(6)
        c1.metric("Available", len(df_v[df_v['current_status'] == 'AVAILABLE_FOR_LOAD']))
        c2.metric("Plant Loading", len(df_v[df_v['current_status'] == 'WAITING_FOR_LOAD']))
        c3.metric("In Transit", len(df_v[df_v['current_status'] == 'IN_TRANSIT']))
        c4.metric("Site Unloading", len(df_v[df_v['current_status'] == 'WAITING_FOR_UNLOAD']))
        c5.metric("In Workshop", len(df_v[df_v['current_status'] == 'WORKSHOP_MAINTENANCE']))
        c6.metric("No Driver", len(df_v[df_v['current_status'] == 'DRIVER_UNAVAILABLE']))

        v_col1, v_col2 = st.columns([2.5, 1.2])
        with v_col1:
            st.dataframe(df_v[['vehicle_number', 'truck_type', 'carrying_capacity_tons', 'status_lbl', 'status_remarks']],
                         column_config={"vehicle_number": "Truck", "truck_type": "Variant", "carrying_capacity_tons": "Class", "status_lbl": "Status", "status_remarks": "Location"},
                         hide_index=True, use_container_width=True, height=280)
        with v_col2:
            with st.form("quick_stat_form"):
                v_map = {v['vehicle_number']: v for v in vehicles}
                target_veh_no = st.selectbox("Truck", list(v_map.keys()))
                target_v = v_map[target_veh_no]
                new_st = st.selectbox("Status", list(STATUS_OPTIONS.keys()), format_func=lambda x: STATUS_OPTIONS[x])
                new_rem = st.text_input("Location / Remark", value=target_v['status_remarks'] or "")
                if st.form_submit_button("Update", use_container_width=True):
                    run_query("UPDATE vehicles SET current_status = %s, status_remarks = %s WHERE vehicle_id = %s", (new_st, new_rem, target_v['vehicle_id']), fetch=False)
                    get_cached_vehicles.clear()
                    st.rerun()

# ==============================================================================
# 4. COMPACT DIESEL LOGS
# ==============================================================================
elif menu == "Diesel Logs":
    vehicles = get_cached_vehicles()
    v_dict = {v['vehicle_number']: v for v in vehicles}
    
    col_d1, col_d2 = st.columns([1.2, 2])
    with col_d1:
        with st.form("d_entry_form", clear_on_submit=True):
            st.markdown('<div class="section-header">Record Diesel Issue</div>', unsafe_allow_html=True)
            f_date = st.date_input("Date", date.today())
            f_veh = st.selectbox("Truck", list(v_dict.keys()))
            f_cat = st.selectbox("Category", ["TRIP_DIESEL", "SUNDRY_DIESEL"])
            f_lr = st.text_input("LR No (Optional)", placeholder="LR-XXXX").strip().upper()
            f_l = st.number_input("Litres Filled*", min_value=0.0, step=10.0)
            f_cost = round(f_l * d_rate_fast, 2)
            st.metric("Fuel Cost", f"₹{f_cost:,.2f}")
            if st.form_submit_button("Save Diesel Log", type="primary", use_container_width=True):
                if f_l > 0:
                    run_query("INSERT INTO diesel_fuel_logs (fuel_date, vehicle_id, lr_number, diesel_category, litres_filled, diesel_rate_per_litre, total_fuel_cost) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                              (f_date, v_dict[f_veh]['vehicle_id'], f_lr or "SUNDRY", f_cat, f_l, d_rate_fast, f_cost), fetch=False)
                    st.rerun()
    with col_d2:
        d_logs = run_query("SELECT f.fuel_date, v.vehicle_number, f.diesel_category, f.lr_number, f.litres_filled, f.total_fuel_cost FROM diesel_fuel_logs f JOIN vehicles v ON f.vehicle_id = v.vehicle_id ORDER BY f.fuel_date DESC LIMIT 50")
        if d_logs:
            st.dataframe(pd.DataFrame(d_logs), hide_index=True, use_container_width=True, height=280)

# ==============================================================================
# 5. COMPACT DRIVER ADVANCES
# ==============================================================================
elif menu == "Driver Advances":
    drivers = get_cached_drivers()
    d_map = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers}
    
    col_a1, col_a2 = st.columns([1.2, 2])
    with col_a1:
        with st.form("adv_form", clear_on_submit=True):
            st.markdown('<div class="section-header">Direct Driver Advance</div>', unsafe_allow_html=True)
            ad_date = st.date_input("Date", date.today())
            ad_drv = st.selectbox("Driver", list(d_map.keys()))
            ad_amt = st.number_input("Amount INR*", min_value=0.0, step=500.0)
            ad_cat = st.selectbox("Category", ["BATA_ADVANCE", "GENERAL_ADVANCE", "EMERGENCY_MEDICAL", "SALARY_ADVANCE"])
            ad_ref = st.text_input("Ref / UPI Note", placeholder="UPI / Slip No")
            if st.form_submit_button("Save Advance", type="primary", use_container_width=True):
                if ad_amt > 0:
                    run_query("INSERT INTO driver_direct_advances (advance_date, driver_id, amount_inr, advance_type, reference_remarks) VALUES (%s, %s, %s, %s, %s)",
                              (ad_date, d_map[ad_drv]['driver_id'], ad_amt, ad_cat, ad_ref), fetch=False)
                    st.rerun()
    with col_a2:
        adv_recs = run_query("SELECT a.advance_date, d.driver_code, d.full_name, a.amount_inr, a.advance_type, a.reference_remarks FROM driver_direct_advances a JOIN drivers d ON a.driver_id = d.driver_id ORDER BY a.advance_date DESC LIMIT 50")
        if adv_recs:
            st.dataframe(pd.DataFrame(adv_recs), hide_index=True, use_container_width=True, height=280)

# ==============================================================================
# 6. COMPACT MODIFY TRIPS & EXPENSES
# ==============================================================================
elif menu == "Modify Trips & Claims":
    trips = run_query("SELECT t.trip_id, t.trip_number, v.vehicle_number, d.full_name, t.origin, t.destination, t.trip_start_date, t.start_km, t.end_km, t.total_km_run, t.unloaded_weight_mt, t.freight_revenue, t.fuel_litres, t.fuel_expense, t.driver_bata, t.cash_advance_issued, t.enroute_repairs_maintenance, t.trip_status FROM trips t JOIN vehicles v ON t.vehicle_id = v.vehicle_id JOIN drivers d ON t.primary_driver_id = d.driver_id ORDER BY t.trip_id DESC LIMIT 50")
    if trips:
        t_opts = {f"{t['trip_number']} | {t['vehicle_number']} | {t['origin']} ➔ {t['destination']} | {t['full_name']}": t for t in trips}
        sel_t = st.selectbox("Select Trip", list(t_opts.keys()))
        t_data = t_opts[sel_t]

        with st.form("mod_compact_form"):
            m1, m2, m3, m4, m5 = st.columns(5)
            with m1:
                e_lr = st.text_input("LR No", value=t_data['trip_number'])
                e_orig = st.text_input("Source", value=t_data['origin'])
            with m2:
                e_dest = st.text_input("Destination", value=t_data['destination'])
                e_ton = st.number_input("MT", value=float(t_data['unloaded_weight_mt'] or 0.0), step=0.05)
            with m3:
                e_freight = st.number_input("Freight INR", value=float(t_data['freight_revenue'] or 0.0), step=100.0)
                e_fuel_l = st.number_input("Fuel Litres", value=float(t_data['fuel_litres'] or 0.0), step=5.0)
            with m4:
                e_bata = st.number_input("Driver Bata", value=float(t_data['driver_bata'] or 0.0), step=100.0)
                e_adv = st.number_input("Advance INR", value=float(t_data['cash_advance_issued'] or 0.0), step=500.0)
            with m5:
                e_rep = st.number_input("Claims INR", value=float(t_data['enroute_repairs_maintenance'] or 0.0), step=50.0)
                e_km = st.number_input("Total KM", value=float(t_data['total_km_run'] or 0.0), step=10.0)

            if st.form_submit_button("Update Trip Record", type="primary", use_container_width=True):
                run_query("""
                    UPDATE trips SET trip_number=%s, origin=%s, destination=%s, unloaded_weight_mt=%s, freight_revenue=%s,
                                     fuel_litres=%s, fuel_expense=%s, driver_bata=%s, cash_advance_issued=%s, enroute_repairs_maintenance=%s, total_km_run=%s
                    WHERE trip_id=%s
                """, (e_lr, e_orig, e_dest, e_ton, e_freight, e_fuel_l, round(e_fuel_l * d_rate_fast, 2), e_bata, e_adv, e_rep, e_km, t_data['trip_id']), fetch=False)
                st.success("Trip updated.")
                st.rerun()

# ==============================================================================
# 7. COMPACT DRIVER SETTLEMENT
# ==============================================================================
elif menu == "Driver Settlement":
    drivers = get_cached_drivers()
    if drivers:
        d_dict = {f"{d['driver_code']} - {d['full_name']}": d['driver_id'] for d in drivers}
        
        s1, s2, s3, s4 = st.columns([1.5, 1, 1, 1])
        with s1:
            sel_d_name = st.selectbox("Driver", list(d_dict.keys()))
            d_id = d_dict[sel_d_name]
        with s2:
            s_from = st.date_input("From Date", date.today().replace(day=1))
        with s3:
            s_to = st.date_input("To Date", date.today())
        with s4:
            st.write("")
            btn_settle = st.button("Mark All Settled", type="primary", use_container_width=True)

        trips_drv = run_query("SELECT trip_number, trip_end_date, origin, destination, total_km_run, driver_bata, cash_advance_issued, enroute_repairs_maintenance FROM trips WHERE primary_driver_id=%s AND trip_end_date>=%s AND trip_end_date<=%s", (d_id, s_from, s_to))
        adv_drv = run_query("SELECT advance_date, amount_inr, advance_type, reference_remarks FROM driver_direct_advances WHERE driver_id=%s AND advance_date>=%s AND advance_date<=%s", (d_id, s_from, s_to))

        df_t = pd.DataFrame(trips_drv) if trips_drv else pd.DataFrame(columns=["driver_bata", "cash_advance_issued", "enroute_repairs_maintenance"])
        df_a = pd.DataFrame(adv_drv) if adv_drv else pd.DataFrame(columns=["amount_inr"])

        tot_b = float(df_t['driver_bata'].sum() or 0.0) if not df_t.empty else 0.0
        tot_c = float(df_t['enroute_repairs_maintenance'].sum() or 0.0) if not df_t.empty else 0.0
        tot_adv = (float(df_t['cash_advance_issued'].sum() or 0.0) if not df_t.empty else 0.0) + (float(df_a['amount_inr'].sum() or 0.0) if not df_a.empty else 0.0)
        net_pay = (tot_b + tot_c) - tot_adv

        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Earned Bata", f"₹{tot_b:,.2f}")
        m2.metric("Trip Claims", f"₹{tot_c:,.2f}")
        m3.metric("Advances Deducted", f"₹{tot_adv:,.2f}")
        m4.metric("Net Balance Payable", f"₹{net_pay:,.2f}")

        if trips_drv:
            st.dataframe(pd.DataFrame(trips_drv), hide_index=True, use_container_width=True, height=180)

        if btn_settle:
            run_query("UPDATE trips SET settlement_status='SETTLED' WHERE primary_driver_id=%s AND trip_end_date>=%s AND trip_end_date<=%s", (d_id, s_from, s_to), fetch=False)
            run_query("UPDATE driver_direct_advances SET is_settled=TRUE WHERE driver_id=%s AND advance_date>=%s AND advance_date<=%s", (d_id, s_from, s_to), fetch=False)
            st.success("Reconciled & Settled.")
            st.rerun()

# ==============================================================================
# 8. COMPACT MASTER CONFIGURATION
# ==============================================================================
elif menu == "Master Configuration":
    t_v, t_d, t_r, t_b = st.tabs(["Trucks", "Drivers", "Freight Slabs", "Driver Bata"])
    
    with t_v:
        c1, c2 = st.columns([1.2, 2])
        with c1:
            with st.form("quick_truck"):
                nv = st.text_input("Truck No*", placeholder="KL43Q3608").upper().strip()
                vt = st.selectbox("Variant", ["Bulker (16-Wheel)", "Bulker (14-Wheel)", "Bulker", "Body Truck"])
                vc = st.selectbox("Class MT", [25.0, 30.0, 35.0], index=2)
                if st.form_submit_button("Save Truck", use_container_width=True):
                    if nv:
                        run_query("INSERT INTO vehicles (vehicle_number, truck_type, carrying_capacity_tons, current_status) VALUES (%s, %s, %s, 'AVAILABLE_FOR_LOAD')", (nv, vt, vc), fetch=False)
                        get_cached_vehicles.clear()
                        st.rerun()
        with c2:
            st.dataframe(pd.DataFrame(get_cached_vehicles())[['vehicle_number', 'truck_type', 'carrying_capacity_tons', 'current_status']], hide_index=True, use_container_width=True, height=220)

    with t_d:
        c1, c2 = st.columns([1.2, 2])
        with c1:
            with st.form("quick_driver"):
                nd_c = st.text_input("Code*", value=f"DRV-{len(get_cached_drivers(True))+1:03d}").strip().upper()
                nd_n = st.text_input("Name*").strip()
                nd_p = st.text_input("Phone*").strip()
                nd_l = st.text_input("License*").strip().upper()
                if st.form_submit_button("Save Driver", use_container_width=True):
                    if nd_n and nd_p:
                        run_query("INSERT INTO drivers (driver_code, full_name, phone_number, license_number, branch_id) VALUES (%s, %s, %s, %s, 1)", (nd_c, nd_n, nd_p, nd_l), fetch=False)
                        get_cached_drivers.clear()
                        st.rerun()
        with c2:
            st.dataframe(pd.DataFrame(get_cached_drivers(True))[['driver_code', 'full_name', 'phone_number', 'license_number']], hide_index=True, use_container_width=True, height=220)

    with t_r:
        c1, c2 = st.columns([1.2, 2])
        with c1:
            with st.form("quick_slab"):
                cg = st.selectbox("Cargo", ["BULK", "BAG"])
                so = st.selectbox("Source", STANDARD_SOURCES)
                dt = st.text_input("Destination*").strip().upper()
                cl = st.selectbox("Class MT", [25.0, 30.0, 35.0], index=2)
                rt = st.number_input("Rate/MT*", min_value=0.0, step=25.0)
                km = st.number_input("KM", min_value=0.0, step=10.0)
                if st.form_submit_button("Save Slab", use_container_width=True):
                    if dt and rt > 0:
                        run_query("INSERT INTO destinations_freight_master (cargo_type, origin, destination_name, capacity_tons, freight_rate_per_ton, standard_km) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (cargo_type, origin, destination_name, capacity_tons) DO UPDATE SET freight_rate_per_ton=EXCLUDED.freight_rate_per_ton, standard_km=EXCLUDED.standard_km;", (cg, so, dt, cl, rt, km), fetch=False)
                        get_cached_routes.clear()
                        st.rerun()
        with c2:
            st.dataframe(pd.DataFrame(get_cached_routes())[['cargo_type', 'origin', 'destination_name', 'capacity_tons', 'freight_rate_per_ton', 'standard_km']], hide_index=True, use_container_width=True, height=220)

    with t_b:
        c1, c2 = st.columns([1.2, 2])
        vehicles = get_cached_vehicles()
        v_map = {f"{v['vehicle_number']} ({v['carrying_capacity_tons']} MT)": v for v in vehicles}
        with c1:
            with st.form("quick_bata"):
                bd = st.text_input("Destination*", placeholder="SANKARI").strip().upper()
                bc = st.selectbox("Cargo", ["BULK", "BAG"])
                bv = st.selectbox("Truck", list(v_map.keys()))
                ba = st.number_input("Bata INR*", min_value=0.0, step=100.0, value=3000.0)
                if st.form_submit_button("Save Bata Rule", use_container_width=True):
                    if bd and ba > 0:
                        t_obj = v_map[bv]
                        run_query("INSERT INTO driver_bata_master (destination_name, cargo_type, vehicle_id, capacity_tons, standard_bata_inr) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (destination_name, cargo_type, vehicle_id) DO UPDATE SET standard_bata_inr=EXCLUDED.standard_bata_inr;", (bd, bc, t_obj['vehicle_id'], t_obj['carrying_capacity_tons'], ba), fetch=False)
                        get_cached_bata_rules.clear()
                        st.rerun()
        with c2:
            st.dataframe(pd.DataFrame(get_cached_bata_rules())[['destination_name', 'cargo_type', 'vehicle_number', 'capacity_tons', 'standard_bata_inr']], hide_index=True, use_container_width=True, height=220)

# ==============================================================================
# 9. COMPACT EXECUTIVE RETENTION ANALYTICS
# ==============================================================================
elif menu == "Executive Retention Analytics":
    tab_f, tab_d, tab_v = st.tabs(["Fleet Yield", "Driver Scorecard", "Peer Benchmark"])
    
    with tab_f:
        fleet_data = run_query("""
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
            WHERE v.is_active = TRUE GROUP BY v.vehicle_number, v.truck_type, v.carrying_capacity_tons ORDER BY net_profit DESC;
        """)
        if fleet_data:
            df_fl = pd.DataFrame(fleet_data)
            tot_r = float(df_fl['revenue'].sum() or 0.0)
            tot_p = float(df_fl['net_profit'].sum() or 0.0)
            tot_km = float(df_fl['total_km'].sum() or 0.0)
            avg_m = round((tot_p / max(1.0, tot_r)) * 100.0, 2) if tot_r > 0 else 0.0

            k1, k2, k3, k4 = st.columns(4)
            k1.metric("Gross Revenue", f"₹{tot_r:,.2f}")
            k2.metric("Net Margin", f"₹{tot_p:,.2f}")
            k3.metric("Margin %", f"{avg_m:.2f}%")
            k4.metric("Total KM", f"{tot_km:,.0f} KM")
            st.dataframe(df_fl, hide_index=True, use_container_width=True, height=260)

    with tab_d:
        drv_data = run_query("""
            SELECT d.driver_code, d.full_name, COUNT(t.trip_id) AS trips,
                   COALESCE(SUM(t.total_km_run), 0.00) AS total_km,
                   COALESCE(SUM(COALESCE(t.unloaded_weight_mt, t.loaded_weight_mt)), 0.00) AS total_mt,
                   ROUND(SUM(t.total_km_run) / NULLIF(SUM(t.fuel_litres), 0.00), 2) AS kmpl,
                   COALESCE(SUM(t.shortage_mt), 0.00) AS shortage_mt,
                   COALESCE(SUM(t.freight_revenue), 0.00) AS revenue,
                   COALESCE(SUM(t.driver_bata), 0.00) AS bata_earned
            FROM drivers d LEFT JOIN trips t ON d.driver_id = t.primary_driver_id
            WHERE d.is_active = TRUE GROUP BY d.driver_code, d.full_name ORDER BY revenue DESC;
        """)
        if drv_data:
            st.dataframe(pd.DataFrame(drv_data), hide_index=True, use_container_width=True, height=260)

    with tab_v:
        if fleet_data:
            df_fl = pd.DataFrame(fleet_data)
            all_v = sorted(list(set(df_fl['truck_type'].tolist())))
            sel_v = st.selectbox("Filter Truck Variant", ["All"] + all_v)
            df_peer = df_fl if sel_v == "All" else df_fl[df_fl['truck_type'] == sel_v]
            st.dataframe(df_peer, hide_index=True, use_container_width=True, height=240)

# ==============================================================================
# 10. COMPACT AUDIT REGISTRY
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
        st.dataframe(pd.DataFrame(all_trips), hide_index=True, use_container_width=True, height=320)
