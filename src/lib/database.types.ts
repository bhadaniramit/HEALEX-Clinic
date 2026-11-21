export type UserRole = "super_admin" | "admin" | "general" | "patient";
export type RecommendationType = "medicine" | "exercise" | "diet_lifestyle";

export const recommendationTypeLabel: Record<RecommendationType, string> = {
  medicine: "Medicine",
  exercise: "Exercise",
  diet_lifestyle: "Diet/Lifestyle",
};
export type RequestStatus = "pending" | "approved" | "rejected";

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  patient_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionPackage = {
  id: string;
  name: string;
  sessions_count: number;
  price: number;
  active: boolean;
  created_at: string;
};

export type Patient = {
  id: string;
  name: string;
  dob: string;
  address: string;
  phone: string;
  sessions_remaining: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Visit = {
  id: string;
  patient_id: string;
  checked_in_by: string | null;
  note: string | null;
  created_at: string;
  checked_out_at: string | null;
};

export type Purchase = {
  id: string;
  patient_id: string;
  package_id: string;
  sessions_added: number;
  amount: number;
  created_by: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  patient_id: string;
  purchase_id: string | null;
  amount: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type PaymentTotals = {
  total_charged: number;
  total_paid: number;
  balance: number;
};

export type SessionRequest = {
  id: string;
  patient_id: string;
  package_id: string;
  status: RequestStatus;
  requested_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type Recommendation = {
  id: string;
  patient_id: string;
  type: RecommendationType;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
