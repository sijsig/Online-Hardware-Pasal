"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");

  async function signOut() {
    setErrorMessage("");
    const { error } = await createClient().auth.signOut();
    if (error) {
      setErrorMessage("Could not sign out. Please try again.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return <div className="sign-out-wrap"><button className="secondary-button" type="button" onClick={signOut}>Sign out</button>{errorMessage && <p role="alert">{errorMessage}</p>}</div>;
}
