import { redirect } from "next/navigation";

export default function SgaRedirect() {
  redirect("/finance?view=sga");
}
