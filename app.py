import streamlit as st
import pandas as pd
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from datetime import date
import io

# --- Page Configuration ---
st.set_page_config(
    page_title="Fleet Operations & Accounts System",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# --- Corporate Custom CSS Styling ---
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
        font-size: 1.35rem;
        font-weight: 700;
        color: #1E293B;
    }
    div[data-testid="stMetricLabel"] {
        font-size: 0.82rem;
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
        "password": "YOUR_ACTUAL_SUPABASE_PASSWORD"
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
def get_cached_routes(cargo_type=None, capacity=None):
    query = "SELECT * FROM destinations_freight_master WHERE is_active = TRUE"
    params = []
    if cargo_type:
        query += " AND cargo_type = %s"
        params.append(cargo_type)
    if capacity:
        query += " AND capacity_tons = %s"
        params.append(capacity)
    query += " ORDER BY destination_name, capacity_tons ASC"
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
    if exclude_trip_id:
        res = run_query("SELECT trip_id FROM trips WHERE LOWER(trip_number) = LOWER(%s) AND trip_id != %s", (trip_no.strip(), exclude_trip_id))
    else:
        res = run_query("SELECT trip_id FROM trips WHERE LOWER(trip_number) = LOWER(%s)", (trip_no.strip(),))
    return len(res) > 0

def lookup_driver_bata(dest_name, cargo_type, vehicle_id):
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

# --- Top Navigation Bar ---
st.title("Fleet Operational Management System")

MODULE_LIST = [
    "Fleet Status Board",
    "Trip Dispatch Entry",
    "Trip & Sundry Diesel Logs",
    "Direct Driver Advances",
    "Trip Modification & Expenses",
    "Driver Period Settlement",
    "Master Data Management",
    "Variance & Performance Reports",
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
# 1. TRIP DISPATCH ENTRY (WITH AUTOMATIC DRIVER BATA MATRIX LOOKUP)
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

    top1, top2, top3 = st.columns(3)
    vehicle_map = {f"{v['vehicle_number']} | {v['truck_type']} | {v['carrying_capacity_tons']} MT": v for v in vehicles}
    
    with top1:
        sel_veh_label = st.selectbox("Assigned Vehicle*", list(vehicle_map.keys()), key=f"veh_sel_{cnt}")
        active_veh = vehicle_map[sel_veh_label]
        v_class_mt = float(active_veh['carrying_capacity_tons'])
        last_drv_id = get_last_driver_for_vehicle(active_veh['vehicle_id'])
    with top2:
        cargo_category = st.radio("Cargo Category", ["BULK", "BAG"], horizontal=True, key=f"cargo_sel_{cnt}")
    with top3:
        saved_d_rate = get_cached_diesel_rate()
        active_diesel_rate = st.number_input("Applicable Diesel Rate (INR/L)*", min_value=50.0, max_value=150.0, value=saved_d_rate, step=0.05, key=f"d_rate_{cnt}")
        if active_diesel_rate != saved_d_rate:
            set_saved_diesel_rate(active_diesel_rate)

    driver_dict = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers}
    driver_labels = list(driver_dict.keys())
    
    default_driver_index = 0
    if last_drv_id:
        for idx, d_obj in enumerate(driver_dict.values()):
            if d_obj['driver_id'] == last_drv_id:
                default_driver_index = idx
                break

    routes = get_cached_routes(cargo_type=cargo_category, capacity=v_class_mt)
    route_opts = {}
    if routes:
        for r in routes:
            label = f"{r['origin']} -> {r['destination_name']} [Std: {r['standard_km']} KM | Rate: INR {r['freight_rate_per_ton']}/MT]"
            route_opts[label] = r
    route_opts["-- MANUAL / SPOT ROUTE ENTRY --"] = {
        "origin": "COCHIN",
        "destination_name": "",
        "standard_km": 0.0,
        "freight_rate_per_ton": 0.0
    }

    sel_route_label = st.selectbox("Freight Contract Route Slab*", list(route_opts.keys()), key=f"route_sel_{cnt}")
    active_route = route_opts[sel_route_label]
    is_custom_route = (sel_route_label == "-- MANUAL / SPOT ROUTE ENTRY --")

    # Automatic Bata Lookup from Master
    default_dest = active_route['destination_name']
    master_bata_val = lookup_driver_bata(default_dest, cargo_category, active_veh['vehicle_id'])

    f1, f2, f3 = st.columns(3)
    with f1:
        st.markdown('<div class="section-header">1. Manifest & Driver Assignment</div>', unsafe_allow_html=True)
        lr_no = st.text_input("Trip / LR Number*", placeholder="LR-XXXXXX", key=f"lr_{cnt}")
        
        if lr_no.strip() and check_lr_exists(lr_no):
            st.error("DUPLICATE WARNING: This Trip/LR Number is already registered in the system.")

        chosen_driver_str = st.selectbox("Designated Driver*", driver_labels, index=default_driver_index, key=f"drv_{cnt}")
        sel_driver_obj = driver_dict[chosen_driver_str]

        if is_custom_route:
            origin_terminal = st.text_input("Origin*", value="COCHIN", key=f"orig_{cnt}").upper()
            dest_terminal = st.text_input("Destination Terminal*", value="", placeholder="e.g. SANKARI", key=f"dest_{cnt}").upper()
            agreed_rate_mt = st.number_input("Spot Freight Rate per MT (INR)*", min_value=0.0, step=25.0, value=0.0, key=f"rate_{cnt}")
        else:
            origin_terminal = active_route['origin']
            dest_terminal = active_route['destination_name']
            agreed_rate_mt = float(active_route['freight_rate_per_ton'])
            st.info(f"Origin: **{origin_terminal}** | Destination: **{dest_terminal}**\nRate: **INR {agreed_rate_mt:,.2f} / MT** | Master Bata: **INR {master_bata_val:,.2f}**")

    with f2:
        st.markdown('<div class="section-header">2. Odometer & Payload Metrics</div>', unsafe_allow_html=True)
        start_date = st.date_input("Trip Start Date", date.today(), key=f"sdate_{cnt}")
        end_date = st.date_input("Trip End Date", date.today(), key=f"edate_{cnt}")
        
        start_km = st.number_input("Load Start Odometer (KM)*", min_value=0.0, step=10.0, value=0.0, key=f"skm_{cnt}")
        end_km = st.number_input("Unload End Odometer (KM)*", min_value=0.0, step=10.0, value=0.0, key=f"ekm_{cnt}")
        
        computed_km = max(0.0, end_km - start_km) if end_km >= start_km and end_km > 0 else float(active_route['standard_km'])
        total_km_run = st.number_input("Total Trip KM Run*", min_value=0.0, step=10.0, value=computed_km, key=f"tkm_{cnt}")

        weighbridge_mt = st.number_input("Weighbridge Loaded Weight (MT)*", min_value=0.0, max_value=60.0, step=0.05, value=0.0, key=f"wmt_{cnt}")
        gross_freight = round(weighbridge_mt * agreed_rate_mt, 2)
        st.metric("Total Freight Revenue (INR)", f"INR {gross_freight:,.2f}")

    with f3:
        st.markdown('<div class="section-header">3. Fuel Logistics & Disbursements</div>', unsafe_allow_html=True)
        fuel_qty = st.number_input("Initial Diesel Quantity Issued (Litres)*", min_value=0.0, step=10.0, value=0.0, key=f"fqty_{cnt}")
        filling_km = st.number_input("Diesel Filling Odometer (KM)", min_value=0.0, step=10.0, value=0.0, key=f"fkm_{cnt}")
        
        gross_fuel_cost = round(fuel_qty * active_diesel_rate, 2)
        st.metric(f"Auto Diesel Expense (INR {active_diesel_rate}/L)", f"INR {gross_fuel_cost:,.2f}")

        driver_bata = st.number_input("Driver Bata Allowance (INR)* [Auto-Filled]", min_value=0.0, step=100.0, value=master_bata_val, key=f"bata_{cnt}")
        fastag_toll = st.number_input("FASTag / Toll Disbursement (INR)", min_value=0.0, step=100.0, value=0.0, key=f"toll_{cnt}")
        cash_advance = st.number_input("Trip Cash Advance Issued to Driver (INR)", min_value=0.0, step=500.0, value=0.0, key=f"adv_{cnt}")

    st.write("")
    if st.button("Save and Dispatch Trip Record", type="primary", use_container_width=True):
        if not lr_no.strip() or not dest_terminal.strip():
            st.error("Validation Failure: Trip / LR Number and Destination are mandatory.")
        elif check_lr_exists(lr_no):
            st.error("Integrity Error: Cannot dispatch trip. LR Number already exists.")
        else:
            try:
                # 1. Insert Trip
                new_t = run_query("""
                    INSERT INTO trips (
                        trip_number, branch_id, vehicle_id, primary_driver_id,
                        trip_start_date, trip_end_date, origin, destination,
                        start_km, end_km, total_km_run, diesel_filling_km,
                        tonnage_loaded, loaded_weight_mt,
                        freight_revenue, fuel_litres, fuel_expense,
                        driver_bata, toll_fastag_expense, cash_advance_issued,
                        trip_status
                    ) VALUES (%s, 1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'IN_TRANSIT')
                    RETURNING trip_id;
                """, (
                    lr_no.strip().upper(), active_veh['vehicle_id'], sel_driver_obj['driver_id'],
                    start_date, end_date, origin_terminal.strip().upper(), dest_terminal.strip().upper(),
                    start_km, end_km, total_km_run, filling_km,
                    weighbridge_mt, weighbridge_mt,
                    gross_freight, fuel_qty, gross_fuel_cost,
                    driver_bata, fastag_toll, cash_advance
                ))

                trip_id_created = new_t[0]['trip_id']

                # 2. Log Initial Fuel to Fuel Master
                if fuel_qty > 0:
                    run_query("""
                        INSERT INTO diesel_fuel_logs (
                            fuel_date, vehicle_id, trip_id, lr_number, diesel_category,
                            litres_filled, diesel_rate_per_litre, total_fuel_cost, filling_odometer_km, remarks
                        ) VALUES (%s, %s, %s, %s, 'TRIP_DIESEL', %s, %s, %s, %s, 'Initial Dispatch Fuel');
                    """, (start_date, active_veh['vehicle_id'], trip_id_created, lr_no.strip().upper(), fuel_qty, active_diesel_rate, gross_fuel_cost, filling_km), fetch=False)

                run_query("""
                    UPDATE vehicles 
                    SET current_status = 'IN_TRANSIT', 
                        status_remarks = %s, 
                        status_updated_at = CURRENT_TIMESTAMP 
                    WHERE vehicle_id = %s
                """, (f"Trip {lr_no.strip().upper()}: {origin_terminal} -> {dest_terminal}", active_veh['vehicle_id']), fetch=False)

                get_cached_vehicles.clear()
                st.session_state.form_reset_counter += 1
                st.success(f"Trip {lr_no.strip().upper()} dispatched. Ready for next entry.")
                st.rerun()
            except Exception as e:
                st.error(f"Database Execution Error: {e}")

# ==============================================================================
# 2. TRIP & SUNDRY DIESEL LOGS (ADD FUEL ANYTIME WITH DATE & LR NO)
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
                    # Match LR to trip if present
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

                    # Update trip fuel total if linked to an active trip
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
# 3. DIRECT DRIVER ADVANCES (NON-TRIP / GENERAL ADVANCES)
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
# 4. TRIP MODIFICATION & EXPENSES
# ==============================================================================
elif menu == "Trip Modification & Expenses":
    st.subheader("Trip Audit, Modification & Expense Claims")

    trips = run_query("""
        SELECT 
            t.trip_id, t.trip_number, v.vehicle_number, v.vehicle_id, v.carrying_capacity_tons, d.full_name, d.driver_id,
            t.origin, t.destination, t.trip_start_date, t.trip_end_date,
            t.start_km, t.end_km, t.total_km_run, t.diesel_filling_km,
            t.tonnage_loaded, t.freight_revenue, t.fuel_litres, t.fuel_expense,
            t.driver_bata, t.toll_fastag_expense, t.cash_advance_issued,
            t.enroute_repairs_maintenance, t.loading_unloading_expense, t.misc_trip_expense
        FROM trips t
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        JOIN drivers d ON t.primary_driver_id = d.driver_id
        ORDER BY t.trip_id DESC
        LIMIT 100;
    """)

    if not trips:
        st.info("No recorded trips available for modification.")
        st.stop()

    trip_map = {f"LR: {t['trip_number']} | Truck: {t['vehicle_number']} | {t['origin']} -> {t['destination']} | {t['full_name']}": t for t in trips}
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
        base_rate_per_ton = round(float(t['freight_revenue'] or 0.0) / max(0.01, float(t['tonnage_loaded'] or 1.0)), 2)

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
        m_ton = st.number_input("Weighbridge Tonnage (MT)", min_value=0.0, value=float(t['tonnage_loaded'] or 0.0), step=0.05, key="edit_ton")
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
        m_bata = st.number_input("Driver Bata Allowance (INR)", min_value=0.0, value=float(t['driver_bata'] or 0.0), step=100.0, key="edit_bata")
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
# 5. DRIVER PERIOD SETTLEMENT (INCLUDES TRIP + DIRECT ADVANCES)
# ==============================================================================
elif menu == "Driver Period Settlement":
    st.subheader("Driver Bi-Monthly Settlement Ledger (Trip Bata + Direct Advances)")

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
        target_year = st.selectbox("Fiscal Year", [date.today().year - 1, date.today().year, date.today().year + 1], index=1)
        target_month = st.selectbox("Month", list(range(1, 13)), index=date.today().month - 1)
    with col_filter3:
        settlement_period = st.radio("Cycle", ["1st to 15th (Period 1)", "16th to Month-End (Period 2)"])
        
    last_day = 31 if target_month in [1,3,5,7,8,10,12] else (30 if target_month != 2 else 28)
    if "1st to 15th" in settlement_period:
        start_period_date = date(target_year, target_month, 1)
        end_period_date = date(target_year, target_month, 15)
    else:
        start_period_date = date(target_year, target_month, 16)
        end_period_date = date(target_year, target_month, last_day)

    # 1. Fetch Trip Ledger for Period
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

    # 2. Fetch Direct Non-Trip Advances for Period
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
        total_bata = df_period['driver_bata'].sum()
        total_claims = df_period['out_of_pocket_claims'].sum()
        total_trip_advances = df_period['trip_advance_issued'].sum()
    else:
        st.info("No trips logged for this driver during the selected cycle.")
        total_bata = 0.00
        total_claims = 0.00
        total_trip_advances = 0.00

    st.markdown('<div class="section-header">2. Direct Advances / Loans Drawn</div>', unsafe_allow_html=True)
    if direct_advances:
        df_dir_adv = pd.DataFrame(direct_advances)
        st.dataframe(df_dir_adv, use_container_width=True)
        total_direct_advances = df_dir_adv['amount_inr'].sum()
    else:
        st.info("No direct cash advances issued during this cycle.")
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
            if period_trips:
                pd.DataFrame(period_trips).to_excel(writer, index=False, sheet_name='Trips')
            if direct_advances:
                pd.DataFrame(direct_advances).to_excel(writer, index=False, sheet_name='Direct Advances')
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
# 6. MASTER DATA MANAGEMENT (WITH DRIVER BATA MASTER)
# ==============================================================================
elif menu == "Master Data Management":
    st.subheader("Master Data Registries")
    tab_v, tab_d, tab_bata, tab_r = st.tabs([
        "Vehicle Registry", 
        "Driver Directory", 
        "Driver Bata Master (Destination & Truck)", 
        "Freight Slabs Master"
    ])

    with tab_v:
        v_list = get_cached_vehicles()
        if v_list:
            st.dataframe(pd.DataFrame(v_list), use_container_width=True)

        st.markdown('<div class="section-header">Register New Fleet Unit</div>', unsafe_allow_html=True)
        with st.form("new_veh_form"):
            vc1, vc2, vc3 = st.columns(3)
            with vc1:
                nv_num = st.text_input("Vehicle Number*", placeholder="e.g. KL43Q3608").upper()
            with vc2:
                nv_type = st.selectbox("Vehicle Variant / Configuration", [
                    "Bulker (16-Wheel)",
                    "Bulker (14-Wheel)",
                    "Bulker",
                    "Body Truck (14-Wheel)",
                    "Body Truck"
                ])
            with vc3:
                nv_cap = st.selectbox("Capacity Class (MT)", [25.0, 30.0, 35.0], index=2)

            if st.form_submit_button("Save Vehicle"):
                if not nv_num.strip():
                    st.error("Vehicle registration number is mandatory.")
                elif run_query("SELECT vehicle_id FROM vehicles WHERE LOWER(vehicle_number) = LOWER(%s)", (nv_num.strip(),)):
                    st.warning("Warning: A vehicle with this registration number already exists.")
                else:
                    run_query("""
                        INSERT INTO vehicles (vehicle_number, truck_type, carrying_capacity_tons, current_status)
                        VALUES (%s, %s, %s, 'AVAILABLE_FOR_LOAD')
                    """, (nv_num.strip(), nv_type, nv_cap), fetch=False)
                    get_cached_vehicles.clear()
                    st.success(f"Vehicle {nv_num} added to fleet registry.")
                    st.rerun()

    with tab_d:
        d_list = get_cached_drivers(include_inactive=True)
        if d_list:
            st.dataframe(pd.DataFrame(d_list), use_container_width=True)

        st.markdown('<div class="section-header">Modify Existing Driver Record</div>', unsafe_allow_html=True)
        d_dict = {f"{d['driver_code']} - {d['full_name']}": d for d in d_list}
        chosen_edit_d = st.selectbox("Select Driver to Modify", list(d_dict.keys()))
        t_d = d_dict[chosen_edit_d]

        with st.form("edit_driver_master_form"):
            de1, de2 = st.columns(2)
            with de1:
                ed_name = st.text_input("Full Name", value=t_d['full_name'])
                ed_phone = st.text_input("Phone Number", value=t_d['phone_number'])
            with de2:
                ed_lic = st.text_input("License Number", value=t_d['license_number'])
                ed_act = st.checkbox("Active Status", value=bool(t_d.get('is_active', True)))

            if st.form_submit_button("Update Driver"):
                run_query("""
                    UPDATE drivers 
                    SET full_name = %s, phone_number = %s, license_number = %s, is_active = %s
                    WHERE driver_id = %s
                """, (ed_name, ed_phone, ed_lic, ed_act, t_d['driver_id']), fetch=False)
                get_cached_drivers.clear()
                st.success("Driver master updated.")
                st.rerun()

    with tab_bata:
        st.markdown('<div class="section-header">Driver Bata Master by Destination & Vehicle</div>', unsafe_allow_html=True)
        bata_rules = get_cached_bata_rules()
        if bata_rules:
            st.dataframe(pd.DataFrame(bata_rules), use_container_width=True)

        st.markdown('<div class="section-header">Create / Update Destination Bata Rule</div>', unsafe_allow_html=True)
        vehicles = get_cached_vehicles()
        veh_bata_map = {f"{v['vehicle_number']} ({v['truck_type']} - {v['carrying_capacity_tons']} MT)": v for v in vehicles}

        with st.form("bata_rule_form", clear_on_submit=True):
            bc1, bc2, bc3 = st.columns(3)
            with bc1:
                b_dest = st.text_input("Destination Terminal*", placeholder="e.g. SANKARI / ALUVA").strip().upper()
                b_cargo = st.selectbox("Cargo Category", ["BULK", "BAG"])
            with bc2:
                b_veh = st.selectbox("Target Vehicle*", list(veh_bata_map.keys()))
                target_b_veh = veh_bata_map[b_veh]
            with bc3:
                b_amount = st.number_input("Standard Driver Bata (INR)*", min_value=0.0, step=100.0, value=3000.0)

            if st.form_submit_button("Save Driver Bata Rule", type="primary"):
                if not b_dest:
                    st.error("Destination terminal is required.")
                else:
                    run_query("""
                        INSERT INTO driver_bata_master (destination_name, cargo_type, vehicle_id, capacity_tons, standard_bata_inr)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (destination_name, cargo_type, vehicle_id)
                        DO UPDATE SET standard_bata_inr = EXCLUDED.standard_bata_inr;
                    """, (b_dest, b_cargo, target_b_veh['vehicle_id'], target_b_veh['carrying_capacity_tons'], b_amount), fetch=False)
                    get_cached_bata_rules.clear()
                    st.success(f"Driver Bata saved: INR {b_amount:,.2f} for {target_b_veh['vehicle_number']} to {b_dest}.")
                    st.rerun()

    with tab_r:
        r_list = get_cached_routes()
        if r_list:
            st.dataframe(pd.DataFrame(r_list), use_container_width=True)

# ==============================================================================
# 7. VARIANCE & PERFORMANCE REPORTS
# ==============================================================================
elif menu == "Variance & Performance Reports":
    st.subheader("Operational & Variant Peer Comparison Analytics")

    vehicles = get_cached_vehicles()
    variants = sorted(list(set(v['truck_type'] for v in vehicles)))
    capacities = sorted(list(set(float(v['carrying_capacity_tons']) for v in vehicles)))

    rc1, rc2 = st.columns(2)
    with rc1:
        sel_variant = st.selectbox("Select Vehicle Variant for Peer Analysis", ["All Variants"] + variants)
    with rc2:
        sel_capacity = st.selectbox("Filter by Capacity Class (MT)", ["All Capacity Classes"] + capacities)

    query = """
        SELECT 
            v.vehicle_number,
            v.truck_type,
            v.carrying_capacity_tons,
            COUNT(t.trip_id) AS total_trips,
            COALESCE(SUM(t.total_km_run), 0.00) AS total_km_run,
            COALESCE(SUM(t.tonnage_loaded), 0.00) AS total_tonnage_carried,
            COALESCE(SUM(t.freight_revenue), 0.00) AS gross_revenue_inr,
            COALESCE(SUM(t.fuel_expense), 0.00) AS total_fuel_expense,
            COALESCE(SUM(t.driver_bata), 0.00) AS total_driver_bata,
            COALESCE(SUM(t.toll_fastag_expense), 0.00) AS total_toll_expense,
            COALESCE(SUM(t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense), 0.00) AS other_operating_expenses,
            COALESCE(SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense)), 0.00) AS net_retained_profit_inr,
            ROUND(
                (COALESCE(SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense)), 0.00) / 
                NULLIF(SUM(t.freight_revenue), 0.00)) * 100.0, 2
            ) AS profit_margin_pct,
            ROUND(SUM(t.total_km_run) / NULLIF(SUM(t.fuel_litres), 0.00), 2) AS average_mileage_kmpl,
            ROUND(
                SUM(t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense) / 
                NULLIF(SUM(t.total_km_run), 0.00), 2
            ) AS cost_per_km_inr
        FROM vehicles v
        LEFT JOIN trips t ON v.vehicle_id = t.vehicle_id
        WHERE v.is_active = TRUE
    """
    params = []
    if sel_variant != "All Variants":
        query += " AND v.truck_type = %s"
        params.append(sel_variant)
    if sel_capacity != "All Capacity Classes":
        query += " AND v.carrying_capacity_tons = %s"
        params.append(float(sel_capacity))

    query += " GROUP BY v.vehicle_number, v.truck_type, v.carrying_capacity_tons ORDER BY net_retained_profit_inr DESC;"

    report_data = run_query(query, tuple(params))
    if not report_data:
        st.info("No comparative metrics available for the selected vehicle parameters.")
    else:
        df_rep = pd.DataFrame(report_data)
        st.dataframe(
            df_rep,
            column_config={
                "vehicle_number": "Vehicle Number",
                "truck_type": "Variant",
                "carrying_capacity_tons": "Capacity Class (MT)",
                "total_trips": "Trips",
                "total_km_run": "Total KM",
                "total_tonnage_carried": "Loaded MT",
                "gross_revenue_inr": "Gross Revenue (INR)",
                "total_fuel_expense": "Fuel Cost (INR)",
                "total_driver_bata": "Bata (INR)",
                "total_toll_expense": "Toll (INR)",
                "other_operating_expenses": "Repairs & Handling (INR)",
                "net_retained_profit_inr": "Net Retained Profit (INR)",
                "profit_margin_pct": "Margin %",
                "average_mileage_kmpl": "Mileage (KMPL)",
                "cost_per_km_inr": "Cost / KM (INR)"
            },
            hide_index=True,
            use_container_width=True
        )

        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine='openpyxl') as writer:
            df_rep.to_excel(writer, index=False, sheet_name='Peer Variance Report')

        st.download_button(
            "Download Variance Analytics Sheet (Excel)",
            data=buf.getvalue(),
            file_name=f"peer_performance_report_{sel_variant}_{date.today()}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

# ==============================================================================
# 8. TRIP RECORDS REGISTRY
# ==============================================================================
elif menu == "Trip Records Registry":
    st.subheader("Master Trip Audit Log")
    trips_data = run_query("""
        SELECT 
            t.trip_id, t.trip_number, t.trip_start_date, t.trip_end_date,
            v.vehicle_number, v.truck_type, d.full_name AS assigned_driver,
            t.origin, t.destination, t.start_km, t.end_km, t.total_km_run, t.diesel_filling_km,
            t.tonnage_loaded, t.freight_revenue, t.fuel_litres, t.fuel_expense,
            t.driver_bata, t.toll_fastag_expense, t.cash_advance_issued,
            (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense) AS total_trip_expense,
            (t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense)) AS net_margin
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
