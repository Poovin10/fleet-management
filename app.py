import streamlit as st
import pandas as pd
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from datetime import date
import calendar

# --- 1. High-Speed Persistent Connection Pool ---
def get_db_credentials():
    try:
        if len(st.secrets) > 0 and "postgres" in st.secrets:
            return st.secrets["postgres"]
    except Exception:
        pass
        
    return {
        "host": "aws-0-ap-south-1.pooler.supabase.com",
        "port": 6543,
        "dbname": "postgres",
        "user": "postgres.eobweyciqwoojwnsonor",
        "password": "Poovin@2809"
    }

@st.cache_resource
def init_connection_pool():
    creds = get_db_credentials()
    return pool.ThreadedConnectionPool(
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
                return cur.fetchall()
            conn.commit()
    finally:
        db_pool.putconn(conn)

# --- Streamlit UI Config ---
st.set_page_config(page_title="Fleet Operations & Expense Manager", layout="wide")
st.title("🚛 Fleet Operations & Trip Dispatch System")

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

# Cached queries for high speed
@st.cache_data(ttl=60)
def get_vehicles():
    return run_query("SELECT vehicle_id, vehicle_number, truck_type, carrying_capacity_tons, current_status, status_remarks, status_updated_at FROM vehicles WHERE is_active = TRUE ORDER BY vehicle_number")

@st.cache_data(ttl=60)
def get_drivers():
    return run_query("SELECT driver_id, driver_code, full_name, phone_number, license_number, license_expiry_date FROM drivers WHERE is_active = TRUE ORDER BY driver_code")

@st.cache_data(ttl=60)
def get_routes(cargo_type=None, capacity=None):
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

def get_saved_diesel_rate():
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

def get_next_driver_code():
    try:
        last_drv = run_query("SELECT driver_code FROM drivers ORDER BY driver_id DESC LIMIT 1")
        if last_drv and last_drv[0]['driver_code'].startswith("DRV-"):
            next_num = int(last_drv[0]['driver_code'].split("-")[1]) + 1
            return f"DRV-{next_num:03d}"
    except Exception:
        pass
    return f"DRV-{len(get_drivers())+1:03d}"

# ==============================================================================
# 0. LIVE FLEET STATUS & YARD BOARD
# ==============================================================================
if menu == "🚦 Live Fleet Status & Yard Board":
    st.subheader("Live Vehicle Operational Status & Yard Monitoring")
    
    vehicles_data = get_vehicles()
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
                st.cache_data.clear()
                st.success(f"Status updated to: {STATUS_MAP[new_status_key]}")
                st.rerun()

# ==============================================================================
# 1. NEW TRIP ENTRY (Auto Cargo Detection)
# ==============================================================================
elif menu == "📝 New Trip Entry":
    st.subheader("Log New Trip (Live Instant Freight & Fuel Calculation)")

    col_quick1, col_quick2 = st.columns(2)

    with col_quick1:
        with st.expander("➕ Quick Add New Driver (On the fly)", expanded=False):
            auto_code = get_next_driver_code()
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
                        try:
                            run_query("""
                                INSERT INTO drivers (driver_code, full_name, phone_number, license_number, license_expiry_date, branch_id)
                                VALUES (%s, %s, %s, %s, %s, 1)
                            """, (auto_code, qd_name, qd_phone, qd_license, qd_expiry), fetch=False)
                            st.cache_data.clear()
                            st.success(f"Driver '{qd_name}' added as {auto_code}!")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Error: {e}")

    with col_quick2:
        with st.expander("➕ Quick Add Destination & Truck Slab Rate", expanded=False):
            with st.form("inline_route_form", clear_on_submit=True):
                qr_c1, qr_c2 = st.columns(2)
                with qr_c1:
                    qr_cargo = st.selectbox("Cargo Category*", ["BULK", "BAG"])
                    qr_origin = st.text_input("Origin Hub*", "COCHIN")
                    qr_dest = st.text_input("Destination Name*", placeholder="e.g. Sankari / Aluva")
                with qr_c2:
                    qr_slab_label = st.selectbox("Truck Slab Category*", ["25/30 MT Slab", "35 MT Slab"])
                    qr_cap = 30.0 if "30" in qr_slab_label else 35.0
                    
                    qr_km = st.number_input("Standard Route KM", min_value=0.0, step=10.0, value=0.0)
                    qr_rate = st.number_input("Freight Rate per Ton (₹)*", min_value=0.0, step=25.0, value=0.0)
                
                if st.form_submit_button("➕ Save Destination Rate"):
                    if not qr_dest:
                        st.error("Destination name is required.")
                    elif qr_cargo == "BAG" and qr_cap == 35.0:
                        st.error("BAG cargo is only applicable for the 25/30 MT Slab.")
                    else:
                        try:
                            run_query("""
                                INSERT INTO destinations_freight_master (cargo_type, origin, destination_name, capacity_tons, freight_rate_per_ton, standard_km)
                                VALUES (%s, %s, %s, %s, %s, %s)
                                ON CONFLICT (cargo_type, origin, destination_name, capacity_tons) 
                                DO UPDATE SET freight_rate_per_ton = EXCLUDED.freight_rate_per_ton, standard_km = EXCLUDED.standard_km;
                            """, (qr_cargo, qr_origin, qr_dest, qr_cap, qr_rate, qr_km), fetch=False)
                            st.cache_data.clear()
                            st.success(f"Saved: {qr_dest} ({qr_cargo} - {qr_slab_label}) at ₹{qr_rate}/Ton!")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Error: {e}")

    st.markdown("---")

    vehicles = get_vehicles()
    drivers = get_drivers()

    if not drivers or not vehicles:
        st.error("⚠️ Ensure drivers and vehicles exist in database.")
        st.stop()

    vehicle_dict = {f"{v['vehicle_number']} | {v['truck_type']} | {v['carrying_capacity_tons']} MT": v for v in vehicles}
    driver_map = {f"{d['driver_code']} - {d['full_name']}": d['driver_id'] for d in drivers}

    current_saved_diesel_rate = get_saved_diesel_rate()

    # Route & Setup Bar
    top_c1, top_c2, top_c3 = st.columns(3)
    with top_c1:
        chosen_truck_str = st.selectbox("Select Truck Number*", list(vehicle_dict.keys()), key="truck_sel")
        selected_vehicle = vehicle_dict[chosen_truck_str]
        truck_class_tons = float(selected_vehicle['carrying_capacity_tons'])
        
        # AUTO-DETECT CARGO TYPE BASED ON TRUCK PROFILE
        if "bag" in selected_vehicle['truck_type'].lower():
            cargo_type_selected = "BAG"
        else:
            cargo_type_selected = "BULK"

    with top_c2:
        # Display as a locked field instead of a manual radio button
        st.text_input("Auto-Detected Cargo Profile", value=cargo_type_selected, disabled=True, help="Automatically assigned from Master Data based on truck type.")
        
    with top_c3:
        active_diesel_rate = st.number_input(
            "Current Diesel Rate (₹/Litre)*", 
            min_value=50.0, 
            max_value=150.0, 
            value=current_saved_diesel_rate, 
            step=0.05,
            key="fuel_rate_input"
        )

    # 3-SLAB MAPPING LOGIC
    if cargo_type_selected == "BAG":
        rate_lookup_capacity = 30.0 
    else:
        rate_lookup_capacity = 30.0 if truck_class_tons <= 30.0 else 35.0
    
    routes_list = get_routes(cargo_type=cargo_type_selected, capacity=rate_lookup_capacity)
    
    route_options = {
        "-- Manual Route / Custom Entry --": {
            "origin": "COCHIN",
            "destination_name": "",
            "standard_km": 0.0,
            "freight_rate_per_ton": 0.0
        }
    }
    
    if routes_list:
        for r in routes_list:
            display_slab = "25/30 MT" if r['capacity_tons'] == 30.0 else "35 MT"
            label = f"{r['origin']} ➔ {r['destination_name']} [{display_slab} {r['cargo_type']} Slab: ₹{r['freight_rate_per_ton']}/Ton | {r['standard_km']} KM]"
            route_options[label] = r

    selected_route_key = st.selectbox("Select Destination Route*", list(route_options.keys()), key="route_sel")
    active_route = route_options[selected_route_key]
    def_origin = active_route['origin']
    def_dest = active_route['destination_name']
    def_km = float(active_route['standard_km'])
    applied_rate_per_ton = float(active_route['freight_rate_per_ton'])

    # --- Single Reactive Form ---
    with st.form("dispatch_trip_form"):
        f_col1, f_col2, f_col3 = st.columns(3)
        
        with f_col1:
            st.markdown("#### 1️⃣ Trip & Route Info")
            trip_no = st.text_input("Trip / LR Number*", placeholder="TRIP-2026-001")
            chosen_driver_key = st.selectbox("Select Assigned Driver*", list(driver_map.keys()))
            trip_origin = st.text_input("Origin Hub", value=def_origin)
            trip_destination = st.text_input("Destination*", value=def_dest, placeholder="e.g. Sankari")
            km_run = st.number_input("Total KM Run*", min_value=0.0, step=10.0, value=def_km)

        with f_col2:
            st.markdown("#### 2️⃣ Load & Weight")
            start_d = st.date_input("Trip Start Date", date.today())
            end_d = st.date_input("Trip End Date", date.today())
            actual_loaded_tonnage = st.number_input("Weighbridge Loaded Weight (MT)*", min_value=0.0, max_value=50.0, step=0.05, value=truck_class_tons)
            manual_freight_rate = st.number_input("Freight Rate per Ton (₹)", min_value=0.0, step=25.0, value=applied_rate_per_ton)

        with f_col3:
            st.markdown("#### 3️⃣ Fuel & Allowances")
            fuel_qty = st.number_input("Diesel Litres Filled*", min_value=0.0, step=10.0, value=0.0)
            driver_bata_val = st.number_input("Driver Bata (₹)*", min_value=0.0, step=100.0, value=3000.0)
            toll_val = st.number_input("FASTag / Toll Expense (₹)", min_value=0.0, step=100.0, value=0.0)
            advance_val = st.number_input("Cash Advance Issued (₹)", min_value=0.0, step=500.0, value=0.0)

        dispatch_clicked = st.form_submit_button("🚀 Save & Dispatch Trip", type="primary", use_container_width=True)

        if dispatch_clicked:
            if not trip_no or not trip_destination:
                st.error("Please enter Trip Number and Destination.")
            else:
                calculated_freight = round(actual_loaded_tonnage * manual_freight_rate, 2)
                calculated_fuel_expense = round(fuel_qty * active_diesel_rate, 2)
                
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

                    st.cache_data.clear()
                    st.success(f"Trip {trip_no} saved! Auto-Calculated Freight: ₹{calculated_freight:,.2f} | Fuel: ₹{calculated_fuel_expense:,.2f}")
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
            t.origin, t.destination, t.trip_start_date, t.trip_end_date,
            t.fuel_expense, t.driver_bata, t.toll_fastag_expense,
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
                e_repair = st.number_input("En-route Repairs & Workshop Maintenance (₹)", min_value=0.0, value=float(t['enroute_repairs_maintenance'] or 0.0), step=100.0)
            with ec2:
                e_loading = st.number_input("Loading / Unloading & Hamali Expense (₹)", min_value=0.0, value=float(t['loading_unloading_expense'] or 0.0), step=50.0)
            with ec3:
                e_misc = st.number_input("Misc Trip Expense / Driver Claims (₹)", min_value=0.0, value=float(t['misc_trip_expense'] or 0.0), step=50.0)

            ac1, ac2 = st.columns(2)
            with ac1:
                e_toll = st.number_input("Updated FASTag / Toll Expense (₹)", min_value=0.0, value=float(t['toll_fastag_expense'] or 0.0), step=100.0)
            with ac2:
                e_advance = st.number_input("Total Cash Advance Issued to Driver (₹)", min_value=0.0, value=float(t['cash_advance_issued'] or 0.0), step=500.0)

            expense_submit = st.form_submit_button("💾 Save Expenses to Trip", type="primary", use_container_width=True)
            if expense_submit:
                try:
                    run_query("""
                        UPDATE trips
                        SET enroute_repairs_maintenance = %s,
                            loading_unloading_expense = %s,
                            misc_trip_expense = %s,
                            toll_fastag_expense = %s,
                            cash_advance_issued = %s
                        WHERE trip_id = %s;
                    """, (e_repair, e_loading, e_misc, e_toll, e_advance, t['trip_id']), fetch=False)
                    st.cache_data.clear()
                    st.success(f"Expenses updated successfully for Trip {t['trip_number']}!")
                    st.rerun()
                except Exception as e:
                    st.error(f"Error updating expenses: {e}")

# ==============================================================================
# 3. DRIVER PERIOD SETTLEMENT (1-15 / 16-END)
# ==============================================================================
elif menu == "💰 Driver Period Settlement (1-15 / 16-End)":
    st.subheader("Driver Bi-Monthly Settlement Sheet")
    drivers = get_drivers()
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
                st.cache_data.clear()
                st.success("All period trips marked as SETTLED!")
                st.rerun()

# ==============================================================================
# 4. DRIVER DIRECTORY & RATES MASTER
# ==============================================================================
elif menu == "👨‍✈️ Driver Directory & Rates Master":
    st.subheader("Manage Drivers, Routes, and Capacity Rate Cards")

    tab_drv, tab_rt = st.tabs(["👨‍✈️ Drivers Directory", "📍 Destinations & Capacity Rate Slabs"])

    with tab_drv:
        drivers_list = get_drivers()
        if drivers_list:
            df_d = pd.DataFrame(drivers_list)
            st.dataframe(df_d, use_container_width=True)
            
            st.divider()
            col_de1, col_de2 = st.columns(2)
            with col_de1:
                st.write("### ✏️ Edit Driver")
                drv_map = {f"{d['driver_code']} - {d['full_name']}": d for d in drivers_list}
                chosen_d = st.selectbox("Select Driver to Edit", list(drv_map.keys()))
                d_val = drv_map[chosen_d]
                
                with st.form("edit_drv_modal"):
                    e_name = st.text_input("Name", value=d_val['full_name'])
                    e_phone = st.text_input("Phone", value=d_val['phone_number'])
                    e_lic = st.text_input("License", value=d_val['license_number'])
                    e_exp = st.date_input("Expiry", value=d_val['license_expiry_date'] or date(2030, 1, 1))
                    if st.form_submit_button("Update Driver"):
                        run_query("UPDATE drivers SET full_name=%s, phone_number=%s, license_number=%s, license_expiry_date=%s WHERE driver_id=%s",
                                  (e_name, e_phone, e_lic, e_exp, d_val['driver_id']), fetch=False)
                        st.cache_data.clear()
                        st.success("Driver updated!")
                        st.rerun()

            with col_de2:
                st.write("### 🗑️ Delete Driver")
                del_drv = st.selectbox("Select Driver to Delete", list(drv_map.keys()), key="del_drv_sel")
                if st.button("Delete Driver Profile", type="primary"):
                    try:
                        run_query("DELETE FROM drivers WHERE driver_id = %s", (drv_map[del_drv]['driver_id'],), fetch=False)
                        st.cache_data.clear()
                        st.success("Driver deleted.")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Cannot delete driver attached to existing trips: {e}")

    with tab_rt:
        all_routes = run_query("SELECT * FROM destinations_freight_master WHERE is_active = TRUE ORDER BY cargo_type, destination_name, capacity_tons ASC")
        if all_routes:
            df_r = pd.DataFrame(all_routes)
            df_r['slab_label'] = df_r.apply(lambda row: f"25/30 MT {row['cargo_type']} Slab" if float(row['capacity_tons']) == 30.0 else f"35 MT {row['cargo_type']} Slab", axis=1)
            st.dataframe(df_r[['destination_id', 'cargo_type', 'origin', 'destination_name', 'slab_label', 'freight_rate_per_ton', 'standard_km']], use_container_width=True)
            
            st.divider()
            col_re1, col_re2 = st.columns(2)
            with col_re1:
                st.write("### ✏️ Update Freight Rate for Slab")
                rt_dict = {f"ID {r['destination_id']}: {r['origin']} ➔ {r['destination_name']} ({'25/30 MT' if float(r['capacity_tons']) == 30.0 else '35 MT'} {r['cargo_type']} Slab @ ₹{r['freight_rate_per_ton']})": r for r in all_routes}
                chosen_rt = st.selectbox("Select Route Slab", list(rt_dict.keys()))
                new_rate = st.number_input("Updated Rate per Ton (₹)", value=float(rt_dict[chosen_rt]['freight_rate_per_ton']), step=25.0)
                if st.button("Save New Slab Rate"):
                    run_query("UPDATE destinations_freight_master SET freight_rate_per_ton = %s WHERE destination_id = %s", (new_rate, rt_dict[chosen_rt]['destination_id']), fetch=False)
                    st.cache_data.clear()
                    st.success("Rate updated!")
                    st.rerun()
            with col_re2:
                st.write("### 🗑️ Delete Destination Slab")
                if st.button("Delete Selected Route Slab", type="primary"):
                    run_query("DELETE FROM destinations_freight_master WHERE destination_id = %s", (rt_dict[chosen_rt]['destination_id'],), fetch=False)
                    st.cache_data.clear()
                    st.success("Route slab deleted.")
                    st.rerun()

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
            st.cache_data.clear()
            st.success(f"Trip ID {delete_id} deleted successfully.")
            st.rerun()
    else:
        st.info("No trips found in database.")
