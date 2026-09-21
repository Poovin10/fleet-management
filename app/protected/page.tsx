import { redirect } from "next/navigation";

export default function ProtectedPage() {
  // Boilerplate tutorial page removed. Redirecting to the main ERP dashboard.
  redirect("/");
}
