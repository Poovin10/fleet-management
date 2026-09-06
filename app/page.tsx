'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

  useEffect(() => {
    async function fetchAllTimeMetrics() {
      // 1. Total Fleet Size
      const { count: vCount } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (vCount !== null) setFleetCount(vCount);

      // 2. Active Trips & Pending PODs
      const { data: activeTrips } = await supabase
        .from('trips')
        .select('trip_id')
        .in('trip_status', ['IN_TRANSIT', 'DISPATCHED']);

      if (activeTrips) {
        setActiveTripsCount(activeTrips.length);
        setPendingPodsCount(activeTrips.length);
      }

      // 3. Fetch ALL trips without date restriction to compare baseline totals
      const { data: allTrips } = await supabase
        .from('trips')
        .select('tonnage_loaded, loaded_weight_mt, freight_revenue');

      if (allTrips) {
        let totalTons = 0;
        let totalRev = 0;

        allTrips.forEach(t => {
          totalTons += Number(t.tonnage_loaded || t.loaded_weight_mt) || 0;
          totalRev += Number(t.freight_revenue) || 0;
        });

        setMonthTonnage(totalTons);
        setMonthFreight(totalRev);
      }
    }

    fetchAllTimeMetrics();
  }, [supabase]);
