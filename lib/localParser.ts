// lib/localParser.ts

export function parseDocumentLocally(rawText: string, documentType: string) {
  const text = rawText.toUpperCase();
  let result: any = {};

  // 1. Universal Indian Vehicle Registration Plate Regex (e.g., TN88K8413, KA01AJ8601, KL43F1826)
  const truckRegex = /(?:VEHICLE|TRUCK|LORRY)[\sNO.\/]*([A-Z]{2}[-\s]?[0-9]{2}[-\s]?[A-Z]{1,2}[-\s]?[0-9]{4})/i;
  const generalTruckRegex = /[A-Z]{2}[-\s]?[0-9]{2}[-\s]?[A-Z]{1,2}[-\s]?[0-9]{4}/;
  
  let truckMatch = text.match(truckRegex);
  if (!truckMatch) {
    truckMatch = text.match(generalTruckRegex);
  }
  result.truckNo = truckMatch ? (truckMatch[1] || truckMatch[0]).replace(/[-\s]/g, "") : "";

  if (documentType === "TRIP_INVOICE") {
    // Extract LR / RR Number (commonly formatted like 687/20260915 or CO0187)
    const lrRegex = /(?:LR|RR|BILTY)[\sNO.\/]*([A-Z0-9\/_-]+)/i;
    const lrMatch = text.match(lrRegex);
    result.lrNo = lrMatch ? lrMatch[1].trim() : "";

    // Extract Tonnage (Qty in MT) - e.g., 34.400, 29.360
    const tonnageRegex = /(?:QTY|QUANTITY|NET\s*WT|WEIGHT)[\sIN\sMT]*([0-9]+\.[0-9]+)/i;
    const tonnageMatch = text.match(tonnageRegex);
    result.tonnage = tonnageMatch ? parseFloat(tonnageMatch[1]) : 30.0;

    // Extract Destination City
    const destRegex = /(?:DESTINATION|DELIVERY\s*TO|SITE)[\s:]*([A-Z\s]+)(?:\r?\n|P\/|PIN|STATE)/i;
    const destMatch = text.match(destRegex);
    result.destination = destMatch ? destMatch[1].trim() : "KAKKANAD";

    // Cargo Type inference based on invoice description
    result.cargoType = text.includes("BAG") ? "BAG" : "BULK";
    result.source = text.includes("SALEM") ? "JSW Salem Plant" : "UTCL Cochin Terminal";
    
    // Extract Invoice Date
    const dateRegex = /([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
      const parts = dateMatch[1].split(".");
      result.date = `${parts[2]}-${parts[1]}-${parts[0]}`; // Convert to YYYY-MM-DD
    } else {
      result.date = new Date().toISOString().split('T')[0];
    }

  } else if (documentType === "FUEL_SLIP") {
    // Extract Diesel Litres
    const litresRegex = /([0-9]+\.[0-9]+)\s*(?:LTR|LITRES|L)/i;
    const litresMatch = text.match(litresRegex);
    result.litres = litresMatch ? parseFloat(litresMatch[1]) : 0;

    // Extract Total Amount
    const amountRegex = /(?:TOTAL|RS|INR|AMOUNT)[\s.:]*([0-9]+\.?[0-9]*)/i;
    const amountMatch = text.match(amountRegex);
    result.totalAmount = amountMatch ? parseFloat(amountMatch[1]) : 0;
    result.rate = result.litres > 0 ? Number((result.totalAmount / result.litres).toFixed(2)) : 0;

  } else if (documentType === "POD_CLOSURE") {
    const lrRegex = /(?:LR|RR|BILTY)[\sNO.\/]*([A-Z0-9\/_-]+)/i;
    const lrMatch = text.match(lrRegex);
    result.lrNo = lrMatch ? lrMatch[1].trim() : "";

    // Extract Shortage Weight in KG
    const shortRegex = /(?:SHORTAGE|DIFF|DEDUCTION)[\s#:]*([0-9]+)/i;
    const shortMatch = text.match(shortRegex);
    result.shortageKg = shortMatch ? parseInt(shortMatch[1], 10) : 0;
    result.deliveryDate = new Date().toISOString().split('T')[0];
  }

  return result;
}
