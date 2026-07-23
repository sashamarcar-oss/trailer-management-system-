import { Trailer, Client, Expense, Rental, Quotation, Invoice } from "@/types";

export const mockTrailers: Trailer[] = [
  { id: "TR-001", trailerNumber: "TR-001", registrationNumber: "KDA 221C", vin: "1FUJA6CV05LM12345", type: "Flatbed", brand: "Schmitz", model: "S.KO", year: 2019, capacity: "40T", status: "Available", location: "Nairobi Yard", nextInspection: "2026-08-12", insuranceExpiry: "2026-11-02" },
  { id: "TR-014", trailerNumber: "TR-014", registrationNumber: "KDB 552F", vin: "2FUJA6CV05LM54321", type: "Low Loader", brand: "Faymonville", model: "MAX", year: 2020, capacity: "60T", status: "Rented", location: "Mombasa Yard", nextInspection: "2026-09-03", insuranceExpiry: "2026-10-15" },
  { id: "TR-027", trailerNumber: "TR-027", registrationNumber: "KDC 118L", vin: "3FUJA6CV05LM99887", type: "Fuel Tanker", brand: "LAG", model: "Volume+", year: 2018, capacity: "45,000L", status: "Under Maintenance", location: "Nairobi Workshop", nextInspection: "2026-07-20", insuranceExpiry: "2026-08-30" },
  { id: "TR-033", trailerNumber: "TR-033", registrationNumber: "KDA 900J", vin: "4FUJA6CV05LM66554", type: "Container Trailer", brand: "Kögel", model: "SLC", year: 2021, capacity: "40ft", status: "Rented", location: "Nakuru Yard", nextInspection: "2026-08-29", insuranceExpiry: "2026-12-01" },
  { id: "TR-041", trailerNumber: "TR-041", registrationNumber: "KDD 442M", vin: "5FUJA6CV05LM33221", type: "Side Tipper", brand: "Weiying", model: "ST-30", year: 2019, capacity: "30T", status: "Available", location: "Nairobi Yard", nextInspection: "2026-10-15", insuranceExpiry: "2026-09-18" },
];

export const mockClients: Client[] = [
  { id: "CL-101", code: "CL-101", client_type: "Company", name: "Zenith Freight Ltd", contact_person: "David Mwangi", contact_phone: "+254 722 445 108", email: "ops@zenithfreight.co.ke", address: "Enterprise Road, Industrial Area", city: "Nairobi", country: "Kenya", kra_pin: "P051234567X", business_registration: "CPR/2014/119876", credit_limit: 1000000, outstanding_balance: 340000, preferred_payment_terms: "Net 30", rating: 4.6, blacklisted: false },
  { id: "CL-102", code: "CL-102", client_type: "Company", name: "Kamau Logistics", contact_person: "Peter Kamau", contact_phone: "+254 733 220 771", email: "info@kamaulogistics.co.ke", address: "Moi Avenue", city: "Mombasa", country: "Kenya", kra_pin: "P049988771K", business_registration: "CPR/2011/084421", credit_limit: 500000, outstanding_balance: 0, preferred_payment_terms: "Net 15", rating: 4.9, blacklisted: false },
  { id: "CL-103", code: "CL-103", client_type: "Company", name: "Savannah Movers Ltd", contact_person: "Grace Wanjiru", contact_phone: "+254 700 118 665", email: "accounts@savannahmovers.co.ke", address: "Kenyatta Avenue", city: "Nakuru", country: "Kenya", kra_pin: "P052211003M", business_registration: "CPR/2017/220091", credit_limit: 300000, outstanding_balance: 128500, preferred_payment_terms: "Net 30", rating: 4.2, blacklisted: false },
  { id: "CL-104", code: "CL-104", client_type: "Individual", name: "James Otieno", contact_person: "James Otieno", contact_phone: "+254 711 900 442", email: "j.otieno@gmail.com", address: "Milimani Estate", city: "Kisumu", country: "Kenya", national_id: "27614432", credit_limit: 150000, outstanding_balance: 45000, preferred_payment_terms: "Cash", rating: 3.8, blacklisted: false },
];

export const mockExpenses: Expense[] = [
  { id: "EX-5510", date: "2026-07-19", trailer: "TR-027", category: "Repairs", vendor: "Nairobi Diesel Works", amount: 84500, paymentMethod: "Bank", status: "Approved" },
  { id: "EX-5508", date: "2026-07-18", trailer: "TR-014", category: "Fuel", vendor: "Total Energies", amount: 32200, paymentMethod: "Card", status: "Approved" },
  { id: "EX-5502", date: "2026-07-16", trailer: "TR-060", category: "Tyres", vendor: "Sameer Africa", amount: 118000, paymentMethod: "Bank", status: "Pending" },
  { id: "EX-5497", date: "2026-07-14", trailer: "", category: "Insurance", vendor: "APA Insurance", amount: 210000, paymentMethod: "Bank", status: "Approved" },
];

export const mockRentals: Rental[] = [
  { id: "RN-3301", client: "Zenith Freight Ltd", trailer: "TR-033", rentalType: "Monthly", pickupDate: "2026-07-01", returnDate: "2026-07-31", status: "Active" },
  { id: "RN-3298", client: "Kamau Logistics", trailer: "TR-014", rentalType: "Weekly", pickupDate: "2026-07-14", returnDate: "2026-07-21", status: "Overdue" },
  { id: "RN-3290", client: "Savannah Movers Ltd", trailer: "TR-052", rentalType: "Long Term", pickupDate: "2026-06-01", returnDate: "2026-09-30", status: "Active" },
];

export const mockQuotations: Quotation[] = [
  { id: "QT-0091", client: "Coastal Bulk Transport", issueDate: "2026-07-18", expiryDate: "2026-08-01", value: 480000, status: "Pending" },
  { id: "QT-0088", client: "Zenith Freight Ltd", issueDate: "2026-07-14", expiryDate: "2026-07-28", value: 1120000, status: "Accepted" },
  { id: "QT-0085", client: "Rift Valley Haulers", issueDate: "2026-07-10", expiryDate: "2026-07-24", value: 260000, status: "Draft" },
];

export const mockInvoices: Invoice[] = [
  { id: "INV-2041", client: "Kamau Logistics", date: "2026-07-18", dueDate: "2026-07-25", total: 214000, balance: 0, status: "Paid" },
  { id: "INV-2039", client: "Zenith Freight Ltd", date: "2026-07-15", dueDate: "2026-07-29", total: 1120000, balance: 340000, status: "Partially Paid" },
  { id: "INV-2035", client: "Rift Valley Haulers", date: "2026-07-10", dueDate: "2026-07-17", total: 612000, balance: 612000, status: "Overdue" },
];
