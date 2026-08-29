import streamlit as st
import pandas as pd
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from datetime import date
import calendar

# --- Streamlit UI Config ---
st.set_page_config(page_title="Fleet Operations System", layout="wide")
st.title("🚛 Fleet Operations & Trip Dispatch System")

# --- 1. Threaded Connection Pool with In-Memory Caching ---
@st.cache_resource
def init_connection_pool():
    creds = {
        "host": "aws-0-ap-south-1.pooler.supabase.com",
        "port": 6543,
        "dbname": "postgres",
        "user": "postgres.eobweyciqwoojwnsonor",
        "password": "Poovin@2809"
    }
    # Check Streamlit Cloud Secrets safely
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

# --- 2. Fast In-Memory Cached Masters (TTL 60s) ---
@st.cache_data(ttl=60)
def get_cached_vehicles():
    return run_query("SELECT vehicle_id, vehicle_number, truck_type, carrying_capacity_tons, current_status, status_remarks, status_updated_at FROM vehicles WHERE is_active = TRUE ORDER BY vehicle_number")

@st.cache_data(ttl=60)
def get_cached_drivers(include_inactive=False):
    if include_inactive:
        return run_query("SELECT driver_id, driver_code, full_name, phone_number, license_number, license_expiry_date, is_active FROM drivers ORDER BY driver_code")
    return run_query("SELECT driver_id, driver_code, full_name, phone_number, license_number, license_expiry_date FROM drivers WHERE is_active = TRUE ORDER BY driver_code")

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

def clear_all_caches():
    get_cached_vehicles.clear()
    get_cached_drivers.clear()
    get_cached_routes.clear()
    get_cached_diesel_rate.clear()

# --- Sidebar Navigation ---
menu = st.sidebar.radio("Navigation", [
    "🚦 Live Fleet Status & Yard Board",
    "📝 New Trip Entry",
    "💸 Trip Expenses & Claims",
    "💰 Driver Period Settlement (1-15 / 16-End)",
    "👨‍✈️ Driver Directory & Rates Master",
    "📊 Profitability Reports",
    "🔍 View & Delete Trips"
])

STATUS_MAP = {
    "AVAILABLE_FOR_LOAD": "🟢 Available / Ready for Load",
    "WAITING_FOR_LOAD": "🟡 Waiting for Load (At Plant/Hub)",
    "IN_TRANSIT": "🚚 In Transit (On Highway)",
    "WAITING_FOR_UNLOAD": "⏳ Waiting for Unloading (At Site/Customer)",
    "WORKSHOP_MAINTENANCE": "🛠️ In Workshop / Under Repair",
    "DRIVER_UNAVAILABLE": "🚫 Truck Without Driver / Driver on Leave"
}

# ==============================================================================
# 0. LIVE FLEET STATUS & YARD BOARD
# ==============================================================================
if menu == "🚦 Live Fleet Status & Yard Board":
    st.subheader("Live Vehicle Operational Status & Yard Monitoring")
    
    vehicles_data = get_cached_vehicles()
    if not vehicles_data:
        st.warning("No vehicles registered in database.")
        st.stop()

    df_v = pd.DataFrame(vehicles_data)
    df_v['display_status'] = df_v['current_status'].map(lambda x: STATUS_MAP.get(x, x))
    
    k1, k2, k3, k4, k5, k6 = st.columns(6)
    k1.metric("🟢 Ready / Available", len(df_v[df_v['current_status'] == 'AVAILABLE_FOR_LOAD']))
    k2.metric("🟡 Waiting for Load", len(df_v[df_v['current_status'] == 'WAITING_FOR_LOAD']))
    k3.metric("🚚 In Transit", len(df_v[df_v['current_status'] == 'IN_TRANSIT']))
    k4.metric("⏳ Waiting Unload", len(df_v[df_v['current_status'] == 'WAITING_FOR_UNLOAD']))
    k5.metric("🛠️ In Workshop", len(df_v[df_v['current_status'] == 'WORKSHOP_MAINTENANCE']))
    k6.metric("🚫 No Driver / Leave", len(df_v[df_v['current_status'] == 'DRIVER_UNAVAILABLE']))
    
    st.divider()

    col_board, col_update = st.columns([1.6, 1.0])

    with col_board:
        st.write("### 📋 Active Fleet Status Overview")
        filter_status = st.selectbox("Filter by Status", ["All Statuses"] + list(STATUS_MAP.values()))
        
        display_df = df_v.copy()
        if filter_status != "All Statuses":
            display_df = display_df[display_df['display_status'] == filter_status]

        st.dataframe(
            display_df[['vehicle_number', 'truck_type', 'carrying_capacity_tons', 'display_status', 'status_remarks']],
            column_config={
                "vehicle_number": "Truck No",
                "truck_type": "Body / Bulker",
                "carrying_capacity_tons": "Class (MT)",
                "display_status": "Current Status",
                "status_remarks": "Remarks / Location"
            },
            hide_index=True,
            use_container_width=True
        )

    with col_update:
        st.write("### ⚡ Quick Update Vehicle Status")
        v_dict = {f"{v['vehicle_number']} ({v['truck_type']}) - [{STATUS_MAP.get(v['current_status'], v['current_status'])}]": v for v in vehicles_data}
        selected_v_key = st.selectbox("Select Vehicle to Update", list(v_dict.keys()))
        target_v = v_dict[selected_v_key]

        with st.form("update_truck_status_form"):
            status_options_keys = list(STATUS_MAP.keys())
            current_idx = status_options_keys.index(target_v['current_status']) if target_v['current_status'] in status_options_keys else 0
            
            new_status_key = st.selectbox(
                "New Operational Status*",
                status_options_keys,
                index=current_idx,
                format_func=lambda x: STATUS_MAP[x]
            )
            new_remarks = st.text_input("Remarks / Current Location / Breakdown Details", value=target_v['status_remarks'] or "")

            if st.form_submit_button("🔄 Update Vehicle Status", type="primary", use_container_width=True):
                run_query("""
                    UPDATE vehicles 
                    SET current_status = %s, status_remarks = %s, status_updated_at = CURRENT_TIMESTAMP 
                    WHERE vehicle_id = %s
                """, (new_status_key, new_remarks, target_v['vehicle_id']), fetch=False)
                get_cached_vehicles.clear()
                st.success(f"Status for {target_v['vehicle_number']} updated!")
                st.rerun()

# ==============================================================================
# 1. NEW TRIP ENTRY
# ==============================================================================
elif menu == "📝 New Trip Entry":
    st.subheader("Log New Trip (Live Instant Freight & Fuel Calculation)")

    vehicles = get_cached_vehicles()
    drivers = get_cached_drivers()

    if not drivers or not vehicles:
        st.error("⚠️ Ensure drivers and vehicles exist in database.")
        st.stop()

    col_quick1, col_quick2 = st.columns(2)

    with col_quick1:
        with st.expander("➕ Quick Add New Driver", expanded=False):
            auto_code = f"DRV-{len(drivers)+1:03d}"
            st.write(f"**Assigned Driver Code:** `{auto_code}`")
            with st.form("inline_driver_form", clear_on_submit=True):
                qd_name = st.text_input("Driver Full Name*")
                qd_phone = st.text_input("Phone Number*", placeholder="98XXXXXXXX")
                qd_col1, qd_col2 = st.columns(2)
                with qd_col1:
                    qd_license = st.text_input("License No*", placeholder="KL-07-XXXXXX")
                with qd_col2:
                    qd_expiry = st.date_input("License Expiry", date(2030, 1, 1))
                
                if st.form_submit_button("➕ Save Driver"):
                    if not qd_name or not qd_phone or not qd_license:
                        st.error("Please fill Name, Phone, and License.")
                    else:
                        run_query("""
                            INSERT INTO drivers (driver_code, full_name, phone_number, license_number, license_expiry_date, branch_id)
                            VALUES (%s, %s, %s, %s, %s, 1)
                        """, (auto_code, qd_name, qd_phone, qd_license, qd_expiry), fetch=False)
                        get_cached_drivers.clear()
                        st.success(f"Driver '{qd_name}' added!")
                        st.rerun()

    with col_quick2:
        with st.expander("➕ Quick Add Destination & Rate Slab", expanded=False):
            with st.form("inline_route_form", clear_on_submit=True):
                qr_c1, qr_c2 = st.columns(2)
                with qr_c1:
                    qr_cargo = st.selectbox("Cargo Category*", ["BULK", "BAG"])
                    qr_origin = st.text_input("Origin Hub*", "COCHIN")
                    qr_dest = st.text_input("Destination Name*", placeholder="e.g. Sankari / Aluva")
                with qr_c2:
                    qr_cap = st.selectbox("Truck Slab Category*", [25.0, 30.0, 35.0], index=2)
                    qr_km = st.number_input("Standard Route KM", min_value=0.0, step=10.0, value=0.0)
                    qr_rate = st.number_input("Freight Rate per Ton (₹)*", min_value=0.0, step=25.0, value=0.0)
                
                if st.form_submit_button("➕ Save Destination Rate"):
                    if not qr_dest:
                        st.error("Destination name is required.")
                    else:
                        run_query("""
                            INSERT INTO destinations_freight_master (cargo_type, origin, destination_name, capacity_tons, freight_rate_per_ton, standard_km)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            ON CONFLICT (cargo_type, origin, destination_name, capacity_tons) 
                            DO UPDATE SET freight_rate_per_ton = EXCLUDED.freight_rate_per_ton, standard_km = EXCLUDED.standard_km;
                        """, (qr_cargo, qr_origin, qr_dest, qr_cap, qr_rate, qr_km), fetch=False)
                        get_cached_routes.clear()
                        st.success(f"Saved: {qr_dest} ({qr_cargo} - {qr_cap}T Slab) at ₹{qr_rate}/Ton!")
                        st.rerun()

    st.markdown("---")

    vehicle_dict = {f"{v['vehicle_number']} | {v['truck_type']} | {v['carrying_capacity_tons']} MT [{STATUS_MAP.get(v['current_status'], v['current_status'])}]": v for v in vehicles}
    driver_map = {f"{d['driver_code']} - {d['full_name']}": d['driver_id'] for d in drivers}
    current_saved_diesel_rate = get_cached_diesel_rate()

    top_c1, top_c2, top_c3 = st.columns(3)
    with top_c1:
        chosen_truck_str = st.selectbox("Select Truck Number*", list(vehicle_dict.keys()), key="truck_sel")
        selected_vehicle = vehicle_dict[chosen_truck_str]
        truck_class_tons = float(selected_vehicle['carrying_capacity_tons'])
    with top_c2:
        cargo_type_selected = st.radio("Cargo Category*", ["BULK", "BAG"], horizontal=True, key="cargo_sel")
    with top_c3:
        active_diesel_rate = st.number_input("Current Diesel Rate (₹/Litre)*", min_value=50.0, max_value=150.0, value=current_saved_diesel_rate, step=0.05, key="fuel_rate_input")
        if active_diesel_rate != current_saved_diesel_rate:
            set_saved_diesel_rate(active_diesel_rate)
            st.toast(f"✅ Diesel rate updated to ₹{active_diesel_rate:.2f}/L")

    routes_list = get_cached_routes(cargo_type=cargo_type_selected, capacity=truck_class_tons)
    
    route_options = {}
    if routes_list:
        for r in routes_list:
            label = f"{r['origin']} ➔ {r['destination_name']} [{truck_class_tons}T Truck Slab: ₹{r['freight_rate_per_ton']}/Ton | {r['standard_km']} KM]"
            route_options[label] = r
            
    route_options["-- Manual Route / Custom Entry --"] = {
        "origin": "COCHIN",
        "destination_name": "",
        "standard_km": 0.0,
        "freight_rate_per_ton": 0.0
    }

    selected_route_key = st.selectbox("Select Destination Route Slab*", list(route_options.keys()), key="route_sel")
    active_route = route_options[selected_route_key]
    is_custom = (selected_route_key == "-- Manual Route / Custom Entry --")

    f_col1, f_col2, f_col3 = st.columns(3)
    
    with f_col1:
        st.markdown("#### 1️⃣ Trip & Driver")
        trip_no = st.text_input("Trip / LR Number*", placeholder="TRIP-2026-001", key="trip_no_input")
        chosen_driver_key = st.selectbox("Select Assigned Driver*", list(driver_map.keys()), key="driver_sel")
        
        if is_custom:
            trip_origin = st.text_input("Origin Hub*", value=active_route['origin'], key="origin_input")
            trip_destination = st.text_input("Destination*", value=active_route['destination_name'], placeholder="e.g. Sankari", key="dest_input")
            km_run = st.number_input("Total KM Run*", min_value=0.0, step=10.0, value=float(active_route['standard_km']), key="km_run")
            applied_rate_per_ton = st.number_input("Custom Freight Rate per Ton (₹)*", min_value=0.0, step=25.0, value=float(active_route['freight_rate_per_ton']))
        else:
            trip_origin = active_route['origin']
            trip_destination = active_route['destination_name']
            km_run = float(active_route['standard_km'])
            applied_rate_per_ton = float(active_route['freight_rate_per_ton'])
            st.info(f"📍 **Route:** `{trip_origin}` ➔ `{trip_destination}`\n\n🛣️ **Distance:** `{km_run} KM` | 🏷️ **Rate:** `₹{applied_rate_per_ton}/Ton`")

    with f_col2:
        st.markdown("#### 2️⃣ Load & Freight")
        start_d = st.date_input("Trip Start Date", date.today(), key="start_d")
        end_d = st.date_input("Trip End Date", date.today(), key="end_d")
        
        actual_loaded_tonnage = st.number_input(
            "Weighbridge Loaded Weight (MT)*", 
            min_value=0.0, 
            max_value=50.0, 
            step=0.05, 
            value=truck_class_tons,
            key="loaded_tonnage"
        )
        
        calculated_freight = round(actual_loaded_tonnage * applied_rate_per_ton, 2)
        st.metric(
            label=f"Total Freight Revenue (₹) [{actual_loaded_tonnage} MT × ₹{applied_rate_per_ton}/T]",
            value=f"₹{calculated_freight:,.2f}"
        )

    with f_col3:
        st.markdown("#### 3️⃣ Fuel & Expenses")
        fuel_qty = st.number_input("Diesel Litres Filled*", min_value=0.0, step=10.0, value=0.0, key="fuel_qty_input")
        calculated_fuel_expense = round(fuel_qty * active_diesel_rate, 2)
        st.metric(
            label=f"Auto Diesel Expense (₹) [{fuel_qty}L × ₹{active_diesel_rate}/L]",
            value=f"₹{calculated_fuel_expense:,.2f}"
        )
        
        driver_bata_val = st.number_input("Driver Bata (₹)*", min_value=0.0, step=100.0, value=3000.0, key="bata_input")
        toll_val = st.number_input("FASTag / Toll Expense (₹)", min_value=0.0, step=100.0, key="toll_input")
        advance_val = st.number_input("Cash Advance Issued (₹)", min_value=0.0, step=500.0, key="advance_input")

    st.write("")
    if st.button("🚀 Save & Dispatch Trip", type="primary", use_container_width=True):
        if not trip_no or not trip_destination:
            st.error("Please enter a valid Trip Number and Destination.")
        else:
            try:
                run_query("""
                    INSERT INTO trips (
                        trip_number, branch_id, vehicle_id, primary_driver_id,
                        trip_start_date, trip_end_date, origin, destination,
                        total_km_run, tonnage_loaded, loaded_weight_mt,
                        freight_revenue, fuel_litres, fuel_expense,
                        driver_bata, toll_fastag_expense, cash_advance_issued,
                        trip_status
                    ) VALUES (%s, 1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'IN_TRANSIT');
                """, (
                    trip_no, selected_vehicle['vehicle_id'], driver_map[chosen_driver_key],
                    start_d, end_d, trip_origin, trip_destination,
                    km_run, actual_loaded_tonnage, actual_loaded_tonnage,
                    calculated_freight, fuel_qty, calculated_fuel_expense,
                    driver_bata_val, toll_val, advance_val
                ), fetch=False)
                
                run_query("""
                    UPDATE vehicles 
                    SET current_status = 'IN_TRANSIT', status_remarks = %s, status_updated_at = CURRENT_TIMESTAMP 
                    WHERE vehicle_id = %s
                """, (f"Trip {trip_no}: {trip_origin} ➔ {trip_destination}", selected_vehicle['vehicle_id']), fetch=False)
                
                get_cached_vehicles.clear()
                st.success(f"Trip {trip_no} dispatched! Route: {trip_origin} ➔ {trip_destination} | Freight: ₹{calculated_freight:,.2f}")
            except Exception as e:
                st.error(f"Error saving trip: {e}")

# ==============================================================================
# 2. TRIP EXPENSES & CLAIMS
# ==============================================================================
elif menu == "💸 Trip Expenses & Claims":
    st.subheader("Trip Expenses, Workshop Repairs & Driver Claims Management")

    trips_list = run_query("""
        SELECT 
            t.trip_id, t.trip_number, v.vehicle_number, d.full_name,
            t.origin, t.destination, t.fuel_expense, t.driver_bata, t.toll_fastag_expense,
            t.enroute_repairs_maintenance, t.loading_unloading_expense, t.misc_trip_expense,
            t.cash_advance_issued, t.freight_revenue
        FROM trips t
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        JOIN drivers d ON t.primary_driver_id = d.driver_id
        ORDER BY t.trip_id DESC
        LIMIT 50;
    """)

    if not trips_list:
        st.info("No trips found. Create a trip first in 'New Trip Entry'.")
    else:
        trip_options = {
            f"Trip {t['trip_number']} | Truck: {t['vehicle_number']} | Driver: {t['full_name']} | Route: {t['origin']} ➔ {t['destination']}": t 
            for t in trips_list
        }
        chosen_trip_str = st.selectbox("Select Trip to Add/Update Expenses", list(trip_options.keys()))
        t = trip_options[chosen_trip_str]

        st.write("#### 📊 Current Trip Financial Snapshot")
        sc1, sc2, sc3, sc4 = st.columns(4)
        sc1.metric("Gross Freight Revenue", f"₹{float(t['freight_revenue']):,.2f}")
        sc2.metric("Fuel Expense", f"₹{float(t['fuel_expense']):,.2f}")
        sc3.metric("Driver Bata", f"₹{float(t['driver_bata']):,.2f}")
        sc4.metric("Toll / FASTag", f"₹{float(t['toll_fastag_expense']):,.2f}")

        st.divider()

        with st.form("trip_expense_update_form"):
            st.write("### ✍️ Enter Additional Trip Expenses & Claims")
            ec1, ec2, ec3 = st.columns(3)
            with ec1:
                e_repair = st.number_input("En-route Repairs / Workshop (₹)", min_value=0.0, value=float(t['enroute_repairs_maintenance'] or 0.0), step=100.0)
            with ec2:
                e_loading = st.number_input("Loading / Unloading (₹)", min_value=0.0, value=float(t['loading_unloading_expense'] or 0.0), step=50.0)
            with ec3:
                e_misc = st.number_input("Misc Trip Claims / Entry Fees (₹)", min_value=0.0, value=float(t['misc_trip_expense'] or 0.0), step=50.0)

            st.write("### 💵 Advance & FASTag Adjustments")
            ac1, ac2 = st.columns(2)
            with ac1:
                e_toll = st.number_input("FASTag / Toll (₹)", min_value=0.0, value=float(t['toll_fastag_expense'] or 0.0), step=100.0)
            with ac2:
                e_advance = st.number_input("Total Cash Advance (₹)", min_value=0.0, value=float(t['cash_advance_issued'] or 0.0), step=500.0)

            if st.form_submit_button("💾 Save Expenses to Trip", type="primary", use_container_width=True):
                run_query("""
                    UPDATE trips
                    SET enroute_repairs_maintenance = %s,
                        loading_unloading_expense = %s,
                        misc_trip_expense = %s,
                        toll_fastag_expense = %s,
                        cash_advance_issued = %s
                    WHERE trip_id = %s;
                """, (e_repair, e_loading, e_misc, e_toll, e_advance, t['trip_id']), fetch=False)
                st.success(f"Expenses updated for Trip {t['trip_number']}!")
                st.rerun()

# ==============================================================================
# 3. DRIVER PERIOD SETTLEMENT (1-15 / 16-END)
# ==============================================================================
elif menu == "💰 Driver Period Settlement (1-15 / 16-End)":
    st.subheader("Driver Bi-Monthly Settlement Sheet")
    drivers = get_cached_drivers()
    if not drivers:
        st.warning("No drivers available.")
        st.stop()

    driver_map = {f"{d['driver_code']} - {d['full_name']}": d['driver_id'] for d in drivers}
    
    col_filter1, col_filter2, col_filter3 = st.columns(3)
    with col_filter1:
        chosen_driver = st.selectbox("Select Driver", list(driver_map.keys()))
        selected_driver_id = driver_map[chosen_driver]
    
    with col_filter2:
        target_year = st.selectbox("Select Year", [date.today().year - 1, date.today().year, date.today().year + 1], index=1)
        target_month = st.selectbox("Select Month", list(range(1, 13)), index=date.today().month - 1, format_func=lambda x: calendar.month_name[x])
    
    with col_filter3:
        settlement_period = st.radio("Settlement Cycle", ["1st to 15th (Cycle 1)", "16th to Month-End (Cycle 2)"])
        
    last_day_of_month = calendar.monthrange(target_year, target_month)[1]
    if "1st to 15th" in settlement_period:
        start_period_date = date(target_year, target_month, 1)
        end_period_date = date(target_year, target_month, 15)
    else:
        start_period_date = date(target_year, target_month, 16)
        end_period_date = date(target_year, target_month, last_day_of_month)

    st.info(f"Showing Trips from **{start_period_date.strftime('%d-%b-%Y')}** to **{end_period_date.strftime('%d-%b-%Y')}**")

    period_trips = run_query("""
        SELECT 
            t.trip_id, t.trip_number, t.trip_end_date, v.vehicle_number,
            t.origin, t.destination, t.total_km_run, t.tonnage_loaded,
            t.driver_bata,
            t.cash_advance_issued,
            (t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense) AS out_of_pocket_claims,
            t.trip_status, t.settlement_status
        FROM trips t
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        WHERE t.primary_driver_id = %s
          AND t.trip_end_date >= %s 
          AND t.trip_end_date <= %s
        ORDER BY t.trip_end_date ASC
    """, (selected_driver_id, start_period_date, end_period_date))

    if not period_trips:
        st.warning("No trips found for this driver in the selected period.")
    else:
        df_period = pd.DataFrame(period_trips)
        st.dataframe(df_period, use_container_width=True)

        total_bata = df_period['driver_bata'].sum()
        total_claims = df_period['out_of_pocket_claims'].sum()
        total_advances = df_period['cash_advance_issued'].sum()
        net_payable = (total_bata + total_claims) - total_advances

        st.divider()
        st.write("### 💵 Settlement Calculation Summary")
        m_col1, m_col2, m_col3 = st.columns(3)
        m_col1.metric("Total Driver Bata Earned", f"₹{total_bata:,.2f}")
        m_col2.metric("Total Advances Issued", f"₹{total_advances:,.2f}", delta=f"-₹{total_advances:,.2f}", delta_color="inverse")
        m_col3.metric("Total Out-of-Pocket Claims Claimed", f"₹{total_claims:,.2f}")

        st.markdown(f"""
        <div style="background-color:#0e1117; padding:15px; border-radius:10px; border: 1px solid #30363d; margin-top:10px;">
            <h3 style="margin:0; color:{'#00c853' if net_payable >= 0 else '#ff5252'};">
                Net Settlement Position: {'Branch to Pay Driver ₹' if net_payable >= 0 else 'Recover from Driver ₹'}{abs(net_payable):,.2f}
            </h3>
        </div>
        """, unsafe_allow_html=True)

        st.write("")
        col_act1, col_act2 = st.columns(2)
        with col_act1:
            csv_settle = df_period.to_csv(index=False).encode('utf-8')
            st.download_button(
                f"📥 Download {chosen_driver.split('-')[0].strip()} Settlement Slip",
                csv_settle,
                f"settlement_{chosen_driver.split('-')[0].strip()}_{start_period_date}_{end_period_date}.csv",
                "text/csv"
            )
        with col_act2:
            if st.button("Mark All Trips in this Period as SETTLED", type="primary"):
                run_query("""
                    UPDATE trips 
                    SET settlement_status = 'SETTLED', settled_at = CURRENT_TIMESTAMP 
                    WHERE primary_driver_id = %s 
                      AND trip_end_date >= %s 
                      AND trip_end_date <= %s
                """, (selected_driver_id, start_period_date, end_period_date), fetch=False)
                st.success("All period trips marked as SETTLED!")
                st.rerun()

# ==============================================================================
# 4. DRIVER DIRECTORY & RATES MASTER
# ==============================================================================
elif menu == "👨‍✈️ Driver Directory & Rates Master":
    st.subheader("Manage Drivers, Routes, and Capacity Rate Cards")

    tab_drv, tab_rt = st.tabs(["👨‍✈️ Drivers Directory", "📍 Destinations & Capacity Rate Slabs"])

    with tab_drv:
        drivers_list = get_cached_drivers(include_inactive=True)
        if drivers_list:
            df_d = pd.DataFrame(drivers_list)
            st.dataframe(df_d[['driver_id', 'driver_code', 'full_name', 'phone_number', 'license_number', 'license_expiry_date', 'is_active']], use_container_width=True)
            
            st.divider()
            col_de1, col_de2 = st.columns(2)
            
            with col_de1:
                st.write("### ✏️ Edit Driver Details")
                drv_map = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers_list}
                chosen_d = st.selectbox("Select Driver to Edit", list(drv_map.keys()), key="edit_drv_select")
                d_val = drv_map[chosen_d]
                
                with st.form("edit_drv_form"):
                    e_name = st.text_input("Full Name", value=d_val['full_name'])
                    e_phone = st.text_input("Phone Number", value=d_val['phone_number'])
                    e_lic = st.text_input("License Number", value=d_val['license_number'])
                    e_exp = st.date_input("License Expiry Date", value=d_val['license_expiry_date'] or date(2030, 1, 1))
                    e_active = st.checkbox("Is Driver Active?", value=bool(d_val.get('is_active', True)))
                    
                    if st.form_submit_button("💾 Save Driver Changes", type="primary"):
                        run_query("""
                            UPDATE drivers 
                            SET full_name = %s, phone_number = %s, license_number = %s, license_expiry_date = %s, is_active = %s
                            WHERE driver_id = %s
                        """, (e_name, e_phone, e_lic, e_exp, e_active, d_val['driver_id']), fetch=False)
                        get_cached_drivers.clear()
                        st.success(f"Driver '{e_name}' updated!")
                        st.rerun()

            with col_de2:
                st.write("### 🗑️ Remove / Deactivate Driver")
                del_drv = st.selectbox("Select Driver to Remove", list(drv_map.keys()), key="del_drv_sel")
                target_del = drv_map[del_drv]
                
                if st.button("🗑️ Delete / Archive Driver", type="primary"):
                    try:
                        run_query("DELETE FROM drivers WHERE driver_id = %s", (target_del['driver_id'],), fetch=False)
                        st.success(f"Driver {target_del['full_name']} deleted.")
                    except Exception:
                        run_query("UPDATE drivers SET is_active = FALSE WHERE driver_id = %s", (target_del['driver_id'],), fetch=False)
                        st.warning(f"Driver {target_del['full_name']} archived as INACTIVE (historical trips preserved).")
                    get_cached_drivers.clear()
                    st.rerun()

    with tab_rt:
        all_routes = get_cached_routes()
        if all_routes:
            df_r = pd.DataFrame(all_routes)
            st.dataframe(df_r[['destination_id', 'cargo_type', 'origin', 'destination_name', 'capacity_tons', 'freight_rate_per_ton', 'standard_km']], use_container_width=True)
            
            st.divider()
            col_re1, col_re2 = st.columns(2)
            
            with col_re1:
                st.write("### ✏️ Edit Route Slab & Freight Rate")
                rt_dict = {f"ID {r['destination_id']}: [{r['cargo_type']}] {r['origin']} ➔ {r['destination_name']} ({r['capacity_tons']}T Slab @ ₹{r['freight_rate_per_ton']})": r for r in all_routes}
                chosen_rt = st.selectbox("Select Route Slab to Edit", list(rt_dict.keys()), key="edit_rt_sel")
                r_val = rt_dict[chosen_rt]
                
                with st.form("edit_rate_form"):
                    er_rate = st.number_input("Freight Rate per Ton (₹)*", min_value=0.0, value=float(r_val['freight_rate_per_ton']), step=25.0)
                    er_km = st.number_input("Standard Route KM", min_value=0.0, value=float(r_val['standard_km'] or 0.0), step=10.0)
                    
                    if st.form_submit_button("💾 Update Rate & KM", type="primary"):
                        run_query("""
                            UPDATE destinations_freight_master 
                            SET freight_rate_per_ton = %s, standard_km = %s 
                            WHERE destination_id = %s
                        """, (er_rate, er_km, r_val['destination_id']), fetch=False)
                        get_cached_routes.clear()
                        st.success(f"Route slab updated!")
                        st.rerun()

            with col_re2:
                st.write("### 🗑️ Delete Route Slab")
                del_rt_sel = st.selectbox("Select Route Slab to Remove", list(rt_dict.keys()), key="del_rt_sel")
                target_del_rt = rt_dict[del_rt_sel]
                
                if st.button("🗑️ Delete Route Slab", type="primary"):
                    run_query("DELETE FROM destinations_freight_master WHERE destination_id = %s", (target_del_rt['destination_id'],), fetch=False)
                    get_cached_routes.clear()
                    st.success(f"Route slab removed.")
                    st.rerun()
        else:
            st.info("No routes found.")

# ==============================================================================
# 5. PROFITABILITY REPORTS
# ==============================================================================
elif menu == "📊 Profitability Reports":
    st.subheader("Monthly Retention & Profitability Reports")
    report_type = st.selectbox("Select Report View", [
        "1. Vehicle-Wise Profitability & Mileage Ranking",
        "2. Month-on-Month Branch Profitability Summary",
        "3. Driver Outstanding & Bata Summary"
    ])

    if report_type == "1. Vehicle-Wise Profitability & Mileage Ranking":
        data = run_query("""
            SELECT 
                v.vehicle_number, v.truck_type,
                COUNT(t.trip_id) AS trips,
                SUM(t.total_km_run) AS total_km,
                SUM(t.tonnage_loaded) AS total_tonnage,
                SUM(t.freight_revenue) AS gross_revenue,
                SUM(t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense) AS direct_costs,
                SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense)) AS retained_margin,
                ROUND((SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense)) / NULLIF(SUM(t.freight_revenue), 0)) * 100.0, 2) AS margin_pct,
                ROUND(SUM(t.total_km_run) / NULLIF(SUM(t.fuel_litres), 0), 2) AS mileage_kmpl,
                ROUND(SUM(t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense) / NULLIF(SUM(t.total_km_run), 0), 2) AS cost_per_km
            FROM vehicles v
            LEFT JOIN trips t ON v.vehicle_id = t.vehicle_id
            GROUP BY v.vehicle_number, v.truck_type
            ORDER BY retained_margin DESC NULLS LAST;
        """)
        df = pd.DataFrame(data)
        st.dataframe(df, use_container_width=True)
        csv = df.to_csv(index=False).encode('utf-8')
        st.download_button("📥 Download Report as CSV", csv, "vehicle_profitability_report.csv", "text/csv")

    elif report_type == "2. Month-on-Month Branch Profitability Summary":
        data = run_query("""
            SELECT 
                TO_CHAR(DATE_TRUNC('month', trip_end_date), 'Mon YYYY') AS report_month,
                COUNT(trip_id) AS total_trips,
                SUM(total_km_run) AS total_km,
                SUM(freight_revenue) AS gross_freight_revenue,
                SUM(fuel_expense) AS fuel_expense,
                SUM(driver_bata) AS driver_bata,
                SUM(toll_fastag_expense) AS toll_expense,
                SUM(enroute_repairs_maintenance + loading_unloading_expense + misc_trip_expense) AS other_trip_expenses,
                SUM(freight_revenue - (fuel_expense + driver_bata + toll_fastag_expense + enroute_repairs_maintenance + loading_unloading_expense + misc_trip_expense)) AS gross_retained_profit,
                ROUND((SUM(freight_revenue - (fuel_expense + driver_bata + toll_fastag_expense + enroute_repairs_maintenance + loading_unloading_expense + misc_trip_expense)) / NULLIF(SUM(freight_revenue), 0)) * 100.0, 2) AS gross_margin_pct
            FROM trips
            GROUP BY DATE_TRUNC('month', trip_end_date)
            ORDER BY DATE_TRUNC('month', trip_end_date) DESC;
        """)
        df = pd.DataFrame(data)
        st.dataframe(df, use_container_width=True)
        csv = df.to_csv(index=False).encode('utf-8')
        st.download_button("📥 Download Report as CSV", csv, "mom_branch_profitability.csv", "text/csv")

    elif report_type == "3. Driver Outstanding & Bata Summary":
        data = run_query("""
            SELECT 
                d.driver_code, d.full_name AS driver_name,
                COUNT(t.trip_id) AS total_trips,
                SUM(t.cash_advance_issued) AS total_advances_drawn,
                SUM(t.driver_bata) AS total_bata_earned,
                SUM(t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense) AS total_reimbursement_claims,
                SUM((t.driver_bata + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense) - t.cash_advance_issued) AS net_outstanding_balance
            FROM drivers d
            LEFT JOIN trips t ON d.driver_id = t.primary_driver_id
            GROUP BY d.driver_code, d.full_name
            ORDER BY net_outstanding_balance DESC NULLS LAST;
        """)
        df = pd.DataFrame(data)
        st.dataframe(df, use_container_width=True)
        csv = df.to_csv(index=False).encode('utf-8')
        st.download_button("📥 Download Report as CSV", csv, "driver_ledger_report.csv", "text/csv")

# ==============================================================================
# 6. VIEW & DELETE TRIPS
# ==============================================================================
elif menu == "🔍 View & Delete Trips":
    st.subheader("Manage Existing Trip Records")
    trips_data = run_query("""
        SELECT t.trip_id, t.trip_number, t.trip_end_date, v.vehicle_number, d.full_name AS driver,
               t.origin, t.destination, t.tonnage_loaded, t.freight_revenue,
               (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense) AS total_trip_cost,
               (t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance + t.loading_unloading_expense + t.misc_trip_expense)) AS net_profit,
               t.trip_status
        FROM trips t
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        JOIN drivers d ON t.primary_driver_id = d.driver_id
        ORDER BY t.trip_id DESC;
    """)
    if trips_data:
        df_trips = pd.DataFrame(trips_data)
        st.dataframe(df_trips, use_container_width=True)
        
        st.divider()
        st.write("### 🗑️ Delete a Trip Record")
        delete_id = st.selectbox("Select Trip ID to Delete", df_trips['trip_id'].tolist())
        if st.button("Delete Selected Trip", type="primary"):
            run_query("DELETE FROM trips WHERE trip_id = %s", (delete_id,), fetch=False)
            st.success(f"Trip ID {delete_id} deleted.")
            st.rerun()
    else:
        st.info("No trips found in database.")
