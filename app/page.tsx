    // 3. V2 FEATURE: Fetch Driver & Truck Compliance Expirations (30 Day Window)
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const alerts: any[] = [];

    // Check Drivers
    const { data: drivers } = await supabase.from('drivers').select('driver_code, full_name, expiry_date').eq('is_active', true);
    if (drivers) {
      drivers.forEach(d => {
        if (d.expiry_date && new Date(d.expiry_date) <= thirtyDaysFromNow) {
          alerts.push({ name: `${d.driver_code} - ${d.full_name}`, doc: "Driving License", date: d.expiry_date });
        }
      });
    }

    // Check Trucks (FC, Insurance, Q-Tax, PUC, National Permit, State Permit, Tank Cert)
    const { data: vehicles } = await supabase.from('vehicles').select('vehicle_number, truck_type, fc_expiry_date, insurance_expiry_date, qtax_expiry_date, puc_expiry_date, np_expiry_date, state_permit_expiry_date, tank_cert_expiry_date').eq('is_active', true);
    if (vehicles) {
      vehicles.forEach(v => {
        const checkDoc = (docName: string, dateVal: string) => {
          if (dateVal && new Date(dateVal) <= thirtyDaysFromNow) {
            alerts.push({ name: `Truck ${v.vehicle_number}`, doc: docName, date: dateVal });
          }
        };
        checkDoc("FC Test", v.fc_expiry_date);
        checkDoc("Insurance", v.insurance_expiry_date);
        checkDoc("Quarterly Tax", v.qtax_expiry_date);
        checkDoc("PUC Certificate", v.puc_expiry_date);
        checkDoc("National Permit", v.np_expiry_date);
        checkDoc("State Permit", v.state_permit_expiry_date);
        if (String(v.truck_type).toUpperCase().includes("BULK")) {
          checkDoc("Tank / Pressure Cert", v.tank_cert_expiry_date);
        }
      });
    }

    setExpiringDocs(alerts);
