import streamlit as st
import pandas as pd
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from datetime import date
import io

# --- Page Configuration ---
st.set_page_config(
    page_title="Fleet Operational Management System",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# --- Corporate Custom Styling ---
st.markdown("""
<style>
    .reportview-container .main .block-container {
        padding-top: 1rem;
        padding-bottom: 2rem;
    }
    header {visibility: hidden;}
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    
    div[data-testid="stMetricValue"] {
        font-size: 1.30rem;
        font-weight: 700;
        color: #0F172A;
    }
    div[data-testid="stMetricLabel"] {
        font-size: 0.80rem;
        font-weight: 600;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .section-header {
        font-size: 1.05rem;
        font-weight: 700;
        color: #0F172A;
        border-bottom: 2px solid #CBD5E1;
        padding-bottom: 6px;
        margin-top: 10px;
        margin-bottom: 14px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .stButton>button {
        border-radius: 4px;
        font-weight: 600;
        height: 2.4rem;
    }
    .stTextInput>div>div>input, .stNumberInput>div>div>input {
        border-radius: 4px;
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
        "password":"Poovin@2809"
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

# --- In-Memory Caching ---
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
    "AVAILABLE_FOR_LOAD": "Available for Loading",
    "WAITING_FOR_LOAD": "Waiting for Loading",
    "IN_TRANSIT": "In Transit",
    "WAITING_FOR_UNLOAD": "Waiting for Unloading",
    "WORKSHOP_MAINTENANCE": "In Workshop / Maintenance",
    "DRIVER_UNAVAILABLE": "Driver Unavailable / Leave"
}

STANDARD_SOURCES = ["COCHIN", "POTTANERI", "METTUR", "UDUPPI", "COCHIN-ACC", "TUTICORIN", "OTHER / CUSTOM SOURCE"]

# --- Top Navigation Bar ---
st.title("Fleet Operational Management System")

MODULE_LIST = [
    "Fleet Status Board",
    "Trip Dispatch Entry",
    "POD Receive & Trip Closure",
    "Trip & Sundry Diesel Logs",
    "Direct Driver Advances",
    "Trip Modification & Expenses",
    "Driver Period Settlement",
    "Master Data Management",
    "Executive Retention & Yield Analytics",
    "Trip Records Registry"
]

menu = st.selectbox(
    "Select System Module",
    MODULE_LIST,
    index=0,
    label_visibility="collapsed"
)

st.markdown("---")

# ==============================================================================
# 0. FLEET STATUS BOARD
# ==============================================================================
if menu == "Fleet Status Board":
    st.subheader("Vehicle Operational Status & Yard Overview")
    
    vehicles = get_cached_vehicles()
    if not vehicles:
        st.warning("No registered vehicles found.")
        st.stop()

    df_v = pd.DataFrame(vehicles)
    df_v['status_label'] = df_v['current_status'].map(lambda x: STATUS_OPTIONS.get(x, x))

    c1, c2, c3, c4, c5, c6 = st.columns(6)
    c1.metric("Available", len(df_v[df_v['current_status'] == 'AVAILABLE_FOR_LOAD']))
    c2.metric("At Plant (Loading)", len(df_v[df_v['current_status'] == 'WAITING_FOR_LOAD']))
    c3.metric("On Highway", len(df_v[df_v['current_status'] == 'IN_TRANSIT']))
    c4.metric("At Site (Unloading)", len(df_v[df_v['current_status'] == 'WAITING_FOR_UNLOAD']))
    c5.metric("In Workshop", len(df_v[df_v['current_status'] == 'WORKSHOP_MAINTENANCE']))
    c6.metric("No Driver", len(df_v[df_v['current_status'] == 'DRIVER_UNAVAILABLE']))

    st.markdown("---")
    col_view, col_upd = st.columns([1.6, 1.0])

    with col_view:
        st.markdown('<div class="section-header">Active Fleet Inventory</div>', unsafe_allow_html=True)
        filt = st.selectbox("Filter Status", ["All Operational States"] + list(STATUS_OPTIONS.values()))
        
        view_df = df_v.copy()
        if filt != "All Operational States":
            view_df = view_df[view_df['status_label'] == filt]

        st.dataframe(
            view_df[['vehicle_number', 'truck_type', 'carrying_capacity_tons', 'status_label', 'status_remarks']],
            column_config={
                "vehicle_number": "Vehicle Number",
                "truck_type": "Variant / Type",
                "carrying_capacity_tons": "Class (MT)",
                "status_label": "Current Status",
                "status_remarks": "Remarks / Current Location"
            },
            hide_index=True,
            use_container_width=True
        )

    with col_upd:
        st.markdown('<div class="section-header">Update Vehicle State</div>', unsafe_allow_html=True)
        v_map = {f"{v['vehicle_number']} ({v['truck_type']}) - [{STATUS_OPTIONS.get(v['current_status'], v['current_status'])}]": v for v in vehicles}
        chosen_v = st.selectbox("Select Target Vehicle", list(v_map.keys()))
        target_v = v_map[chosen_v]

        with st.form("status_update_form"):
            keys = list(STATUS_OPTIONS.keys())
            idx = keys.index(target_v['current_status']) if target_v['current_status'] in keys else 0
            new_st = st.selectbox("Updated Status", keys, index=idx, format_func=lambda x: STATUS_OPTIONS[x])
            new_rem = st.text_input("Operational Remarks / Location", value=target_v['status_remarks'] or "")

            if st.form_submit_button("Update Status", use_container_width=True):
                run_query("""
                    UPDATE vehicles 
                    SET current_status = %s, status_remarks = %s, status_updated_at = CURRENT_TIMESTAMP 
                    WHERE vehicle_id = %s
                """, (new_st, new_rem, target_v['vehicle_id']), fetch=False)
                get_cached_vehicles.clear()
                st.success("Vehicle status updated.")
                st.rerun()

# ==============================================================================
# 1. TRIP DISPATCH ENTRY
# ==============================================================================
elif menu == "Trip Dispatch Entry":
    st.subheader("Trip Dispatch Registration")

    vehicles = get_cached_vehicles()
    drivers = get_cached_drivers()

    if not vehicles or not drivers:
        st.error("Please configure vehicles and drivers before logging trips.")
        st.stop()

    if "form_reset_counter" not in st.session_state:
        st.session_state.form_reset_counter = 0

    cnt = st.session_state.form_reset_counter

    top1, top2 = st.columns([1, 1])
    with top1:
        cargo_category = st.radio("Cargo Category", ["BULK", "BAG"], horizontal=True, key=f"cargo_sel_{cnt}")
    with top2:
        saved_d_rate = get_cached_diesel_rate()
        active_diesel_rate = st.number_input("Applicable Diesel Rate (INR/L)*", min_value=50.0, max_value=150.0, value=saved_d_rate, step=0.05, key=f"d_rate_{cnt}")
        if active_diesel_rate != saved_d_rate:
            set_saved_diesel_rate(active_diesel_rate)

    st.markdown('<div class="section-header">Primary Trip Entry Parameters</div>', unsafe_allow_html=True)

    col_date1, col_date2 = st.columns(2)
    with col_date1:
        start_date = st.date_input("1. Trip Start Date*", date.today(), key=f"sdate_{cnt}")
    with col_date2:
        end_date = st.date_input("1b. Expected End Date*", date.today(), key=f"edate_{cnt}")

    col_a, col_b = st.columns(2)
    with col_a:
        lr_no = st.text_input("2. LR Number / Trip Number*", placeholder="e.g. LR-9081", key=f"lr_{cnt}").strip().upper()
        if lr_no and check_lr_exists(lr_no):
            st.error(f"DUPLICATE WARNING: LR Number '{lr_no}' is already registered in the system.")

    vehicle_map = {f"{v['vehicle_number']}  ➔  [{v['truck_type']} | {v['carrying_capacity_tons']} MT Class]": v for v in vehicles}
    with col_b:
        sel_veh_label = st.selectbox("3. Truck Number*", list(vehicle_map.keys()), key=f"veh_sel_{cnt}")
        active_veh = vehicle_map[sel_veh_label]
        v_class_mt = float(active_veh['carrying_capacity_tons'])
        last_drv_id = get_last_driver_for_vehicle(active_veh['vehicle_id'])

    col_c, col_d = st.columns(2)
    with col_c:
        chosen_source_opt = st.selectbox("4. Source (Origin Hub)*", STANDARD_SOURCES, key=f"src_sel_{cnt}")
        if chosen_source_opt == "OTHER / CUSTOM SOURCE":
            origin_terminal = st.text_input("Enter Custom Source Name*", placeholder="e.g. PALAKKAD").strip().upper()
        else:
            origin_terminal = chosen_source_opt

    routes_from_source = get_cached_routes(cargo_type=cargo_category, capacity=v_class_mt, origin=origin_terminal)
    dest_options = {}
    if routes_from_source:
        for r in routes_from_source:
            lbl = f"{r['destination_name']}  ➔  [Rate: INR {r['freight_rate_per_ton']}/MT | {r['standard_km']} KM]"
            dest_options[lbl] = r
    dest_options["-- MANUAL / SPOT DESTINATION --"] = {
        "origin": origin_terminal,
        "destination_name": "",
        "standard_km": 0.0,
        "freight_rate_per_ton": 0.0
    }

    with col_d:
        sel_dest_label = st.selectbox(f"5. Destination (Configured for {origin_terminal})*", list(dest_options.keys()), key=f"dest_sel_{cnt}")
        active_route = dest_options[sel_dest_label]
        is_spot_dest = (sel_dest_label == "-- MANUAL / SPOT DESTINATION --")

        if is_spot_dest:
            dest_terminal = st.text_input("Enter Custom Destination Name*", placeholder="e.g. SANKARI").strip().upper()
            agreed_rate_mt = st.number_input("Spot Freight Rate per MT (INR)*", min_value=0.0, step=25.0, value=0.0, key=f"spot_rate_{cnt}")
            standard_route_km = st.number_input("Route Distance (KM)", min_value=0.0, step=10.0, value=0.0, key=f"spot_km_{cnt}")
        else:
            dest_terminal = active_route['destination_name']
            agreed_rate_mt = float(active_route['freight_rate_per_ton'])
            standard_route_km = float(active_route['standard_km'])

    col_e, col_f = st.columns(2)
    driver_dict = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers}
    driver_labels = list(driver_dict.keys())
    default_driver_index = 0
    if last_drv_id:
        for idx, d_obj in enumerate(driver_dict.values()):
            if d_obj['driver_id'] == last_drv_id:
                default_driver_index = idx
                break

    with col_e:
        chosen_driver_str = st.selectbox("6. Driver Name*", driver_labels, index=default_driver_index, key=f"drv_{cnt}")
        sel_driver_obj = driver_dict[chosen_driver_str]

    with col_f:
        weighbridge_mt = st.number_input("7. Loaded Weight (MT)*", min_value=0.0, max_value=60.0, step=0.05, value=v_class_mt, key=f"wmt_{cnt}")
        gross_freight = round(weighbridge_mt * agreed_rate_mt, 2)
        st.info(f"Auto Gross Freight: **INR {gross_freight:,.2f}** ({weighbridge_mt} MT × INR {agreed_rate_mt:,.2f}/MT)")

    col_g, col_h = st.columns(2)
    master_bata_val = lookup_driver_bata(dest_terminal, cargo_category, active_veh['vehicle_id'])
    with col_g:
        driver_bata = st.number_input(f"8. Driver Bata (INR)* [Master: INR {master_bata_val:,.2f}]", min_value=0.0, step=100.0, value=master_bata_val, key=f"bata_{cnt}")

    with col_h:
        fuel_qty = st.number_input("9. Diesel Quantity Issued (Litres)*", min_value=0.0, step=10.0, value=0.0, key=f"fqty_{cnt}")
        gross_fuel_cost = round(fuel_qty * active_diesel_rate, 2)
        st.info(f"Auto Diesel Cost: **INR {gross_fuel_cost:,.2f}** ({fuel_qty} L × INR {active_diesel_rate:.2f}/L)")

    st.markdown('<div class="section-header">Secondary Trip Logistics & Odometers</div>', unsafe_allow_html=True)
    sec1, sec2, sec3 = st.columns(3)
    with sec1:
        start_km = st.number_input("Load Start Odometer (KM)", min_value=0.0, step=10.0, value=0.0, key=f"skm_{cnt}")
        end_km = st.number_input("Expected End Odometer (KM)", min_value=0.0, step=10.0, value=0.0, key=f"ekm_{cnt}")
    with sec2:
        computed_km = max(0.0, end_km - start_km) if (end_km >= start_km and end_km > 0) else standard_route_km
        total_km_run = st.number_input("Total Trip KM Run", min_value=0.0, step=10.0, value=computed_km, key=f"tkm_{cnt}")
        filling_km = st.number_input("Diesel Filling Odometer (KM)", min_value=0.0, step=10.0, value=0.0, key=f"fkm_{cnt}")
    with sec3:
        fastag_toll = st.number_input("FASTag / Toll Disbursement (INR)", min_value=0.0, step=100.0, value=0.0, key=f"toll_{cnt}")
        cash_advance = st.number_input("Trip Cash Advance Issued to Driver (INR)", min_value=0.0, step=500.0, value=0.0, key=f"adv_{cnt}")

    st.write("")
    if st.button("Save and Dispatch Trip Record", type="primary", use_container_width=True):
        if not lr_no.strip() or not dest_terminal.strip() or not origin_terminal.strip():
            st.error("Validation Failure: LR Number, Source, and Destination are required.")
        elif check_lr_exists(lr_no):
            st.error(f"Cannot dispatch trip. LR Number '{lr_no}' already exists in registry.")
        else:
            try:
                new_t = run_query("""
                    INSERT INTO trips (
                        trip_number, branch_id, vehicle_id, primary_driver_id,
                        trip_start_date, trip_end_date, origin, destination,
                        start_km, end_km, total_km_run, diesel_filling_km,
                        tonnage_loaded, loaded_weight_mt, unloaded_weight_mt,
                        freight_revenue, fuel_litres, fuel_expense,
                        driver_bata, toll_fastag_expense, cash_advance_issued,
                        trip_status
                    ) VALUES (%s, 1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'IN_TRANSIT')
                    RETURNING trip_id;
                """, (
                    lr_no, active_veh['vehicle_id'], sel_driver_obj['driver_id'],
                    start_date, end_date, origin_terminal, dest_terminal,
                    start_km, end_km, total_km_run, filling_km,
                    weighbridge_mt, weighbridge_mt, weighbridge_mt,
                    gross_freight, fuel_qty, gross_fuel_cost,
                    driver_bata, fastag_toll, cash_advance
                ))

                trip_id_created = new_t[0]['trip_id']

                if fuel_qty > 0:
                    run_query("""
                        INSERT INTO diesel_fuel_logs (
                            fuel_date, vehicle_id, trip_id, lr_number, diesel_category,
                            litres_filled, diesel_rate_per_litre, total_fuel_cost, filling_odometer_km, remarks
                        ) VALUES (%s, %s, %s, %s, 'TRIP_DIESEL', %s, %s, %s, %s, 'Trip Dispatch Initial Issue');
                    """, (start_date, active_veh['vehicle_id'], trip_id_created, lr_no, fuel_qty, active_diesel_rate, gross_fuel_cost, filling_km), fetch=False)

                run_query("""
                    UPDATE vehicles 
                    SET current_status = 'IN_TRANSIT', 
                        status_remarks = %s, 
                        status_updated_at = CURRENT_TIMESTAMP 
                    WHERE vehicle_id = %s
                """, (f"Trip {lr_no}: {origin_terminal} -> {dest_terminal}", active_veh['vehicle_id']), fetch=False)

                get_cached_vehicles.clear()
                st.session_state.form_reset_counter += 1
                st.success(f"Trip {lr_no} saved & dispatched.")
                st.rerun()
            except Exception as e:
                st.error(f"Database Execution Error: {e}")

# ==============================================================================
# 2. POD RECEIVE & TRIP CLOSURE
# ==============================================================================
elif menu == "POD Receive & Trip Closure":
    st.subheader("POD Receive, Actual Unloading Verification & Trip Closure")

    active_trips = run_query("""
        SELECT 
            t.trip_id, t.trip_number, v.vehicle_number, v.vehicle_id, v.carrying_capacity_tons,
            d.full_name AS driver_name, t.origin, t.destination,
            t.trip_start_date, t.trip_end_date, t.start_km, t.end_km, t.total_km_run,
            t.loaded_weight_mt, t.freight_revenue, t.driver_bata, t.fuel_expense,
            t.toll_fastag_expense, t.cash_advance_issued, t.trip_status
        FROM trips t
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        JOIN drivers d ON t.primary_driver_id = d.driver_id
        WHERE t.trip_status != 'COMPLETED'
        ORDER BY t.trip_id DESC;
    """)

    if not active_trips:
        st.info("No active trips currently in transit. All trips are closed and completed.")
    else:
        trip_options = {
            f"LR: {t['trip_number']} | Truck: {t['vehicle_number']} | {t['origin']} ➔ {t['destination']} | Driver: {t['driver_name']}": t 
            for t in active_trips
        }
        chosen_lr_str = st.selectbox("Select Active Trip to Close with POD", list(trip_options.keys()))
        t_cur = trip_options[chosen_lr_str]

        known_rate = run_query("""
            SELECT freight_rate_per_ton 
            FROM destinations_freight_master 
            WHERE LOWER(origin) = LOWER(%s) 
              AND LOWER(destination_name) = LOWER(%s) 
              AND capacity_tons = %s 
            LIMIT 1
        """, (t_cur['origin'], t_cur['destination'], t_cur['carrying_capacity_tons']))
        
        if known_rate and known_rate[0]['freight_rate_per_ton']:
            applied_rate_mt = float(known_rate[0]['freight_rate_per_ton'])
        else:
            applied_rate_mt = round(float(t_cur['freight_revenue'] or 0.0) / max(0.01, float(t_cur['loaded_weight_mt'] or 1.0)), 2)

        st.markdown('<div class="section-header">1. Manifest Overview</div>', unsafe_allow_html=True)
        ov1, ov2, ov3, ov4 = st.columns(4)
        ov1.metric("Trip / LR Number", t_cur['trip_number'])
        ov2.metric("Assigned Truck", t_cur['vehicle_number'])
        ov3.metric("Loaded Weight", f"{float(t_cur['loaded_weight_mt']):.2f} MT")
        ov4.metric("Start Odometer", f"{float(t_cur['start_km'] or 0.0):.1f} KM")

        with st.form("pod_trip_closure_form"):
            st.markdown('<div class="section-header">2. POD & Actual Unloading Verification</div>', unsafe_allow_html=True)
            p1, p2, p3 = st.columns(3)
            with p1:
                pod_no = st.text_input("POD / Customer Challan No*", placeholder="e.g. POD-9912").strip().upper()
                actual_close_date = st.date_input("Actual Trip Closing Date*", date.today())
            with p2:
                unloaded_wt = st.number_input(
                    "Customer Unloaded Weight (MT)*", 
                    min_value=0.0, 
                    max_value=60.0, 
                    value=float(t_cur['loaded_weight_mt'] or 0.0), 
                    step=0.01
                )
                shortage_calc = max(0.0, float(t_cur['loaded_weight_mt']) - unloaded_wt)
                st.metric("Detected Weight Shortage", f"{shortage_calc:.2f} MT")
            with p3:
                shortage_penalty_rate = st.number_input("Shortage Penalty Rate / MT (INR)", min_value=0.0, value=0.0, step=100.0)
                shortage_deduction = round(shortage_calc * shortage_penalty_rate, 2)
                st.metric("Shortage Penalty Deduction", f"INR {shortage_deduction:,.2f}")

            st.markdown('<div class="section-header">3. Final Odometers & Halt / En-route Claims</div>', unsafe_allow_html=True)
            p4, p5, p6 = st.columns(3)
            with p4:
                final_closing_km = st.number_input(
                    "Actual Final Closing Odometer (KM)*", 
                    min_value=float(t_cur['start_km'] or 0.0), 
                    value=float(t_cur['end_km'] or (float(t_cur['start_km'] or 0.0) + float(t_cur['total_km_run'] or 0.0))), 
                    step=10.0
                )
                final_km_run = max(0.0, final_closing_km - float(t_cur['start_km'] or 0.0))
                st.metric("Calculated Final KM Run", f"{final_km_run:.1f} KM")
            with p5:
                halt_bata_paid = st.number_input("Halt / Detention Bata Paid (INR)", min_value=0.0, value=0.0, step=100.0, help="Unloading detention & plant delay bata")
                total_bata_final = float(t_cur['driver_bata'] or 0.0) + halt_bata_paid
                st.metric("Total Final Driver Bata", f"INR {total_bata_final:,.2f}")
            with p6:
                enroute_repairs = st.number_input("En-route Repairs / Workshop (INR)", min_value=0.0, value=0.0, step=100.0)
                handling_charges = st.number_input("Hamali / Unloading Charges (INR)", min_value=0.0, value=0.0, step=50.0)
                misc_claims = st.number_input("Misc Toll / Entry Claims (INR)", min_value=0.0, value=0.0, step=50.0)

            final_freight_revenue = round(unloaded_wt * applied_rate_mt, 2)
            pod_remarks = st.text_input("Trip Closure & POD Remarks", value="POD Verified & Weighed at Customer Site")

            st.write("")
            if st.form_submit_button("Settle POD, Close Trip & Release Truck", type="primary", use_container_width=True):
                if not pod_no:
                    st.error("POD Receipt Number is required to close trip.")
                else:
                    try:
                        run_query("""
                            UPDATE trips
                            SET pod_number = %s,
                                pod_received_date = %s,
                                trip_end_date = %s,
                                end_km = %s,
                                total_km_run = %s,
                                unloaded_weight_mt = %s,
                                shortage_mt = %s,
                                shortage_penalty_deduction = %s,
                                freight_revenue = %s,
                                driver_bata = %s,
                                halt_bata = %s,
                                enroute_repairs_maintenance = enroute_repairs_maintenance + %s,
                                loading_unloading_expense = loading_unloading_expense + %s,
                                misc_trip_expense = misc_trip_expense + %s,
                                pod_settlement_remarks = %s,
                                trip_status = 'COMPLETED',
                                trip_closed_at = CURRENT_TIMESTAMP
                            WHERE trip_id = %s;
                        """, (
                            pod_no, actual_close_date, actual_close_date,
                            final_closing_km, final_km_run, unloaded_wt,
                            shortage_calc, shortage_deduction, final_freight_revenue,
                            total_bata_final, halt_bata_paid,
                            enroute_repairs, handling_charges, misc_claims,
                            pod_remarks, t_cur['trip_id']
                        ), fetch=False)

                        run_query("""
                            UPDATE vehicles
                            SET current_status = 'AVAILABLE_FOR_LOAD',
                                status_remarks = %s,
                                status_updated_at = CURRENT_TIMESTAMP
                            WHERE vehicle_id = %s;
                        """, (f"Completed Trip {t_cur['trip_number']} (POD: {pod_no})", t_cur['vehicle_id']), fetch=False)

                        get_cached_vehicles.clear()
                        st.success(f"Trip {t_cur['trip_number']} successfully closed! Truck {t_cur['vehicle_number']} is now AVAILABLE.")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Error closing trip: {e}")

# ==============================================================================
# 3. TRIP & SUNDRY DIESEL LOGS
# ==============================================================================
elif menu == "Trip & Sundry Diesel Logs":
    st.subheader("Diesel & Fuel Issue Management (Trip & Sundry)")

    tab_add_fuel, tab_view_fuel = st.tabs(["Add Diesel Entry", "Diesel Audit Ledger"])
    vehicles = get_cached_vehicles()
    v_dict = {f"{v['vehicle_number']} ({v['truck_type']})": v for v in vehicles}
    current_d_rate = get_cached_diesel_rate()

    with tab_add_fuel:
        st.markdown('<div class="section-header">Issue Diesel / Record Fuel Bill</div>', unsafe_allow_html=True)
        with st.form("diesel_entry_form", clear_on_submit=True):
            df1, df2, df3 = st.columns(3)
            with df1:
                fuel_entry_date = st.date_input("Fuel Issue Date*", date.today())
                chosen_veh_fuel = st.selectbox("Vehicle Number*", list(v_dict.keys()))
                target_veh = v_dict[chosen_veh_fuel]
                fuel_cat = st.selectbox("Diesel Category*", ["TRIP_DIESEL", "SUNDRY_DIESEL"], help="Sundry diesel covers local yard movements, empty runs, and maintenance")
            with df2:
                fuel_lr_no = st.text_input("Trip / LR Number (Optional for Sundry)", placeholder="e.g. LR-2026-001").strip().upper()
                filling_odo = st.number_input("Odometer at Filling (KM)", min_value=0.0, step=10.0, value=0.0)
                fuel_station = st.text_input("Fuel Station / Vendor Name", placeholder="e.g. BPCL COCHIN HUB")
            with df3:
                f_litres = st.number_input("Litres Filled*", min_value=0.0, step=10.0, value=0.0)
                f_rate = st.number_input("Diesel Rate (INR/Litre)*", min_value=50.0, max_value=150.0, value=current_d_rate, step=0.05)
                f_total_calc = round(f_litres * f_rate, 2)
                st.metric("Total Fuel Cost", f"INR {f_total_calc:,.2f}")
                fuel_remarks = st.text_input("Remarks / Bill Number", placeholder="e.g. Pump Slip #4891")

            if st.form_submit_button("Record Diesel Entry", type="primary", use_container_width=True):
                if f_litres <= 0:
                    st.error("Please enter a valid fuel quantity.")
                else:
                    matched_trip_id = None
                    if fuel_lr_no:
                        t_match = run_query("SELECT trip_id FROM trips WHERE LOWER(trip_number) = LOWER(%s)", (fuel_lr_no,))
                        if t_match:
                            matched_trip_id = t_match[0]['trip_id']

                    run_query("""
                        INSERT INTO diesel_fuel_logs (
                            fuel_date, vehicle_id, trip_id, lr_number, diesel_category,
                            litres_filled, diesel_rate_per_litre, total_fuel_cost,
                            filling_odometer_km, fuel_station_vendor, remarks
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """, (
                        fuel_entry_date, target_veh['vehicle_id'], matched_trip_id,
                        fuel_lr_no or "SUNDRY", fuel_cat,
                        f_litres, f_rate, f_total_calc,
                        filling_odo, fuel_station, fuel_remarks
                    ), fetch=False)

                    if matched_trip_id:
                        run_query("""
                            UPDATE trips
                            SET fuel_litres = fuel_litres + %s,
                                fuel_expense = fuel_expense + %s
                            WHERE trip_id = %s;
                        """, (f_litres, f_total_calc, matched_trip_id), fetch=False)

                    st.success(f"Diesel log recorded: {f_litres} Litres (INR {f_total_calc:,.2f}) for {target_veh['vehicle_number']}.")
                    st.rerun()

    with tab_view_fuel:
        fuel_logs = run_query("""
            SELECT 
                f.fuel_log_id, f.fuel_date, v.vehicle_number, f.diesel_category,
                f.lr_number, f.litres_filled, f.diesel_rate_per_litre, f.total_fuel_cost,
                f.filling_odometer_km, f.fuel_station_vendor, f.remarks
            FROM diesel_fuel_logs f
            JOIN vehicles v ON f.vehicle_id = v.vehicle_id
            ORDER BY f.fuel_date DESC, f.fuel_log_id DESC
            LIMIT 150;
        """)
        if fuel_logs:
            df_fuel = pd.DataFrame(fuel_logs)
            st.dataframe(df_fuel, use_container_width=True)

            buf = io.BytesIO()
            with pd.ExcelWriter(buf, engine='openpyxl') as writer:
                df_fuel.to_excel(writer, index=False, sheet_name='Diesel Logs')
            st.download_button(
                "Export Diesel Ledger (Excel)",
                data=buf.getvalue(),
                file_name=f"diesel_ledger_{date.today()}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )

            st.markdown("---")
            st.markdown('<div class="section-header">Delete Fuel Log</div>', unsafe_allow_html=True)
            del_fuel_id = st.selectbox("Select Fuel Entry ID to Remove", df_fuel['fuel_log_id'].tolist())
            if st.button("Delete Fuel Entry", type="primary"):
                run_query("DELETE FROM diesel_fuel_logs WHERE fuel_log_id = %s", (del_fuel_id,), fetch=False)
                st.success("Fuel log purged.")
                st.rerun()

# ==============================================================================
# 4. DIRECT DRIVER ADVANCES
# ==============================================================================
elif menu == "Direct Driver Advances":
    st.subheader("Direct Driver Cash Advance & Loan Ledger")

    tab_give_adv, tab_view_adv = st.tabs(["Issue Direct Advance", "Advances Ledger"])
    drivers = get_cached_drivers()
    d_map = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers}

    with tab_give_adv:
        st.markdown('<div class="section-header">Issue Direct Advance to Driver Account</div>', unsafe_allow_html=True)
        with st.form("direct_adv_form", clear_on_submit=True):
            da1, da2, da3 = st.columns(3)
            with da1:
                adv_date = st.date_input("Advance Date*", date.today())
                chosen_drv = st.selectbox("Driver Account*", list(d_map.keys()))
                target_drv = d_map[chosen_drv]
            with da2:
                adv_amount = st.number_input("Advance Amount (INR)*", min_value=0.0, step=500.0, value=0.0)
                adv_category = st.selectbox("Advance Category", [
                    "BATA_ADVANCE",
                    "GENERAL_ADVANCE",
                    "EMERGENCY_MEDICAL",
                    "SALARY_ADVANCE",
                    "MAINTENANCE_LOAN"
                ])
            with da3:
                pay_mode = st.selectbox("Payment Mode", ["CASH", "UPI / GPAY", "BANK_TRANSFER", "BRANCH_PETTY_CASH"])
                adv_ref = st.text_input("Reference / Voucher / UPI Txn ID", placeholder="e.g. UPI Ref #90218")

            if st.form_submit_button("Issue & Save Advance", type="primary", use_container_width=True):
                if adv_amount <= 0:
                    st.error("Please enter a valid advance amount.")
                else:
                    run_query("""
                        INSERT INTO driver_direct_advances (
                            advance_date, driver_id, amount_inr, advance_type, payment_mode, reference_remarks
                        ) VALUES (%s, %s, %s, %s, %s, %s);
                    """, (adv_date, target_drv['driver_id'], adv_amount, adv_category, pay_mode, adv_ref), fetch=False)
                    st.success(f"Advance of INR {adv_amount:,.2f} recorded for {target_drv['full_name']}.")
                    st.rerun()

    with tab_view_adv:
        adv_records = run_query("""
            SELECT 
                a.advance_id, a.advance_date, d.driver_code, d.full_name AS driver_name,
                a.amount_inr, a.advance_type, a.payment_mode, a.reference_remarks,
                a.is_settled
            FROM driver_direct_advances a
            JOIN drivers d ON a.driver_id = d.driver_id
            ORDER BY a.advance_date DESC, a.advance_id DESC
            LIMIT 150;
        """)
        if adv_records:
            df_adv = pd.DataFrame(adv_records)
            st.dataframe(df_adv, use_container_width=True)

            buf = io.BytesIO()
            with pd.ExcelWriter(buf, engine='openpyxl') as writer:
                df_adv.to_excel(writer, index=False, sheet_name='Direct Advances')
            st.download_button(
                "Export Advances Ledger (Excel)",
                data=buf.getvalue(),
                file_name=f"driver_advances_ledger_{date.today()}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )

            st.markdown("---")
            st.markdown('<div class="section-header">Delete Advance Entry</div>', unsafe_allow_html=True)
            del_adv_id = st.selectbox("Select Advance ID to Delete", df_adv['advance_id'].tolist())
            if st.button("Delete Advance Record", type="primary"):
                run_query("DELETE FROM driver_direct_advances WHERE advance_id = %s", (del_adv_id,), fetch=False)
                st.success("Advance record deleted.")
                st.rerun()

# ==============================================================================
# 5. TRIP MODIFICATION & EXPENSES
# ==============================================================================
elif menu == "Trip Modification & Expenses":
    st.subheader("Trip Audit, Modification & Expense Claims")

    trips = run_query("""
        SELECT 
            t.trip_id, t.trip_number, v.vehicle_number, v.vehicle_id, v.carrying_capacity_tons, d.full_name, d.driver_id,
            t.origin, t.destination, t.trip_start_date, t.trip_end_date,
            t.start_km, t.end_km, t.total_km_run, t.diesel_filling_km,
            t.tonnage_loaded, t.loaded_weight_mt, t.unloaded_weight_mt,
            t.freight_revenue, t.fuel_litres, t.fuel_expense,
            t.driver_bata, t.halt_bata, t.toll_fastag_expense, t.cash_advance_issued,
            t.enroute_repairs_maintenance, t.loading_unloading_expense, t.misc_trip_expense,
            t.pod_number, t.trip_status
        FROM trips t
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        JOIN drivers d ON t.primary_driver_id = d.driver_id
        ORDER BY t.trip_id DESC
        LIMIT 100;
    """)

    if not trips:
        st.info("No recorded trips available for modification.")
        st.stop()

    trip_map = {f"LR: {t['trip_number']} | Truck: {t['vehicle_number']} | {t['origin']} -> {t['destination']} | {t['full_name']} [{t['trip_status']}]": t for t in trips}
    sel_t_label = st.selectbox("Select Trip Record for Modification", list(trip_map.keys()))
    t = trip_map[sel_t_label]

    all_drivers = get_cached_drivers()
    all_driver_map = {f"{d['driver_code']} - {d['full_name']}": d['driver_id'] for d in all_drivers}
    
    curr_drv_idx = 0
    for idx, d_id in enumerate(all_driver_map.values()):
        if d_id == t['driver_id']:
            curr_drv_idx = idx
            break

    known_rate = run_query("""
        SELECT freight_rate_per_ton 
        FROM destinations_freight_master 
        WHERE LOWER(origin) = LOWER(%s) 
          AND LOWER(destination_name) = LOWER(%s) 
          AND capacity_tons = %s 
        LIMIT 1
    """, (t['origin'], t['destination'], t['carrying_capacity_tons']))

    if known_rate and known_rate[0]['freight_rate_per_ton']:
        base_rate_per_ton = float(known_rate[0]['freight_rate_per_ton'])
    else:
        base_rate_per_ton = round(float(t['freight_revenue'] or 0.0) / max(0.01, float(t['loaded_weight_mt'] or 1.0)), 2)

    current_d_rate = get_cached_diesel_rate()

    st.markdown('<div class="section-header">Trip Manifest & Routing Details</div>', unsafe_allow_html=True)
    e1, e2, e3 = st.columns(3)
    with e1:
        m_lr = st.text_input("Trip / LR Number*", value=t['trip_number'], key="edit_lr")
        m_driver = st.selectbox("Assigned Driver*", list(all_driver_map.keys()), index=curr_drv_idx, key="edit_driver")
    with e2:
        m_orig = st.text_input("Origin*", value=t['origin'], key="edit_orig")
        m_dest = st.text_input("Destination*", value=t['destination'], key="edit_dest")
    with e3:
        m_sdate = st.date_input("Start Date", t['trip_start_date'], key="edit_sdate")
        m_edate = st.date_input("End Date", t['trip_end_date'], key="edit_edate")

    st.markdown('<div class="section-header">Odometer & Automatic Payload / Fuel Recalculations</div>', unsafe_allow_html=True)
    e4, e5, e6 = st.columns(3)
    with e4:
        m_skm = st.number_input("Start KM", min_value=0.0, value=float(t['start_km'] or 0.0), step=10.0, key="edit_skm")
        m_ekm = st.number_input("End KM", min_value=0.0, value=float(t['end_km'] or 0.0), step=10.0, key="edit_ekm")
        calc_edit_km = max(0.0, m_ekm - m_skm) if m_ekm >= m_skm and m_ekm > 0 else float(t['total_km_run'] or 0.0)
        m_tkm = st.number_input("Total Trip KM", min_value=0.0, value=calc_edit_km, step=10.0, key="edit_tkm")
    with e5:
        m_ton = st.number_input("Billable MT", min_value=0.0, value=float(t['unloaded_weight_mt'] or t['loaded_weight_mt'] or 0.0), step=0.05, key="edit_ton")
        m_rate_applied = st.number_input("Contract Rate / MT (INR)", min_value=0.0, value=base_rate_per_ton, step=25.0, key="edit_rate_applied")
        recalc_freight = round(m_ton * m_rate_applied, 2)
        st.metric("Auto Freight Revenue (INR)", f"INR {recalc_freight:,.2f}")
    with e6:
        m_fqty = st.number_input("Fuel Litres", min_value=0.0, value=float(t['fuel_litres'] or 0.0), step=5.0, key="edit_fqty")
        m_drate_applied = st.number_input("Diesel Rate / L (INR)", min_value=50.0, max_value=150.0, value=current_d_rate, step=0.05, key="edit_drate_applied")
        recalc_fuel_cost = round(m_fqty * m_drate_applied, 2)
        st.metric("Auto Diesel Expense (INR)", f"INR {recalc_fuel_cost:,.2f}")
        m_fkm = st.number_input("Diesel Filling KM", min_value=0.0, value=float(t['diesel_filling_km'] or 0.0), step=10.0, key="edit_fkm")

    st.markdown('<div class="section-header">Disbursements, Advances & Workshop Claims</div>', unsafe_allow_html=True)
    e7, e8, e9 = st.columns(3)
    with e7:
        m_bata = st.number_input("Total Driver Bata (INR)", min_value=0.0, value=float(t['driver_bata'] or 0.0), step=100.0, key="edit_bata")
        m_toll = st.number_input("FASTag / Toll (INR)", min_value=0.0, value=float(t['toll_fastag_expense'] or 0.0), step=100.0, key="edit_toll")
        m_adv = st.number_input("Trip Cash Advance Drawn (INR)", min_value=0.0, value=float(t['cash_advance_issued'] or 0.0), step=500.0, key="edit_adv")
    with e8:
        m_rep = st.number_input("En-route Repair & Workshop (INR)", min_value=0.0, value=float(t['enroute_repairs_maintenance'] or 0.0), step=100.0, key="edit_rep")
        m_load = st.number_input("Loading / Handling Charges (INR)", min_value=0.0, value=float(t['loading_unloading_expense'] or 0.0), step=50.0, key="edit_load")
    with e9:
        m_misc = st.number_input("Miscellaneous Claims (INR)", min_value=0.0, value=float(t['misc_trip_expense'] or 0.0), step=50.0, key="edit_misc")

    st.write("")
    if st.button("Commit All Trip Changes", type="primary", use_container_width=True):
        if check_lr_exists(m_lr, exclude_trip_id=t['trip_id']):
            st.error("Duplicate Violation: Another trip already utilizes this LR Number.")
        else:
            run_query("""
                UPDATE trips
                SET trip_number = %s,
                    primary_driver_id = %s,
                    origin = %s,
                    destination = %s,
                    trip_start_date = %s,
                    trip_end_date = %s,
                    start_km = %s,
                    end_km = %s,
                    total_km_run = %s,
                    diesel_filling_km = %s,
                    tonnage_loaded = %s,
                    loaded_weight_mt = %s,
                    freight_revenue = %s,
                    fuel_litres = %s,
                    fuel_expense = %s,
                    driver_bata = %s,
                    toll_fastag_expense = %s,
                    cash_advance_issued = %s,
                    enroute_repairs_maintenance = %s,
                    loading_unloading_expense = %s,
                    misc_trip_expense = %s
                WHERE trip_id = %s;
            """, (
                m_lr.strip().upper(), all_driver_map[m_driver],
                m_orig.strip().upper(), m_dest.strip().upper(),
                m_sdate, m_edate,
                m_skm, m_ekm, m_tkm, m_fkm,
                m_ton, m_ton, recalc_freight,
                m_fqty, recalc_fuel_cost,
                m_bata, m_toll, m_adv,
                m_rep, m_load, m_misc,
                t['trip_id']
            ), fetch=False)
            st.success(f"Trip record {m_lr} successfully updated.")
            st.rerun()

# ==============================================================================
# 6. DRIVER PERIOD SETTLEMENT
# ==============================================================================
elif menu == "Driver Period Settlement":
    st.subheader("Driver Settlement Ledger (Trip Bata + Direct Advances)")

    drivers = get_cached_drivers()
    if not drivers:
        st.warning("No registered drivers found.")
        st.stop()

    driver_map = {f"{d['driver_code']} - {d['full_name']}": d['driver_id'] for d in drivers}
    
    col_filter1, col_filter2, col_filter3 = st.columns(3)
    with col_filter1:
        chosen_driver = st.selectbox("Driver Account", list(driver_map.keys()))
        selected_driver_id = driver_map[chosen_driver]
    with col_filter2:
        date_mode = st.radio("Date Selection Method", ["Preset Cycle (1-15 / 16-End)", "Custom Date Range (From - To)"], horizontal=True)
    
    if date_mode == "Preset Cycle (1-15 / 16-End)":
        with col_filter3:
            target_year = st.selectbox("Fiscal Year", [date.today().year - 1, date.today().year, date.today().year + 1], index=1)
            target_month = st.selectbox("Month", list(range(1, 13)), index=date.today().month - 1)
            settlement_period = st.radio("Cycle", ["1st to 15th (Period 1)", "16th to Month-End (Period 2)"])
            
        last_day = 31 if target_month in [1,3,5,7,8,10,12] else (30 if target_month != 2 else 28)
        if "1st to 15th" in settlement_period:
            start_period_date = date(target_year, target_month, 1)
            end_period_date = date(target_year, target_month, 15)
        else:
            start_period_date = date(target_year, target_month, 16)
            end_period_date = date(target_year, target_month, last_day)
    else:
        with col_filter3:
            dc1, dc2 = st.columns(2)
            with dc1:
                start_period_date = st.date_input("From Date (X Date)*", date.today().replace(day=1))
            with dc2:
                end_period_date = st.date_input("To Date (Y Date)*", date.today())

    st.info(f"Settlement Window: **{start_period_date.strftime('%d-%b-%Y')}** to **{end_period_date.strftime('%d-%b-%Y')}**")

    period_trips = run_query("""
        SELECT 
            t.trip_id, t.trip_number, t.trip_end_date, v.vehicle_number,
            t.origin, t.destination, t.total_km_run, t.tonnage_loaded,
            t.driver_bata,
            t.cash_advance_issued AS trip_advance_issued,
            (t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense) AS out_of_pocket_claims,
            t.settlement_status
        FROM trips t
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        WHERE t.primary_driver_id = %s
          AND t.trip_end_date >= %s 
          AND t.trip_end_date <= %s
        ORDER BY t.trip_end_date ASC
    """, (selected_driver_id, start_period_date, end_period_date))

    direct_advances = run_query("""
        SELECT advance_id, advance_date, amount_inr, advance_type, payment_mode, reference_remarks, is_settled
        FROM driver_direct_advances
        WHERE driver_id = %s
          AND advance_date >= %s
          AND advance_date <= %s
        ORDER BY advance_date ASC
    """, (selected_driver_id, start_period_date, end_period_date))

    st.markdown('<div class="section-header">1. Trips Performed in Cycle</div>', unsafe_allow_html=True)
    if period_trips:
        df_period = pd.DataFrame(period_trips)
        st.dataframe(df_period, use_container_width=True)
        total_bata = float(df_period['driver_bata'].sum())
        total_claims = float(df_period['out_of_pocket_claims'].sum())
        total_trip_advances = float(df_period['trip_advance_issued'].sum())
    else:
        st.info("No trips logged for this driver during the selected cycle.")
        df_period = pd.DataFrame(columns=[
            "trip_id", "trip_number", "trip_end_date", "vehicle_number",
            "origin", "destination", "total_km_run", "tonnage_loaded",
            "driver_bata", "trip_advance_issued", "out_of_pocket_claims", "settlement_status"
        ])
        total_bata = 0.00
        total_claims = 0.00
        total_trip_advances = 0.00

    st.markdown('<div class="section-header">2. Direct Advances / Loans Drawn</div>', unsafe_allow_html=True)
    if direct_advances:
        df_dir_adv = pd.DataFrame(direct_advances)
        st.dataframe(df_dir_adv, use_container_width=True)
        total_direct_advances = float(df_dir_adv['amount_inr'].sum())
    else:
        st.info("No direct cash advances issued during this cycle.")
        df_dir_adv = pd.DataFrame(columns=[
            "advance_id", "advance_date", "amount_inr", "advance_type",
            "payment_mode", "reference_remarks", "is_settled"
        ])
        total_direct_advances = 0.00

    total_advances_combined = total_trip_advances + total_direct_advances
    net_payable = (total_bata + total_claims) - total_advances_combined

    st.markdown("---")
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Earned Driver Bata", f"INR {total_bata:,.2f}")
    m2.metric("Out-of-Pocket Claims", f"INR {total_claims:,.2f}")
    m3.metric("Total Advances (Trip + Direct)", f"INR {total_advances_combined:,.2f}")
    m4.metric("Net Settlement Balance", f"INR {net_payable:,.2f}")

    st.write("")
    act1, act2 = st.columns(2)
    with act1:
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df_period.to_excel(writer, index=False, sheet_name='Trips Ledger')
            df_dir_adv.to_excel(writer, index=False, sheet_name='Direct Advances')
            
            summary_df = pd.DataFrame([{
                "Driver Name": chosen_driver,
                "From Date": str(start_period_date),
                "To Date": str(end_period_date),
                "Total Bata Earned (INR)": total_bata,
                "Total Claims (INR)": total_claims,
                "Trip Advances (INR)": total_trip_advances,
                "Direct Advances (INR)": total_direct_advances,
                "Total Advances Deducted (INR)": total_advances_combined,
                "Net Payable / Balance (INR)": net_payable
            }])
            summary_df.to_excel(writer, index=False, sheet_name='Settlement Summary')

        st.download_button(
            "Export Comprehensive Settlement Sheet (Excel)",
            data=buffer.getvalue(),
            file_name=f"settlement_{chosen_driver.split('-')[0].strip()}_{start_period_date}_{end_period_date}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    with act2:
        if st.button("Mark All Trips and Advances as SETTLED", type="primary"):
            run_query("""
                UPDATE trips 
                SET settlement_status = 'SETTLED', settled_at = CURRENT_TIMESTAMP 
                WHERE primary_driver_id = %s 
                  AND trip_end_date >= %s 
                  AND trip_end_date <= %s
            """, (selected_driver_id, start_period_date, end_period_date), fetch=False)

            run_query("""
                UPDATE driver_direct_advances
                SET is_settled = TRUE, settled_at = CURRENT_TIMESTAMP
                WHERE driver_id = %s
                  AND advance_date >= %s
                  AND advance_date <= %s
            """, (selected_driver_id, start_period_date, end_period_date), fetch=False)

            st.success("Trips and Direct Advances marked as SETTLED.")
            st.rerun()

# ==============================================================================
# 7. MASTER DATA MANAGEMENT (TABS A, B, C, D)
# ==============================================================================
elif menu == "Master Data Management":
    st.subheader("Master Data Configuration & Registries")

    tab_a, tab_b, tab_c, tab_d = st.tabs([
        "A) Vehicle Master",
        "B) Driver Master",
        "C) Freight Rates Master (Source & Destination)",
        "D) Driver Bata Master"
    ])

    # TAB A: VEHICLES MASTER
    with tab_a:
        v_list = get_cached_vehicles()
        if v_list:
            df_v = pd.DataFrame(v_list)
            st.dataframe(
                df_v[['vehicle_id', 'vehicle_number', 'truck_type', 'carrying_capacity_tons', 'current_status', 'status_remarks']],
                column_config={
                    "vehicle_id": "ID",
                    "vehicle_number": "Vehicle Number",
                    "truck_type": "Variant / Type",
                    "carrying_capacity_tons": "Class (MT)",
                    "current_status": "Status",
                    "status_remarks": "Remarks"
                },
                hide_index=True,
                use_container_width=True
            )

        col_va, col_vb = st.columns(2)
        with col_va:
            st.markdown('<div class="section-header">Create New Truck</div>', unsafe_allow_html=True)
            with st.form("create_veh_form", clear_on_submit=True):
                nv_num = st.text_input("Vehicle Number*", placeholder="e.g. KL43Q3608").upper().strip()
                nv_type = st.selectbox("Truck Variant", [
                    "Bulker (16-Wheel)",
                    "Bulker (14-Wheel)",
                    "Bulker",
                    "Body Truck (14-Wheel)",
                    "Body Truck"
                ])
                nv_cap = st.selectbox("Capacity Class (MT)*", [25.0, 30.0, 35.0], index=2)

                if st.form_submit_button("Save Truck Master", type="primary", use_container_width=True):
                    if not nv_num:
                        st.error("Vehicle registration number is mandatory.")
                    elif run_query("SELECT vehicle_id FROM vehicles WHERE LOWER(vehicle_number) = LOWER(%s)", (nv_num,)):
                        st.warning(f"Truck '{nv_num}' already exists in registry.")
                    else:
                        run_query("""
                            INSERT INTO vehicles (vehicle_number, truck_type, carrying_capacity_tons, current_status)
                            VALUES (%s, %s, %s, 'AVAILABLE_FOR_LOAD')
                        """, (nv_num, nv_type, nv_cap), fetch=False)
                        get_cached_vehicles.clear()
                        st.success(f"Truck {nv_num} created successfully.")
                        st.rerun()

        with col_vb:
            st.markdown('<div class="section-header">Edit Existing Truck</div>', unsafe_allow_html=True)
            if v_list:
                v_edit_map = {f"{v['vehicle_number']} ({v['truck_type']} - {v['carrying_capacity_tons']} MT)": v for v in v_list}
                sel_v_edit = st.selectbox("Select Truck to Edit", list(v_edit_map.keys()), key="sel_v_edit")
                t_v = v_edit_map[sel_v_edit]

                with st.form("edit_veh_form"):
                    ev_type = st.selectbox("Truck Variant", [
                        "Bulker (16-Wheel)",
                        "Bulker (14-Wheel)",
                        "Bulker",
                        "Body Truck (14-Wheel)",
                        "Body Truck"
                    ], index=["Bulker (16-Wheel)", "Bulker (14-Wheel)", "Bulker", "Body Truck (14-Wheel)", "Body Truck"].index(t_v['truck_type']) if t_v['truck_type'] in ["Bulker (16-Wheel)", "Bulker (14-Wheel)", "Bulker", "Body Truck (14-Wheel)", "Body Truck"] else 0)
                    
                    cap_opts = [25.0, 30.0, 35.0]
                    cur_cap = float(t_v['carrying_capacity_tons'])
                    ev_cap = st.selectbox("Capacity Class (MT)", cap_opts, index=cap_opts.index(cur_cap) if cur_cap in cap_opts else 2)

                    if st.form_submit_button("Update Truck Details", use_container_width=True):
                        run_query("""
                            UPDATE vehicles 
                            SET truck_type = %s, carrying_capacity_tons = %s 
                            WHERE vehicle_id = %s
                        """, (ev_type, ev_cap, t_v['vehicle_id']), fetch=False)
                        get_cached_vehicles.clear()
                        st.success(f"Truck {t_v['vehicle_number']} updated.")
                        st.rerun()

    # TAB B: DRIVERS MASTER
    with tab_b:
        d_list = get_cached_drivers(include_inactive=True)
        if d_list:
            df_d = pd.DataFrame(d_list)
            st.dataframe(
                df_d[['driver_id', 'driver_code', 'full_name', 'phone_number', 'license_number', 'license_expiry_date', 'is_active']],
                column_config={
                    "driver_id": "ID",
                    "driver_code": "Driver Code",
                    "full_name": "Full Name",
                    "phone_number": "Phone",
                    "license_number": "License No",
                    "license_expiry_date": "License Expiry",
                    "is_active": "Active Status"
                },
                hide_index=True,
                use_container_width=True
            )

        col_da, col_db = st.columns(2)
        with col_da:
            st.markdown('<div class="section-header">Create New Driver</div>', unsafe_allow_html=True)
            auto_drv_code = f"DRV-{len(d_list)+1:03d}"
            with st.form("create_driver_form", clear_on_submit=True):
                nd_code = st.text_input("Driver Code*", value=auto_drv_code).strip().upper()
                nd_name = st.text_input("Driver Full Name*").strip()
                nd_phone = st.text_input("Contact Phone Number*").strip()
                nd_lic = st.text_input("License Number*").strip().upper()
                nd_exp = st.date_input("License Expiry Date", date(2030, 1, 1))

                if st.form_submit_button("Save Driver Master", type="primary", use_container_width=True):
                    if not nd_code or not nd_name or not nd_phone or not nd_lic:
                        st.error("All driver fields are mandatory.")
                    elif run_query("SELECT driver_id FROM drivers WHERE LOWER(driver_code) = LOWER(%s) OR license_number = %s", (nd_code, nd_lic)):
                        st.warning("Warning: A driver with this Code or License Number already exists.")
                    else:
                        run_query("""
                            INSERT INTO drivers (driver_code, full_name, phone_number, license_number, license_expiry_date, branch_id)
                            VALUES (%s, %s, %s, %s, %s, 1)
                        """, (nd_code, nd_name, nd_phone, nd_lic, nd_exp), fetch=False)
                        get_cached_drivers.clear()
                        st.success(f"Driver '{nd_name}' created.")
                        st.rerun()

        with col_db:
            st.markdown('<div class="section-header">Edit Existing Driver</div>', unsafe_allow_html=True)
            if d_list:
                d_edit_map = {f"{d['driver_code']} - {d['full_name']}": d for d in d_list}
                sel_d_edit = st.selectbox("Select Driver to Edit", list(d_edit_map.keys()), key="sel_d_edit")
                t_d = d_edit_map[sel_d_edit]

                with st.form("edit_driver_form"):
                    ed_name = st.text_input("Full Name", value=t_d['full_name'])
                    ed_phone = st.text_input("Phone Number", value=t_d['phone_number'])
                    ed_lic = st.text_input("License Number", value=t_d['license_number'])
                    ed_exp = st.date_input("License Expiry", value=t_d['license_expiry_date'] or date(2030, 1, 1))
                    ed_act = st.checkbox("Is Driver Active?", value=bool(t_d.get('is_active', True)))

                    if st.form_submit_button("Update Driver Master", use_container_width=True):
                        run_query("""
                            UPDATE drivers 
                            SET full_name = %s, phone_number = %s, license_number = %s, license_expiry_date = %s, is_active = %s
                            WHERE driver_id = %s
                        """, (ed_name, ed_phone, ed_lic, ed_exp, ed_act, t_d['driver_id']), fetch=False)
                        get_cached_drivers.clear()
                        st.success(f"Driver '{ed_name}' updated.")
                        st.rerun()

    # TAB C: FREIGHT RATES MASTER
    with tab_c:
        r_list = get_cached_routes()
        if r_list:
            df_r = pd.DataFrame(r_list)
            st.dataframe(
                df_r[['destination_id', 'cargo_type', 'origin', 'destination_name', 'capacity_tons', 'freight_rate_per_ton', 'standard_km']],
                column_config={
                    "destination_id": "ID",
                    "cargo_type": "Cargo Category",
                    "origin": "Source Hub",
                    "destination_name": "Destination",
                    "capacity_tons": "Truck Class (MT)",
                    "freight_rate_per_ton": "Freight Rate (INR/MT)",
                    "standard_km": "Standard KM"
                },
                hide_index=True,
                use_container_width=True
            )

        col_ca, col_cb = st.columns(2)
        with col_ca:
            st.markdown('<div class="section-header">Create Freight Slab</div>', unsafe_allow_html=True)
            with st.form("create_route_form", clear_on_submit=True):
                rc_cargo = st.selectbox("Cargo Category", ["BULK", "BAG"])
                rc_origin = st.selectbox("Source (Origin Hub)*", ["COCHIN", "POTTANERI", "METTUR", "UDUPPI", "COCHIN-ACC", "TUTICORIN", "CUSTOM"])
                if rc_origin == "CUSTOM":
                    rc_origin_text = st.text_input("Custom Source Hub Name*").strip().upper()
                else:
                    rc_origin_text = rc_origin
                
                rc_dest = st.text_input("Destination Terminal Name*", placeholder="e.g. SANKARI / ALUVA").strip().upper()
                rc_class = st.selectbox("Truck Capacity Class (MT)*", [25.0, 30.0, 35.0], index=2)
                rc_rate = st.number_input("Agreed Freight Rate (INR/MT)*", min_value=0.0, step=25.0, value=0.0)
                rc_km = st.number_input("Standard Route Distance (KM)", min_value=0.0, step=10.0, value=0.0)

                if st.form_submit_button("Save Freight Rate Slab", type="primary", use_container_width=True):
                    if not rc_origin_text or not rc_dest or rc_rate <= 0:
                        st.error("Source, Destination, and Rate are mandatory.")
                    else:
                        run_query("""
                            INSERT INTO destinations_freight_master (cargo_type, origin, destination_name, capacity_tons, freight_rate_per_ton, standard_km)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            ON CONFLICT (cargo_type, origin, destination_name, capacity_tons)
                            DO UPDATE SET freight_rate_per_ton = EXCLUDED.freight_rate_per_ton, standard_km = EXCLUDED.standard_km;
                        """, (rc_cargo, rc_origin_text, rc_dest, rc_class, rc_rate, rc_km), fetch=False)
                        get_cached_routes.clear()
                        st.success(f"Freight Slab: {rc_origin_text} ➔ {rc_dest} ({rc_class} MT @ INR {rc_rate}/MT) saved.")
                        st.rerun()

        with col_cb:
            st.markdown('<div class="section-header">Edit / Delete Freight Slab</div>', unsafe_allow_html=True)
            if r_list:
                r_edit_map = {f"[{r['cargo_type']}] {r['origin']} ➔ {r['destination_name']} ({r['capacity_tons']} MT Class @ INR {r['freight_rate_per_ton']}/MT)": r for r in r_list}
                sel_r_edit = st.selectbox("Select Route Slab to Edit", list(r_edit_map.keys()), key="sel_r_edit")
                t_r = r_edit_map[sel_r_edit]

                with st.form("edit_route_form"):
                    er_rate = st.number_input("Updated Rate per MT (INR)*", min_value=0.0, step=25.0, value=float(t_r['freight_rate_per_ton']))
                    er_km = st.number_input("Updated Standard KM", min_value=0.0, step=10.0, value=float(t_r['standard_km'] or 0.0))

                    c_sub1, c_sub2 = st.columns(2)
                    with c_sub1:
                        btn_upd_r = st.form_submit_button("Update Rate", use_container_width=True)
                    with c_sub2:
                        btn_del_r = st.form_submit_button("Delete Slab", type="secondary", use_container_width=True)

                    if btn_upd_r:
                        run_query("""
                            UPDATE destinations_freight_master 
                            SET freight_rate_per_ton = %s, standard_km = %s 
                            WHERE destination_id = %s
                        """, (er_rate, er_km, t_r['destination_id']), fetch=False)
                        get_cached_routes.clear()
                        st.success("Freight rate slab updated.")
                        st.rerun()

                    if btn_del_r:
                        run_query("DELETE FROM destinations_freight_master WHERE destination_id = %s", (t_r['destination_id'],), fetch=False)
                        get_cached_routes.clear()
                        st.success("Freight slab removed.")
                        st.rerun()

    # TAB D: DRIVER BATA MASTER
    with tab_d:
        st.markdown('<div class="section-header">Configured Driver Bata Rules</div>', unsafe_allow_html=True)
        bata_rules = get_cached_bata_rules()
        if bata_rules:
            df_b = pd.DataFrame(bata_rules)
            st.dataframe(
                df_b[['bata_rule_id', 'destination_name', 'cargo_type', 'vehicle_number', 'capacity_tons', 'standard_bata_inr']],
                column_config={
                    "bata_rule_id": "ID",
                    "destination_name": "Destination Terminal",
                    "cargo_type": "Cargo Category",
                    "vehicle_number": "Assigned Truck",
                    "capacity_tons": "Truck Class (MT)",
                    "standard_bata_inr": "Driver Bata (INR)"
                },
                hide_index=True,
                use_container_width=True
            )

        col_ba, col_bb = st.columns(2)
        vehicles = get_cached_vehicles()
        veh_bata_map = {f"{v['vehicle_number']} ({v['truck_type']} - {v['carrying_capacity_tons']} MT Class)": v for v in vehicles} if vehicles else {}

        with col_ba:
            st.markdown('<div class="section-header">Create Destination Driver Bata</div>', unsafe_allow_html=True)
            with st.form("create_bata_form", clear_on_submit=True):
                nb_dest = st.text_input("Destination Terminal Name*", placeholder="e.g. SANKARI / COIMBATORE").strip().upper()
                nb_cargo = st.selectbox("Cargo Category", ["BULK", "BAG"])
                nb_veh_str = st.selectbox("Target Truck Number*", list(veh_bata_map.keys()))
                target_veh_obj = veh_bata_map[nb_veh_str] if veh_bata_map else None
                nb_amount = st.number_input("Standard Driver Bata (INR)*", min_value=0.0, step=100.0, value=3000.0)

                if st.form_submit_button("Save Driver Bata Rule", type="primary", use_container_width=True):
                    if not nb_dest or not target_veh_obj or nb_amount <= 0:
                        st.error("Destination, Truck, and Bata Amount are required.")
                    else:
                        run_query("""
                            INSERT INTO driver_bata_master (destination_name, cargo_type, vehicle_id, capacity_tons, standard_bata_inr)
                            VALUES (%s, %s, %s, %s, %s)
                            ON CONFLICT (destination_name, cargo_type, vehicle_id)
                            DO UPDATE SET standard_bata_inr = EXCLUDED.standard_bata_inr;
                        """, (nb_dest, nb_cargo, target_veh_obj['vehicle_id'], target_veh_obj['carrying_capacity_tons'], nb_amount), fetch=False)
                        get_cached_bata_rules.clear()
                        st.success(f"Driver Bata of INR {nb_amount:,.2f} recorded for {target_veh_obj['vehicle_number']} to {nb_dest}.")
                        st.rerun()

        with col_bb:
            st.markdown('<div class="section-header">Edit / Delete Driver Bata Rule</div>', unsafe_allow_html=True)
            if bata_rules:
                b_edit_map = {f"{b['destination_name']} | Truck: {b['vehicle_number']} ({b['capacity_tons']} MT) ➔ INR {b['standard_bata_inr']}": b for b in bata_rules}
                sel_b_edit = st.selectbox("Select Bata Rule to Edit", list(b_edit_map.keys()), key="sel_b_edit")
                t_b = b_edit_map[sel_b_edit]

                with st.form("edit_bata_form"):
                    eb_amount = st.number_input("Updated Driver Bata (INR)*", min_value=0.0, step=100.0, value=float(t_b['standard_bata_inr']))
                    
                    b_sub1, b_sub2 = st.columns(2)
                    with b_sub1:
                        btn_upd_b = st.form_submit_button("Update Bata", use_container_width=True)
                    with b_sub2:
                        btn_del_b = st.form_submit_button("Delete Rule", type="secondary", use_container_width=True)

                    if btn_upd_b:
                        run_query("""
                            UPDATE driver_bata_master 
                            SET standard_bata_inr = %s 
                            WHERE bata_rule_id = %s
                        """, (eb_amount, t_b['bata_rule_id']), fetch=False)
                        get_cached_bata_rules.clear()
                        st.success("Driver bata rule updated.")
                        st.rerun()

                    if btn_del_b:
                        run_query("DELETE FROM driver_bata_master WHERE bata_rule_id = %s", (t_b['bata_rule_id'],), fetch=False)
                        get_cached_bata_rules.clear()
                        st.success("Driver bata rule removed.")
                        st.rerun()

# ==============================================================================
# 8. EXECUTIVE RETENTION & DRIVER PERFORMANCE ANALYTICS
# ==============================================================================
elif menu == "Executive Retention & Yield Analytics":
    st.subheader("Executive Corporate Fleet Retention & Operational Yield Dashboard")

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
            start_filter_date = st.date_input("Period From*", today.replace(day=1))
        with tfc3:
            end_filter_date = st.date_input("Period To*", today)
    else:
        start_filter_date = None
        end_filter_date = None

    tab_overview, tab_driver_perf, tab_variant_peer, tab_daily_yield, tab_branch_mom = st.tabs([
        "1. Executive Fleet Yield Summary",
        "2. Driver Performance & Safety Audit",
        "3. Variant Peer Benchmarking (30 MT vs 30 MT / 35 MT vs 35 MT)",
        "4. Asset Turnover & Yield Per Day",
        "5. Month-on-Month Retention Trajectory"
    ])

    base_where = "WHERE v.is_active = TRUE"
    date_params = []
    if start_filter_date and end_filter_date:
        base_where += " AND t.trip_end_date >= %s AND t.trip_end_date <= %s"
        date_params.extend([start_filter_date, end_filter_date])

    comprehensive_query = f"""
        SELECT 
            v.vehicle_number,
            v.truck_type,
            v.carrying_capacity_tons,
            COUNT(t.trip_id) AS total_trips,
            COUNT(CASE WHEN t.trip_status = 'COMPLETED' THEN 1 END) AS closed_trips,
            COALESCE(SUM(GREATEST(1, (t.trip_end_date - t.trip_start_date) + 1)), 0) AS operational_days,
            COALESCE(SUM(t.total_km_run), 0.00) AS total_km_run,
            COALESCE(SUM(t.loaded_weight_mt), 0.00) AS total_loaded_mt,
            COALESCE(SUM(COALESCE(t.unloaded_weight_mt, t.loaded_weight_mt)), 0.00) AS total_delivered_mt,
            COALESCE(SUM(t.shortage_mt), 0.00) AS total_shortage_mt,
            COALESCE(SUM(t.shortage_penalty_deduction), 0.00) AS total_shortage_deductions_inr,
            COALESCE(SUM(t.freight_revenue), 0.00) AS gross_freight_revenue_inr,
            COALESCE(SUM(t.fuel_litres), 0.00) AS total_fuel_litres,
            COALESCE(SUM(t.fuel_expense), 0.00) AS total_fuel_cost_inr,
            COALESCE(SUM(t.driver_bata), 0.00) AS total_driver_bata_inr,
            COALESCE(SUM(t.toll_fastag_expense), 0.00) AS total_toll_expense_inr,
            COALESCE(SUM(t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense), 0.00) AS adhoc_repairs_claims_inr,
            COALESCE(SUM(t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense), 0.00) AS total_direct_operating_costs_inr,
            COALESCE(SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense)), 0.00) AS net_retained_profit_inr,
            ROUND(
                (COALESCE(SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense)), 0.00) / 
                NULLIF(SUM(t.freight_revenue), 0.00)) * 100.0, 2
            ) AS retention_margin_pct,
            ROUND(SUM(t.total_km_run) / NULLIF(SUM(t.fuel_litres), 0.00), 2) AS average_mileage_kmpl,
            ROUND(
                SUM(t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense) / 
                NULLIF(SUM(t.total_km_run), 0.00), 2
            ) AS operating_cost_per_km_inr,
            ROUND(
                SUM(t.freight_revenue) / 
                NULLIF(SUM(t.total_km_run), 0.00), 2
            ) AS revenue_per_km_inr,
            ROUND(
                SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense)) / 
                NULLIF(SUM(t.total_km_run), 0.00), 2
            ) AS net_yield_per_km_inr,
            ROUND(
                SUM(t.freight_revenue) / 
                NULLIF(SUM(GREATEST(1, (t.trip_end_date - t.trip_start_date) + 1)), 0), 2
            ) AS revenue_per_day_inr,
            ROUND(
                SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense)) / 
                NULLIF(SUM(GREATEST(1, (t.trip_end_date - t.trip_start_date) + 1)), 0), 2
            ) AS profit_per_day_inr,
            ROUND(
                SUM(t.total_km_run) / 
                NULLIF(SUM(GREATEST(1, (t.trip_end_date - t.trip_start_date) + 1)), 0), 2
            ) AS km_run_per_day
        FROM vehicles v
        LEFT JOIN trips t ON v.vehicle_id = t.vehicle_id
        {base_where}
        GROUP BY v.vehicle_number, v.truck_type, v.carrying_capacity_tons
        ORDER BY net_retained_profit_inr DESC;
    """

    df_analytics = pd.DataFrame(run_query(comprehensive_query, tuple(date_params) if date_params else None))

    # --- 1. EXECUTIVE FLEET YIELD SUMMARY ---
    with tab_overview:
        if df_analytics.empty or df_analytics['total_trips'].sum() == 0:
            st.info("No trip records available within the chosen analytics timeframe.")
        else:
            tot_rev = float(df_analytics['gross_freight_revenue_inr'].sum() or 0.0)
            tot_costs = float(df_analytics['total_direct_operating_costs_inr'].sum() or 0.0)
            tot_profit = float(df_analytics['net_retained_profit_inr'].sum() or 0.0)
            avg_margin = round((tot_profit / max(1.0, tot_rev)) * 100.0, 2) if tot_rev > 0 else 0.00
            tot_kms = float(df_analytics['total_km_run'].sum() or 0.0)
            tot_fuel = float(df_analytics['total_fuel_litres'].sum() or 0.0)
            fleet_kmpl = round(tot_kms / max(1.0, tot_fuel), 2) if tot_fuel > 0 else 0.00
            tot_tonnage = float(df_analytics['total_delivered_mt'].sum() or 0.0)

            kpi1, kpi2, kpi3, kpi4, kpi5, kpi6 = st.columns(6)
            kpi1.metric("Gross Freight Revenue", f"INR {tot_rev:,.2f}")
            kpi2.metric("Total Direct Trip Costs", f"INR {tot_costs:,.2f}")
            kpi3.metric("Net Retained Margin", f"INR {tot_profit:,.2f}")
            kpi4.metric("Retention Yield Margin", f"{avg_margin:.2f} %")
            kpi5.metric("Average Fleet Mileage", f"{fleet_kmpl:.2f} KMPL")
            kpi6.metric("Total MT Delivered", f"{tot_tonnage:,.2f} MT")

            st.markdown('<div class="section-header">Corporate Fleet Unit Economics & Cost Audit</div>', unsafe_allow_html=True)
            st.dataframe(
                df_analytics[[
                    'vehicle_number', 'truck_type', 'carrying_capacity_tons', 'total_trips', 'closed_trips',
                    'total_km_run', 'total_delivered_mt', 'gross_freight_revenue_inr', 'total_fuel_cost_inr',
                    'total_driver_bata_inr', 'total_toll_expense_inr', 'adhoc_repairs_claims_inr',
                    'total_direct_operating_costs_inr', 'net_retained_profit_inr', 'retention_margin_pct',
                    'average_mileage_kmpl', 'operating_cost_per_km_inr', 'revenue_per_km_inr', 'net_yield_per_km_inr'
                ]],
                column_config={
                    "vehicle_number": "Vehicle Number",
                    "truck_type": "Variant",
                    "carrying_capacity_tons": "Class (MT)",
                    "total_trips": "Trips",
                    "closed_trips": "Closed",
                    "total_km_run": "KM Run",
                    "total_delivered_mt": "Delivered MT",
                    "gross_freight_revenue_inr": "Gross Revenue (INR)",
                    "total_fuel_cost_inr": "Fuel Cost (INR)",
                    "total_driver_bata_inr": "Bata (INR)",
                    "total_toll_expense_inr": "FASTag (INR)",
                    "adhoc_repairs_claims_inr": "Repairs & Claims (INR)",
                    "total_direct_operating_costs_inr": "Total Direct Costs (INR)",
                    "net_retained_profit_inr": "Net Retained Profit (INR)",
                    "retention_margin_pct": "Margin %",
                    "average_mileage_kmpl": "Mileage (KMPL)",
                    "operating_cost_per_km_inr": "Cost / KM (INR)",
                    "revenue_per_km_inr": "Revenue / KM (INR)",
                    "net_yield_per_km_inr": "Net Profit / KM (INR)"
                },
                hide_index=True,
                use_container_width=True
            )

    # --- 2. DRIVER PERFORMANCE & SAFETY AUDIT (NEW TAB) ---
    with tab_driver_perf:
        st.markdown('<div class="section-header">Driver Operational Efficiency, Mileage & Shortage Audit</div>', unsafe_allow_html=True)

        driver_where = "WHERE d.is_active = TRUE"
        driver_params = []
        if start_filter_date and end_filter_date:
            driver_where += " AND t.trip_end_date >= %s AND t.trip_end_date <= %s"
            driver_params.extend([start_filter_date, end_filter_date])

        driver_perf_query = f"""
            SELECT 
                d.driver_code,
                d.full_name AS driver_name,
                d.phone_number,
                COUNT(t.trip_id) AS total_trips_logged,
                COUNT(CASE WHEN t.trip_status = 'COMPLETED' THEN 1 END) AS closed_trips,
                COALESCE(SUM(t.total_km_run), 0.00) AS total_kms_driven,
                COALESCE(SUM(COALESCE(t.unloaded_weight_mt, t.loaded_weight_mt)), 0.00) AS total_mt_delivered,
                COALESCE(SUM(t.fuel_litres), 0.00) AS total_fuel_consumed_litres,
                ROUND(SUM(t.total_km_run) / NULLIF(SUM(t.fuel_litres), 0.00), 2) AS average_driver_mileage_kmpl,
                COALESCE(SUM(t.shortage_mt), 0.00) AS total_shortage_mt,
                COUNT(CASE WHEN COALESCE(t.shortage_mt, 0.00) > 0.00 THEN 1 END) AS shortage_incident_count,
                COALESCE(SUM(t.shortage_penalty_deduction), 0.00) AS total_shortage_penalties_inr,
                COALESCE(SUM(t.freight_revenue), 0.00) AS gross_freight_generated_inr,
                COALESCE(SUM(t.driver_bata), 0.00) AS total_bata_earned_inr,
                COALESCE(SUM(t.cash_advance_issued), 0.00) AS total_trip_advances_drawn_inr,
                COALESCE(SUM(t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense), 0.00) AS out_of_pocket_claims_inr,
                COALESCE(SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense)), 0.00) AS net_profit_contribution_inr,
                ROUND(
                    (COALESCE(SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense)), 0.00) / 
                    NULLIF(SUM(t.freight_revenue), 0.00)) * 100.0, 2
                ) AS driver_retention_margin_pct
            FROM drivers d
            LEFT JOIN trips t ON d.driver_id = t.primary_driver_id
            {driver_where}
            GROUP BY d.driver_id, d.driver_code, d.full_name, d.phone_number
            ORDER BY gross_freight_generated_inr DESC;
        """

        df_drivers = pd.DataFrame(run_query(driver_perf_query, tuple(driver_params) if driver_params else None))

        if df_drivers.empty or df_drivers['total_trips_logged'].sum() == 0:
            st.info("No driver trip records available in the selected window.")
        else:
            d_tot_trips = df_drivers['total_trips_logged'].sum()
            d_tot_kms = float(df_drivers['total_kms_driven'].sum() or 0.0)
            d_tot_fuel = float(df_drivers['total_fuel_consumed_litres'].sum() or 0.0)
            d_avg_kmpl = round(d_tot_kms / max(1.0, d_tot_fuel), 2) if d_tot_fuel > 0 else 0.00
            d_tot_bata = float(df_drivers['total_bata_earned_inr'].sum() or 0.0)
            d_tot_shortage = float(df_drivers['total_shortage_mt'].sum() or 0.0)

            dk1, dk2, dk3, dk4, dk5 = st.columns(5)
            dk1.metric("Active Drivers Tracked", len(df_drivers))
            dk2.metric("Total Trips Steered", int(d_tot_trips))
            dk3.metric("Fleet Average Driver KMPL", f"{d_avg_kmpl:.2f} KMPL")
            dk4.metric("Total Driver Bata Earned", f"INR {d_tot_bata:,.2f}")
            dk5.metric("Total Shortage Detected", f"{d_tot_shortage:.2f} MT")

            st.dataframe(
                df_drivers[[
                    'driver_code', 'driver_name', 'phone_number', 'total_trips_logged', 'closed_trips',
                    'total_kms_driven', 'total_mt_delivered', 'average_driver_mileage_kmpl',
                    'total_shortage_mt', 'shortage_incident_count', 'total_shortage_penalties_inr',
                    'gross_freight_generated_inr', 'total_bata_earned_inr', 'total_trip_advances_drawn_inr',
                    'net_profit_contribution_inr', 'driver_retention_margin_pct'
                ]],
                column_config={
                    "driver_code": "Code",
                    "driver_name": "Driver Name",
                    "phone_number": "Phone",
                    "total_trips_logged": "Total Trips",
                    "closed_trips": "Closed",
                    "total_kms_driven": "Total KM",
                    "total_mt_delivered": "Delivered MT",
                    "average_driver_mileage_kmpl": "Driver KMPL",
                    "total_shortage_mt": "Shortage (MT)",
                    "shortage_incident_count": "Shortage Trips",
                    "total_shortage_penalties_inr": "Penalty (INR)",
                    "gross_freight_generated_inr": "Gross Revenue (INR)",
                    "total_bata_earned_inr": "Bata Earned (INR)",
                    "total_trip_advances_drawn_inr": "Advances Drawn (INR)",
                    "net_profit_contribution_inr": "Net Retained Margin (INR)",
                    "driver_retention_margin_pct": "Margin %"
                },
                hide_index=True,
                use_container_width=True
            )

    # --- 3. VARIANT PEER BENCHMARKING ---
    with tab_variant_peer:
        st.markdown('<div class="section-header">Variant Peer Benchmarking & Like-for-Like Analysis</div>', unsafe_allow_html=True)
        
        col_vp1, col_vp2 = st.columns(2)
        all_variants = sorted(list(set(df_analytics['truck_type'].tolist()))) if not df_analytics.empty else []
        all_classes = sorted(list(set(df_analytics['carrying_capacity_tons'].tolist()))) if not df_analytics.empty else []

        with col_vp1:
            sel_var_benchmark = st.selectbox("Benchmark Vehicle Variant", ["All Fleet Configurations"] + all_variants)
        with col_vp2:
            sel_class_benchmark = st.selectbox("Benchmark Payload Capacity Class (MT)", ["All Capacity Classes"] + [f"{float(c):.1f} MT" for c in all_classes])

        filtered_peer_df = df_analytics.copy()
        if sel_var_benchmark != "All Fleet Configurations":
            filtered_peer_df = filtered_peer_df[filtered_peer_df['truck_type'] == sel_var_benchmark]
        if sel_class_benchmark != "All Capacity Classes":
            c_val = float(sel_class_benchmark.replace(" MT", ""))
            filtered_peer_df = filtered_peer_df[filtered_peer_df['carrying_capacity_tons'] == c_val]

        if filtered_peer_df.empty:
            st.info("No vehicles match the selected peer group parameters.")
        else:
            avg_peer_margin = float(filtered_peer_df['retention_margin_pct'].mean() or 0.0)
            avg_peer_kmpl = float(filtered_peer_df['average_mileage_kmpl'].mean() or 0.0)
            avg_peer_cost_km = float(filtered_peer_df['operating_cost_per_km_inr'].mean() or 0.0)
            avg_peer_rev_km = float(filtered_peer_df['revenue_per_km_inr'].mean() or 0.0)

            pm1, pm2, pm3, pm4 = st.columns(4)
            pm1.metric("Peer Group Avg Margin", f"{avg_peer_margin:.2f} %")
            pm2.metric("Peer Group Avg Mileage", f"{avg_peer_kmpl:.2f} KMPL")
            pm3.metric("Peer Cost / KM", f"INR {avg_peer_cost_km:.2f} / KM")
            pm4.metric("Peer Revenue / KM", f"INR {avg_peer_rev_km:.2f} / KM")

            st.dataframe(
                filtered_peer_df[[
                    'vehicle_number', 'truck_type', 'carrying_capacity_tons', 'total_trips', 'total_km_run',
                    'gross_freight_revenue_inr', 'total_direct_operating_costs_inr', 'net_retained_profit_inr',
                    'retention_margin_pct', 'average_mileage_kmpl', 'operating_cost_per_km_inr',
                    'revenue_per_km_inr', 'net_yield_per_km_inr'
                ]],
                column_config={
                    "vehicle_number": "Vehicle Number",
                    "truck_type": "Variant",
                    "carrying_capacity_tons": "Capacity Class",
                    "total_trips": "Trips",
                    "total_km_run": "KM Run",
                    "gross_freight_revenue_inr": "Gross Revenue (INR)",
                    "total_direct_operating_costs_inr": "Direct Costs (INR)",
                    "net_retained_profit_inr": "Retained Profit (INR)",
                    "retention_margin_pct": "Margin %",
                    "average_mileage_kmpl": "Mileage (KMPL)",
                    "operating_cost_per_km_inr": "Cost / KM (INR)",
                    "revenue_per_km_inr": "Rev / KM (INR)",
                    "net_yield_per_km_inr": "Net / KM (INR)"
                },
                hide_index=True,
                use_container_width=True
            )

    # --- 4. ASSET TURNOVER & YIELD PER DAY ---
    with tab_daily_yield:
        st.markdown('<div class="section-header">Asset Turnover & Velocity Metrics (Per Operating Day)</div>', unsafe_allow_html=True)
        if df_analytics.empty:
            st.info("No asset performance data available.")
        else:
            st.dataframe(
                df_analytics[[
                    'vehicle_number', 'truck_type', 'carrying_capacity_tons', 'closed_trips', 'operational_days',
                    'gross_freight_revenue_inr', 'net_retained_profit_inr',
                    'revenue_per_day_inr', 'profit_per_day_inr', 'km_run_per_day'
                ]],
                column_config={
                    "vehicle_number": "Vehicle Number",
                    "truck_type": "Variant",
                    "carrying_capacity_tons": "Class (MT)",
                    "closed_trips": "POD Closed Trips",
                    "operational_days": "Active Operating Days",
                    "gross_freight_revenue_inr": "Total Revenue (INR)",
                    "net_retained_profit_inr": "Total Profit (INR)",
                    "revenue_per_day_inr": "Revenue / Day (INR)",
                    "profit_per_day_inr": "Net Retained Profit / Day (INR)",
                    "km_run_per_day": "Distance / Day (KM)"
                },
                hide_index=True,
                use_container_width=True
            )

    # --- 5. MONTH-ON-MONTH RETENTION TRAJECTORY ---
    with tab_branch_mom:
        st.markdown('<div class="section-header">Month-on-Month Branch Profitability & Yield Matrix</div>', unsafe_allow_html=True)
        mom_query = """
            SELECT 
                TO_CHAR(DATE_TRUNC('month', trip_end_date), 'Mon YYYY') AS operational_month,
                COUNT(trip_id) AS total_trips_logged,
                COUNT(CASE WHEN trip_status = 'COMPLETED' THEN 1 END) AS closed_trips,
                COALESCE(SUM(total_km_run), 0.00) AS total_kms,
                COALESCE(SUM(COALESCE(unloaded_weight_mt, loaded_weight_mt)), 0.00) AS total_mt_delivered,
                COALESCE(SUM(freight_revenue), 0.00) AS gross_freight_revenue_inr,
                COALESCE(SUM(fuel_expense), 0.00) AS total_fuel_expense_inr,
                COALESCE(SUM(driver_bata), 0.00) AS total_driver_bata_inr,
                COALESCE(SUM(toll_fastag_expense), 0.00) AS total_toll_expense_inr,
                COALESCE(SUM(enroute_repairs_maintenance + loading_unloading_expense + misc_trip_expense), 0.00) AS total_repairs_claims_inr,
                COALESCE(SUM(freight_revenue - (fuel_expense + driver_bata + toll_fastag_expense + enroute_repairs_maintenance + loading_unloading_expense + misc_trip_expense)), 0.00) AS gross_retained_profit_inr,
                ROUND(
                    (COALESCE(SUM(freight_revenue - (fuel_expense + driver_bata + toll_fastag_expense + enroute_repairs_maintenance + loading_unloading_expense + misc_trip_expense)), 0.00) / 
                    NULLIF(SUM(freight_revenue), 0.00)) * 100.0, 2
                ) AS retention_margin_pct,
                ROUND(SUM(total_km_run) / NULLIF(SUM(fuel_litres), 0.00), 2) AS fleet_average_kmpl,
                ROUND(
                    SUM(freight_revenue - (fuel_expense + driver_bata + toll_fastag_expense + enroute_repairs_maintenance + loading_unloading_expense + misc_trip_expense)) / 
                    NULLIF(SUM(total_km_run), 0.00), 2
                ) AS net_profit_per_km_inr
            FROM trips
            GROUP BY DATE_TRUNC('month', trip_end_date), TO_CHAR(DATE_TRUNC('month', trip_end_date), 'Mon YYYY')
            ORDER BY DATE_TRUNC('month', trip_end_date) DESC;
        """
        mom_data = run_query(mom_query)
        if mom_data:
            df_mom = pd.DataFrame(mom_data)
            st.dataframe(
                df_mom,
                column_config={
                    "operational_month": "Month",
                    "total_trips_logged": "Total Trips",
                    "closed_trips": "POD Closed",
                    "total_kms": "KM Run",
                    "total_mt_delivered": "MT Delivered",
                    "gross_freight_revenue_inr": "Gross Revenue (INR)",
                    "total_fuel_expense_inr": "Diesel Cost (INR)",
                    "total_driver_bata_inr": "Driver Bata (INR)",
                    "total_toll_expense_inr": "FASTag (INR)",
                    "total_repairs_claims_inr": "Repairs & Claims (INR)",
                    "gross_retained_profit_inr": "Net Retained Profit (INR)",
                    "retention_margin_pct": "Retention Margin %",
                    "fleet_average_kmpl": "Fleet KMPL",
                    "net_profit_per_km_inr": "Profit / KM (INR)"
                },
                hide_index=True,
                use_container_width=True
            )

    # Master Multi-Sheet Corporate Excel Export
    if not df_analytics.empty:
        st.write("")
        buf_exec = io.BytesIO()
        with pd.ExcelWriter(buf_exec, engine='openpyxl') as writer:
            df_analytics.to_excel(writer, index=False, sheet_name='Fleet Unit Economics')
            if 'df_drivers' in locals() and not df_drivers.empty:
                df_drivers.to_excel(writer, index=False, sheet_name='Driver Performance Audit')
            if 'df_mom' in locals() and not df_mom.empty:
                df_mom.to_excel(writer, index=False, sheet_name='Month-on-Month Trends')

        st.download_button(
            "Download Corporate Retention & Yield Workbook (Excel)",
            data=buf_exec.getvalue(),
            file_name=f"corporate_fleet_retention_report_{date.today()}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

# ==============================================================================
# 9. TRIP RECORDS REGISTRY
# ==============================================================================
elif menu == "Trip Records Registry":
    st.subheader("Master Trip Audit Log")
    trips_data = run_query("""
        SELECT 
            t.trip_id, t.trip_number, t.pod_number, t.trip_start_date, t.trip_end_date,
            v.vehicle_number, v.truck_type, d.full_name AS assigned_driver,
            t.origin, t.destination, t.start_km, t.end_km, t.total_km_run,
            t.loaded_weight_mt, t.unloaded_weight_mt, t.shortage_mt,
            t.freight_revenue, t.fuel_litres, t.fuel_expense,
            t.driver_bata, t.halt_bata, t.toll_fastag_expense, t.cash_advance_issued,
            (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense) AS total_trip_expense,
            (t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense)) AS net_margin,
            t.trip_status
        FROM trips t
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        JOIN drivers d ON t.primary_driver_id = d.driver_id
        ORDER BY t.trip_id DESC;
    """)

    if trips_data:
        df_all = pd.DataFrame(trips_data)
        st.dataframe(df_all, use_container_width=True)

        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine='openpyxl') as writer:
            df_all.to_excel(writer, index=False, sheet_name='Master Trip Log')

        st.download_button(
            "Export Complete Trip Registry (Excel)",
            data=buf.getvalue(),
            file_name=f"master_trip_registry_{date.today()}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

        st.markdown("---")
        st.markdown('<div class="section-header">Delete Trip Record</div>', unsafe_allow_html=True)
        del_id = st.selectbox("Select Trip ID to Delete", df_all['trip_id'].tolist())
        if st.button("Delete Selected Trip Record", type="primary"):
            run_query("DELETE FROM trips WHERE trip_id = %s", (del_id,), fetch=False)
            st.success(f"Trip ID {del_id} purged from registry.")
            st.rerun()
    else:
        st.info("Trip registry contains no records.")
