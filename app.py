import streamlit as st
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import date
import calendar
# --- 1. Cloud & Local Hybrid Database Connection ---
def get_db_credentials():
    # Primary: Reads from Streamlit Cloud Secrets
    try:
        if len(st.secrets) > 0 and "postgres" in st.secrets:
            return st.secrets["postgres"]
    except Exception:
        pass
        
    # Fallback when running locally
    return {
        "host": "aws-0-ap-south-1.pooler.supabase.com",
        "port": 6543,
        "dbname": "postgres",
        "user": "postgres.eobweyciqwoojwnsonor",
        "password": "Poovin@2809"
    }

def get_connection():
    creds = get_db_credentials()
    return psycopg2.connect(
        host=creds["host"],
        port=int(creds["port"]),
        dbname=creds["dbname"],
        user=creds["user"],
        password=creds["password"],
        sslmode="require"
    )

def run_query(query, params=None, fetch=True):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params or ())
            if fetch:
                return cur.fetchall()
            conn.commit()

# --- Streamlit UI Config ---
st.set_page_config(page_title="Fleet Operations & Variable Dispatch", layout="wide")
st.title("🚛 Fleet Operations & Trip Dispatch System")

menu = st.sidebar.radio("Navigation", [
    "📝 New Trip Entry",
    "📑 Settle POD & Shortage",
    "💰 Driver Period Settlement (1-15 / 16-End)",
    "👨‍✈️ Driver Directory & Rates Master",
    "📊 Profitability Reports",
    "🔍 View & Delete Trips"
])

def get_vehicles():
    return run_query("SELECT vehicle_id, vehicle_number, truck_type, carrying_capacity_tons FROM vehicles WHERE is_active = TRUE ORDER BY vehicle_number")

def get_drivers():
    return run_query("SELECT driver_id, driver_code, full_name, phone_number, license_number, license_expiry_date FROM drivers WHERE is_active = TRUE ORDER BY driver_code")

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
# 1. NEW TRIP ENTRY (Default Cochin, 0.00 KM, Rs.0.00 Rate)
# ==============================================================================
if menu == "📝 New Trip Entry":
    st.subheader("Log New Trip (Live Instant Freight & Fuel Calculation)")

    col_quick1, col_quick2 = st.columns(2)

    # 1. Quick Add Driver
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
                            st.success(f"Driver '{qd_name}' added as {auto_code}!")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Error: {e}")

    # 2. Quick Add Destination Slab (Default Cochin, 0.00 KM, Rs. 0.00)
    with col_quick2:
        with st.expander("➕ Quick Add Destination & Truck Slab Rate", expanded=False):
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
                        try:
                            run_query("""
                                INSERT INTO destinations_freight_master (cargo_type, origin, destination_name, capacity_tons, freight_rate_per_ton, standard_km)
                                VALUES (%s, %s, %s, %s, %s, %s)
                                ON CONFLICT (cargo_type, origin, destination_name, capacity_tons) 
                                DO UPDATE SET freight_rate_per_ton = EXCLUDED.freight_rate_per_ton, standard_km = EXCLUDED.standard_km;
                            """, (qr_cargo, qr_origin, qr_dest, qr_cap, qr_rate, qr_km), fetch=False)
                            st.success(f"Saved: {qr_dest} ({qr_cargo} - {qr_cap}T Truck Category) at ₹{qr_rate}/Ton!")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Error: {e}")

    st.markdown("---")

    vehicles = get_vehicles()
    drivers = get_drivers()

    if not drivers:
        st.error("⚠️ No active drivers available. Add one using the quick box above.")
        st.stop()

    if not vehicles:
        st.error("⚠️ No active vehicles found in database. Make sure your database tables are created.")
        st.stop()

    vehicle_dict = {f"{v['vehicle_number']}  |  {v['truck_type']}  |  Class: {v['carrying_capacity_tons']} MT": v for v in vehicles}
    driver_map = {f"{d['driver_code']} - {d['full_name']}": d['driver_id'] for d in drivers}

    current_saved_diesel_rate = get_saved_diesel_rate()

    top_c1, top_c2, top_c3 = st.columns(3)
    with top_c1:
        chosen_truck_str = st.selectbox("Select Truck Number*", list(vehicle_dict.keys()), key="truck_sel")
        selected_vehicle = vehicle_dict[chosen_truck_str]
        truck_class_tons = float(selected_vehicle['carrying_capacity_tons'])
    with top_c2:
        cargo_type_selected = st.radio("Cargo Category*", ["BULK", "BAG"], horizontal=True, key="cargo_sel")
    with top_c3:
        active_diesel_rate = st.number_input(
            "Diesel Rate (₹/Litre) [Auto-Saved]*", 
            min_value=50.0, 
            max_value=150.0, 
            value=current_saved_diesel_rate, 
            step=0.05,
            key="fuel_rate_input"
        )
        if active_diesel_rate != current_saved_diesel_rate:
            set_saved_diesel_rate(active_diesel_rate)
            st.toast(f"✅ Diesel rate updated to ₹{active_diesel_rate:.2f}/L (Saved for future trips)")

    # Fetch applicable rate based on the selected truck's registered capacity slab
    routes_list = get_routes(cargo_type=cargo_type_selected, capacity=truck_class_tons)
    
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
            label = f"{r['origin']} ➔ {r['destination_name']} [{truck_class_tons}T Truck Slab: ₹{r['freight_rate_per_ton']}/Ton | {r['standard_km']} KM]"
            route_options[label] = r

    selected_route_key = st.selectbox("Select Destination Route*", list(route_options.keys()), key="route_sel")
    active_route = route_options[selected_route_key]
    def_origin = active_route['origin']
    def_dest = active_route['destination_name']
    def_km = float(active_route['standard_km'])
    applied_rate_per_ton = float(active_route['freight_rate_per_ton'])

    st.markdown(f"> 📌 **Vehicle:** `{selected_vehicle['vehicle_number']}` | **Category:** `{truck_class_tons} MT Class` | **Rate:** `₹{applied_rate_per_ton}/Ton` | **Diesel Rate:** `₹{active_diesel_rate}/L`")

    # --- Live Reactive Inputs ---
    f_col1, f_col2, f_col3 = st.columns(3)
    
    with f_col1:
        trip_no = st.text_input("Trip / LR Number*", placeholder="TRIP-2026-001", key="trip_no_input")
        chosen_driver_key = st.selectbox("Select Assigned Driver*", list(driver_map.keys()), key="driver_sel")
        trip_origin = st.text_input("Origin Hub", value=def_origin, key="origin_input")
        trip_destination = st.text_input("Destination*", value=def_dest, placeholder="e.g. Sankari", key="dest_input")

    with f_col2:
        start_d = st.date_input("Trip Start Date", date.today(), key="start_d")
        end_d = st.date_input("Trip End Date", date.today(), key="end_d")
        km_run = st.number_input("Total KM Run*", min_value=0.0, step=10.0, value=def_km, key="km_run")
        
        actual_loaded_tonnage = st.number_input(
            "Actual Weighbridge Loaded MT*", 
            min_value=0.0, 
            max_value=50.0, 
            step=0.05, 
            value=truck_class_tons,
            key="loaded_tonnage",
            help="Enter exact loaded weight from weighbridge (e.g. 33.500 MT, 34.200 MT)"
        )
        
        calculated_freight = round(actual_loaded_tonnage * applied_rate_per_ton, 2)
        freight_total = st.number_input(
            f"Total Freight Revenue (₹)* [{actual_loaded_tonnage} MT × ₹{applied_rate_per_ton}/T]", 
            value=calculated_freight, 
            step=100.0,
            key="freight_rev_input"
        )

    with f_col3:
        fuel_qty = st.number_input("Diesel Litres Filled*", min_value=0.0, step=5.0, key="fuel_qty_input")
        
        calculated_fuel_expense = round(fuel_qty * active_diesel_rate, 2)
        fuel_cost = st.number_input(
            f"Diesel Cost (₹)* [{fuel_qty} L × ₹{active_diesel_rate}/L]", 
            value=calculated_fuel_expense, 
            step=100.0,
            key="fuel_cost_input"
        )
        driver_bata_val = st.number_input("Driver Bata (₹)*", min_value=0.0, step=100.0, value=3000.0, key="bata_input")
        toll_val = st.number_input("FASTag / Toll Expense (₹)", min_value=0.0, step=100.0, key="toll_input")
        advance_val = st.number_input("Cash Advance Issued (₹)", min_value=0.0, step=500.0, key="advance_input")

    st.write("")
    if st.button("🚀 Save & Dispatch Trip", type="primary", use_container_width=True):
        if not trip_no or not trip_destination:
            st.error("Please enter Trip Number and Destination.")
        else:
            try:
                run_query("""
                    INSERT INTO trips (
                        trip_number, branch_id, vehicle_id, primary_driver_id,
                        trip_start_date, trip_end_date, origin, destination,
                        total_km_run, tonnage_loaded, loaded_weight_mt,
                        freight_revenue, fuel_litres, fuel_expense,
                        driver_bata, toll_fastag_expense, cash_advance_issued,
                        trip_status, pod_status
                    ) VALUES (%s, 1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'POD_PENDING', 'PENDING_SUBMISSION');
                """, (
                    trip_no, selected_vehicle['vehicle_id'], driver_map[chosen_driver_key],
                    start_d, end_d, trip_origin, trip_destination,
                    km_run, actual_loaded_tonnage, actual_loaded_tonnage,
                    freight_total, fuel_qty, fuel_cost,
                    driver_bata_val, toll_val, advance_val
                ), fetch=False)
                st.success(f"Trip {trip_no} logged for Truck {selected_vehicle['vehicle_number']}! Loaded: {actual_loaded_tonnage} MT | Total Freight: ₹{freight_total:,.2f} | Fuel Cost: ₹{fuel_cost:,.2f}")
            except Exception as e:
                st.error(f"Error saving trip: {e}")

# ==============================================================================
# 2. SETTLE POD & SHORTAGE
# ==============================================================================
elif menu == "📑 Settle POD & Shortage":
    st.subheader("POD Verification & Shortage Settlement")
    pending_trips = run_query("""
        SELECT t.trip_id, t.trip_number, v.vehicle_number, d.full_name, t.loaded_weight_mt, t.driver_bata, t.cash_advance_issued
        FROM trips t
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        JOIN drivers d ON t.primary_driver_id = d.driver_id
        WHERE t.trip_status != 'COMPLETED'
        ORDER BY t.trip_end_date DESC
    """)
    
    if not pending_trips:
        st.info("No pending trips waiting for POD settlement.")
    else:
        trip_options = {f"{t['trip_number']} | {t['vehicle_number']} | {t['full_name']} | Loaded: {t['loaded_weight_mt']} MT": t for t in pending_trips}
        chosen_trip_str = st.selectbox("Select Pending Trip", list(trip_options.keys()))
        selected_trip = trip_options[chosen_trip_str]

        with st.form("settle_pod_form"):
            col1, col2 = st.columns(2)
            with col1:
                st.write(f"**Trip Number:** {selected_trip['trip_number']}")
                st.write(f"**Loaded Weight:** {selected_trip['loaded_weight_mt']} MT")
                st.write(f"**Driver Bata:** ₹{selected_trip['driver_bata']} | **Cash Advance Given:** ₹{selected_trip['cash_advance_issued']}")
                
                pod_no = st.text_input("POD / Challan Receipt No*", placeholder="POD-9981")
                pod_date = st.date_input("POD Received Date", date.today())
                received_weight = st.number_input("Customer Received Weight (MT)*", min_value=0.0, max_value=float(selected_trip['loaded_weight_mt'])+5.0, value=float(selected_trip['loaded_weight_mt']), step=0.01)

            with col2:
                allowable_shortage = st.number_input("Allowable Shortage (MT)", min_value=0.0, value=0.050, step=0.01)
                shortage_rate = st.number_input("Shortage Penalty Rate per MT (₹)", min_value=0.0, value=5500.0, step=100.0)
                shortage_bearer = st.selectbox("Debited Penalty To", ["DRIVER", "TRANSPORTER", "CUSTOMER"])
                remarks = st.text_area("Settlement Remarks", "Weighbridge verified")

            settle_btn = st.form_submit_button("✅ Settle Shortage & Complete Trip")
            if settle_btn:
                try:
                    res = run_query("""
                        SELECT settle_and_close_trip(%s, %s, %s, %s, %s, %s, %s, %s) AS result
                    """, (
                        selected_trip['trip_id'], received_weight, pod_no, pod_date,
                        allowable_shortage, shortage_rate, shortage_bearer, remarks
                    ))
                    st.success("Trip marked COMPLETED and shortage recorded!")
                    st.json(res[0]['result'])
                except Exception as e:
                    st.error(f"Error settling trip: {e}")

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
            CASE WHEN t.shortage_bearer = 'DRIVER' THEN t.shortage_penalty_deduction ELSE 0.00 END AS driver_shortage_deduction,
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
        total_shortages = df_period['driver_shortage_deduction'].sum()
        net_payable = (total_bata + total_claims) - (total_advances + total_shortages)

        st.divider()
        st.write("### 💵 Settlement Calculation Summary")
        m_col1, m_col2, m_col3, m_col4 = st.columns(4)
        m_col1.metric("Total Driver Bata Earned", f"₹{total_bata:,.2f}")
        m_col2.metric("Total Advances Issued", f"₹{total_advances:,.2f}", delta=f"-₹{total_advances:,.2f}", delta_color="inverse")
        m_col3.metric("Shortage Penalties Debited", f"₹{total_shortages:,.2f}", delta=f"-₹{total_shortages:,.2f}", delta_color="inverse")
        m_col4.metric("Total Out-of-Pocket Claims", f"₹{total_claims:,.2f}")

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
                        st.success("Driver updated!")
                        st.rerun()

            with col_de2:
                st.write("### 🗑️ Delete Driver")
                del_drv = st.selectbox("Select Driver to Delete", list(drv_map.keys()), key="del_drv_sel")
                if st.button("Delete Driver Profile", type="primary"):
                    try:
                        run_query("DELETE FROM drivers WHERE driver_id = %s", (drv_map[del_drv]['driver_id'],), fetch=False)
                        st.success("Driver deleted.")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Cannot delete driver attached to existing trips: {e}")

    with tab_rt:
        all_routes = run_query("SELECT * FROM destinations_freight_master WHERE is_active = TRUE ORDER BY cargo_type, destination_name, capacity_tons ASC")
        if all_routes:
            df_r = pd.DataFrame(all_routes)
            st.dataframe(df_r[['destination_id', 'cargo_type', 'origin', 'destination_name', 'capacity_tons', 'freight_rate_per_ton', 'standard_km']], use_container_width=True)
            
            st.divider()
            col_re1, col_re2 = st.columns(2)
            with col_re1:
                st.write("### ✏️ Update Freight Rate for Slab")
                rt_dict = {f"ID {r['destination_id']}: [{r['cargo_type']}] {r['origin']} ➔ {r['destination_name']} ({r['capacity_tons']} MT Slab @ ₹{r['freight_rate_per_ton']})": r for r in all_routes}
                chosen_rt = st.selectbox("Select Route Slab", list(rt_dict.keys()))
                new_rate = st.number_input("Updated Rate per Ton (₹)", value=float(rt_dict[chosen_rt]['freight_rate_per_ton']), step=25.0)
                if st.button("Save New Slab Rate"):
                    run_query("UPDATE destinations_freight_master SET freight_rate_per_ton = %s WHERE destination_id = %s", (new_rate, rt_dict[chosen_rt]['destination_id']), fetch=False)
                    st.success("Rate updated!")
                    st.rerun()
            with col_re2:
                st.write("### 🗑️ Delete Destination Slab")
                if st.button("Delete Selected Route Slab", type="primary"):
                    run_query("DELETE FROM destinations_freight_master WHERE destination_id = %s", (rt_dict[chosen_rt]['destination_id'],), fetch=False)
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
                SUM(t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance) AS direct_costs,
                SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance)) AS retained_margin,
                ROUND((SUM(t.freight_revenue - (t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance)) / NULLIF(SUM(t.freight_revenue), 0)) * 100.0, 2) AS margin_pct,
                ROUND(SUM(t.total_km_run) / NULLIF(SUM(t.fuel_litres), 0), 2) AS mileage_kmpl,
                ROUND(SUM(t.fuel_expense + t.driver_bata + t.toll_fastag_expense + t.enroute_repairs_maintenance) / NULLIF(SUM(t.total_km_run), 0), 2) AS cost_per_km
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
                SUM(freight_revenue - (fuel_expense + driver_bata + toll_fastag_expense + enroute_repairs_maintenance)) AS gross_retained_profit,
                ROUND((SUM(freight_revenue - (fuel_expense + driver_bata + toll_fastag_expense + enroute_repairs_maintenance)) / NULLIF(SUM(freight_revenue), 0)) * 100.0, 2) AS gross_margin_pct
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
                SUM(t.shortage_penalty_deduction) AS total_shortage_penalties,
                SUM((t.driver_bata) - (t.cash_advance_issued + CASE WHEN t.shortage_bearer = 'DRIVER' THEN t.shortage_penalty_deduction ELSE 0 END)) AS net_outstanding_balance
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
               t.origin, t.destination, t.tonnage_loaded, t.freight_revenue, t.trip_status, t.pod_status
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
            st.success(f"Trip ID {delete_id} deleted successfully.")
            st.rerun()
    else:
        st.info("No trips found in database.")
