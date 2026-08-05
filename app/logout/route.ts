import { redirect } from "next/navigation";
import { signOut } from "../auth";

export async function POST() {
  await signOut();
  redirect("/login");
}
